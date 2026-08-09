import { readFile } from 'node:fs/promises';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { open, type Entry, type ZipFile } from 'yauzl';

import Epub from '../src/epub.js';

type ArchiveEntry = {
  compressionMethod: number;
  content: Buffer;
  name: string;
};

const readEntry = (zipFile: ZipFile, entry: Entry) =>
  new Promise<Buffer>((resolve, reject) => {
    zipFile.openReadStream(entry, (streamError, stream) => {
      if (streamError || !stream) {
        reject(streamError || new Error(`Unable to read ${entry.fileName}`));
        return;
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });

const readArchive = (filename: string) =>
  new Promise<ArchiveEntry[]>((resolve, reject) => {
    open(filename, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError || new Error(`Unable to open ${filename}`));
        return;
      }

      const entries: ArchiveEntry[] = [];
      zipFile.on('error', reject);
      zipFile.on('end', () => resolve(entries));
      zipFile.on('entry', (entry: Entry) => {
        void readEntry(zipFile, entry)
          .then((content) => {
            entries.push({
              compressionMethod: entry.compressionMethod,
              content,
              name: entry.fileName,
            });
            zipFile.readEntry();
          })
          .catch(reject);
      });
      zipFile.readEntry();
    });
  });

const baseMetadata = {
  author: 'Example Author',
  contents: 'Contents',
  cover: '<h1>Example Book</h1>',
  id: 'urn:uuid:7e61e717-cf7d-4bad-a3f2-00dc29a96064',
  language: 'en',
  modified: '2026-08-09T09:00:00Z',
  published: '2026-08-09',
  title: 'Example Book',
};

const baseSections = [
  {
    content: '<h1>Chapter one</h1><p>Text.</p>',
    title: 'Chapter one',
  },
];

describe('generated EPUB artifacts', () => {
  let outputFolder: string;

  beforeAll(async () => {
    outputFolder = await mkdtemp(join(tmpdir(), 'nodepub-artifacts-'));
  });

  afterAll(async () => {
    await rm(outputFolder, { force: true, recursive: true });
  });

  it('writes a minimal text-only EPUB with a first, stored mimetype entry', async () => {
    const epub = new Epub({
      metadata: baseMetadata,
      options: { coverType: 'text' },
      sections: baseSections,
    });

    await epub.write(outputFolder, 'minimal');
    const entries = await readArchive(join(outputFolder, 'minimal.epub'));

    expect(entries[0]).toMatchObject({
      compressionMethod: 0,
      name: 'mimetype',
    });
    expect(entries[0].content.toString()).toBe('application/epub+zip');
    expect(entries.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'META-INF/container.xml',
        'OPS/ebook.opf',
        'OPS/cover.xhtml',
        'OPS/content/toc.xhtml',
        'OPS/content/s1.xhtml',
      ]),
    );
  });

  it('preserves image cover and body resource buffers in the archive', async () => {
    const [cover, bodyImage] = await Promise.all([
      readFile('example/cover.png'),
      readFile('example/hat.png'),
    ]);
    const epub = new Epub({
      metadata: {
        ...baseMetadata,
        cover: { data: cover, name: 'cover.png' },
      },
      resources: [{ data: bodyImage, name: 'body.png' }],
      sections: [
        {
          content:
            '<h1>Illustrated</h1><img src="../resources/body.png" alt="A hat." />',
          title: 'Illustrated',
        },
      ],
    });

    await epub.write(outputFolder, 'images.epub');
    const entries = await readArchive(join(outputFolder, 'images.epub'));
    const byName = new Map(entries.map((entry) => [entry.name, entry]));

    expect(byName.get('OPS/resources/cover.png')?.content).toEqual(cover);
    expect(byName.get('OPS/resources/body.png')?.content).toEqual(bodyImage);
    expect(byName.get('OPS/ebook.opf')?.content.toString()).toContain(
      'media-type="image/png"',
    );
  });

  it('keeps front matter and excluded entries out of logical navigation', () => {
    const epub = new Epub({
      metadata: baseMetadata,
      options: { coverType: 'text', showContents: true },
      sections: [
        {
          content: '<h1>Title page</h1>',
          excludeFromContents: true,
          filename: 'title-page',
          isFrontMatter: true,
          title: 'Title page',
        },
        ...baseSections,
      ],
    });
    const contents = epub
      .getFiles()
      .find(({ name }) => name === 'toc.xhtml')?.content.toString();

    expect(contents).toContain('href="s2.xhtml"');
    expect(contents).not.toContain('href="title-page.xhtml"');
  });

  it('always writes navigation but omits it from the spine when contents are hidden', async () => {
    const epub = new Epub({
      metadata: baseMetadata,
      options: { coverType: 'text', showContents: false },
      sections: baseSections,
    });

    expect(epub.getFiles().some(({ name }) => name === 'toc.xhtml')).toBe(true);

    await epub.write(outputFolder, 'hidden-contents');
    const entries = await readArchive(
      join(outputFolder, 'hidden-contents.epub'),
    );
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    const opf = byName.get('OPS/ebook.opf')?.content.toString() || '';

    expect(byName.has('OPS/content/toc.xhtml')).toBe(true);
    expect(opf).toContain('properties="nav"');
    expect(opf).not.toMatch(/<itemref[^>]+idref="toc"/);
  });

  it('uses EPUB and HTML language attributes and the matching TOC role', () => {
    const epub = new Epub({
      metadata: baseMetadata,
      options: { coverType: 'text' },
      sections: baseSections,
    });
    const files = epub.getFiles();

    for (const name of ['cover.xhtml', 'toc.xhtml', 's1.xhtml']) {
      const content = files.find((file) => file.name === name)?.content.toString();
      expect(content).toContain('lang="en"');
      expect(content).toContain('xml:lang="en"');
    }

    const contents = files
      .find(({ name }) => name === 'toc.xhtml')
      ?.content.toString();
    expect(contents).toMatch(/<section[^>]+epub:type="frontmatter"/);
    expect(contents).toMatch(
      /<nav[^>]+epub:type="toc"[^>]+role="doc-toc"/,
    );
  });

  it('serializes caller-supplied accessibility metadata as separate escaped elements', () => {
    const metadata = {
      ...baseMetadata,
      accessMode: ['textual', 'visual'],
      accessModeSufficient: ['textual'],
      accessibilityFeature: ['structuralNavigation', 'alternativeText'],
      accessibilityHazard: ['none'],
      accessibilitySummary: 'Useful & clear <summary>.',
    };
    const epub = new Epub({
      metadata,
      options: { coverType: 'text' },
      sections: baseSections,
    });
    const opf = epub
      .getFiles()
      .find(({ name }) => name === 'ebook.opf')?.content.toString();

    expect(opf).toContain(
      '<meta property="schema:accessMode">textual</meta>',
    );
    expect(opf).toContain(
      '<meta property="schema:accessMode">visual</meta>',
    );
    expect(opf).toContain(
      '<meta property="schema:accessModeSufficient">textual</meta>',
    );
    expect(opf).toContain(
      '<meta property="schema:accessibilityFeature">structuralNavigation</meta>',
    );
    expect(opf).toContain(
      '<meta property="schema:accessibilityHazard">none</meta>',
    );
    expect(opf).toContain(
      '<meta property="schema:accessibilitySummary">Useful &amp; clear &lt;summary&gt;.</meta>',
    );
  });

  it('preserves the exact title when series metadata is present', () => {
    const epub = new Epub({
      metadata: {
        ...baseMetadata,
        sequence: 2,
        series: 'Example series',
        title: 'Exact title',
      },
      options: { coverType: 'text' },
      sections: baseSections,
    });
    const opf = epub
      .getFiles()
      .find(({ name }) => name === 'ebook.opf')?.content.toString();

    expect(opf).toContain('<dc:title id="title">Exact title</dc:title>');
    expect(opf).not.toContain('Exact title (Example series #2)');
    expect(opf).toContain('content="Example series"');
    expect(opf).toContain('content="2"');
  });

  it('rejects resource basenames that collide inside the archive', () => {
    expect(
      () =>
        new Epub({
          metadata: baseMetadata,
          options: { coverType: 'text' },
          resources: [
            { data: Buffer.from('first'), name: 'a/image.png' },
            { data: Buffer.from('second'), name: 'b/image.png' },
          ],
          sections: baseSections,
        }),
    ).toThrow(/resource.*image\.png.*collision/i);
  });

  it('accepts a complete XHTML section filename without duplicating the extension', () => {
    const epub = new Epub({
      metadata: baseMetadata,
      options: { coverType: 'text' },
      sections: [
        {
          content: '<h1>Chapter</h1>',
          filename: 'chapter.xhtml',
          title: 'Chapter',
        },
      ],
    });

    expect(epub.data.sections[0].filename).toBe('chapter.xhtml');
  });

  it.each(['../chapter', 'folder/chapter', '..\\chapter'])(
    'rejects unsafe section filename %s',
    (filename) => {
      expect(
        () =>
          new Epub({
            metadata: baseMetadata,
            options: { coverType: 'text' },
            sections: [
              {
                content: '<h1>Chapter</h1>',
                filename,
                title: 'Chapter',
              },
            ],
          }),
      ).toThrow(/invalid section filename/i);
    },
  );

  it('requires an explicit media type when it cannot be inferred', () => {
    expect(
      () =>
        new Epub({
          metadata: baseMetadata,
          options: { coverType: 'text' },
          resources: [{ data: Buffer.from('data'), name: 'resource.unknown' }],
          sections: baseSections,
        }),
    ).toThrow(/media type.*provide type explicitly/i);

    expect(
      () =>
        new Epub({
          metadata: baseMetadata,
          options: { coverType: 'text' },
          resources: [
            {
              data: Buffer.from('data'),
              name: 'resource.unknown',
              type: 'application/octet-stream',
            },
          ],
          sections: baseSections,
        }),
    ).not.toThrow();
  });

  it('rejects write when the output stream fails', async () => {
    const epub = new Epub({
      metadata: baseMetadata,
      options: { coverType: 'text' },
      sections: baseSections,
    });
    await mkdir(join(outputFolder, 'not-a-file.epub'));

    await expect(epub.write(outputFolder, 'not-a-file')).rejects.toThrow();
  });
});
