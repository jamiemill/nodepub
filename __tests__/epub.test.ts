import { jest } from '@jest/globals';

jest.useFakeTimers().setSystemTime(new Date('2023-06-03T00:00:00Z'));

const Epub = (await import('../src/epub.js')).default;

describe('epub', () => {
  const sections = [
    {
      content: 'Title Page for My First Book',
      excludeFromContents: true,
      filename: 'title-page',
      isFrontMatter: true,
      title: 'Title Page',
    },
    {
      content: '<h1>One</h1>This is the first chapter',
      title: 'Chapter 1',
    },
    {
      content:
        '<h1>Two</h1>This is the second chapter, and is excluded from the TOC.',
      excludeFromContents: true,
      title: 'Chapter 2',
    },
  ];

  const metadata = {
    author: 'Dylan',
    contents: 'Chapters',
    copyright: 'Dylan, 2023',
    cover: {
      data: Buffer.from([0]),
      name: 'example/cover.png',
    },
    coverAlt: 'Cover of My First Book',
    description: 'A test book.',
    fileAs: 'Dylan',
    genre: 'Non-Fiction',
    id: '1234',
    language: 'en',
    published: '1992-06-17',
    publisher: 'My Fake Publisher',
    sequence: 1,
    series: 'My Series',
    source: 'https://dylan.is',
    tags: ['Sample', 'Example', 'Test'],
    title: 'My First Book',
  };

  const css = 'body { margin: 5px; }';

  // Checks that duplicate is removed
  const resources = [
    {
      data: Buffer.from([0]),
      name: 'example/hat.png',
    },
    {
      data: Buffer.from([0]),
      name: 'example/hat.png',
    },
  ];

  it('Forms Valid Internal Data Structure', () => {
    const epub = new Epub({
      css,
      metadata,
      resources,
      sections,
    });

    expect(epub.data).toEqual({
      cover: {
        base: 'cover.png',
        data: expect.any(Buffer),
        name: 'example/cover.png',
        properties: 'cover-image',
        type: 'image/png',
      },
      css: `
#toc ol {
  list-style-type: none;
  margin: 0;
  padding: 0;
}

body { margin: 5px; }`,
      metadata: {
        accessMode: [],
        accessModeSufficient: [],
        accessibilityFeature: [],
        accessibilityHazard: [],
        accessibilitySummary: '',
        author: 'Dylan',
        contents: 'Chapters',
        copyright: 'Dylan, 2023',
        cover: {
          data: expect.any(Buffer),
          name: 'example/cover.png',
        },
        coverAlt: 'Cover of My First Book',
        description: 'A test book.',
        fileAs: 'Dylan',
        genre: 'Non-Fiction',
        id: '1234',
        language: 'en',
        modified: '2023-06-03T00:00:00Z',
        published: '1992-06-17',
        publisher: 'My Fake Publisher',
        sequence: 1,
        series: 'My Series',
        source: 'https://dylan.is',
        tags: ['Sample', 'Example', 'Test'],
        title: 'My First Book',
      },
      options: {
        coverType: 'image',
        showContentsInSpine: true,
      },
      resources: [
        {
          base: 'cover.png',
          data: expect.any(Buffer),
          name: 'example/cover.png',
          properties: 'cover-image',
          type: 'image/png',
        },
        {
          base: 'hat.png',
          data: expect.any(Buffer),
          name: 'example/hat.png',
          properties: '',
          type: 'image/png',
        },
      ],
      sections: [
        {
          content: 'Title Page for My First Book',
          excludeFromContents: true,
          filename: 'title-page.xhtml',
          index: 1,
          isFrontMatter: true,
          title: 'Title Page',
        },
        {
          content: '<h1>One</h1>This is the first chapter',
          excludeFromContents: false,
          filename: 's2.xhtml',
          index: 2,
          isFrontMatter: false,
          title: 'Chapter 1',
        },
        {
          content:
            '<h1>Two</h1>This is the second chapter, and is excluded from the TOC.',
          excludeFromContents: true,
          filename: 's3.xhtml',
          index: 3,
          isFrontMatter: false,
          title: 'Chapter 2',
        },
      ],
    });
  });

  it('Gets List of Files for EPUB', async () => {
    const epub = new Epub({
      css,
      metadata,
      resources,
      sections,
    });

    const files = epub.getFiles();

    expect(files).toStrictEqual([
      {
        compress: false,
        content: 'application/epub+zip',
        folder: '',
        name: 'mimetype',
      },
      {
        compress: true,
        content: expect.any(String),
        folder: 'META-INF',
        name: 'container.xml',
      },
      {
        compress: true,
        content: expect.any(String),
        folder: 'OPS',
        name: 'ebook.opf',
      },
      {
        compress: true,
        content: expect.any(String),
        folder: 'OPS/css',
        name: 'ebook.css',
      },
      {
        compress: true,
        content: expect.any(String),
        folder: 'OPS/content',
        name: 'title-page.xhtml',
      },
      {
        compress: true,
        content: expect.any(String),
        folder: 'OPS/content',
        name: 's2.xhtml',
      },
      {
        compress: true,
        content: expect.any(String),
        folder: 'OPS/content',
        name: 's3.xhtml',
      },
      {
        compress: true,
        content: expect.any(String),
        folder: 'OPS/content',
        name: 'toc.xhtml',
      },
      {
        compress: true,
        content: expect.any(Buffer),
        folder: 'OPS/resources',
        name: 'cover.png',
      },
      {
        compress: true,
        content: expect.any(Buffer),
        folder: 'OPS/resources',
        name: 'hat.png',
      },
    ]);
  });

  it('omits the cover document when no cover is provided', () => {
    const { cover: _cover, ...metadataWithoutCover } = metadata;
    const epub = new Epub({
      metadata: metadataWithoutCover,
      sections,
    });

    expect(epub.data.options.coverType).toBe('none');
    expect(epub.data.cover).toBeUndefined();
    const files = epub.getFiles();
    expect(files.some(({ name }) => name === 'cover.xhtml')).toBe(false);
    expect(files.some(({ name }) => name === 'cover.png')).toBe(false);

    const opf = files
      .find(({ name }) => name === 'ebook.opf')
      ?.content.toString();
    expect(opf).not.toContain('cover.xhtml');
    expect(opf).not.toContain('properties="cover-image"');
    expect(opf).not.toContain('name="cover"');
    expect(opf).not.toMatch(/<itemref[^>]+idref="cover"/);
  });

  it('identifies an image cover in the package without a reading-order page', () => {
    const epub = new Epub({
      css,
      metadata,
      resources,
      sections,
    });
    const files = epub.getFiles();
    const opf = files
      .find(({ name }) => name === 'ebook.opf')
      ?.content.toString();

    expect(files.some(({ name }) => name === 'cover.xhtml')).toBe(false);
    expect(opf).toContain('id="cover-image"');
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toContain('name="cover"');
    expect(opf).toContain('content="cover-image"');
    expect(opf).not.toContain('cover.xhtml');
    expect(opf).not.toMatch(/<itemref[^>]+idref="cover"/);
  });

  it('Handles text cover correctly', () => {
    const epub = new Epub({
      css,
      metadata: { ...metadata, cover: '<h1>Cover</h1>' },
      options: {
        coverType: 'text' as const,
      },
      resources,
      sections,
    });

    expect(epub.data.options.coverType).toBe('text');
    expect(epub.data.cover).toBe('<h1>Cover</h1>');
    expect(epub.data.metadata.cover).toBe('<h1>Cover</h1>');
    const files = epub.getFiles();
    expect(
      files.filter(({ folder }) => folder === 'OPS/resources').length,
    ).toBe(1);
    const opf = files
      .find(({ name }) => name === 'ebook.opf')
      ?.content.toString();
    expect(opf).toMatch(/<itemref[^>]+idref="cover"[^>]+linear="yes"/);
    expect(opf).not.toContain('properties="cover-image"');
  });

  it('rejects an image coverType without a cover resource', () => {
    expect(
      () =>
        new Epub({
          metadata: { ...metadata, cover: undefined },
          options: { coverType: 'image' },
          sections,
        }),
    ).toThrow(/image covers require metadata\.cover/i);
  });

  it('keeps front matter and excluded entries out of logical navigation', () => {
    const epub = new Epub({ metadata, sections });
    const contents = epub
      .getFiles()
      .find(({ name }) => name === 'toc.xhtml')
      ?.content.toString();

    expect(contents).toContain('href="s2.xhtml"');
    expect(contents).not.toContain('href="title-page.xhtml"');
    expect(contents).not.toContain('href="s3.xhtml"');
  });

  it('uses EPUB and HTML language attributes and the matching TOC role', () => {
    const epub = new Epub({ metadata, sections });
    const files = epub.getFiles();

    for (const name of ['toc.xhtml', 'title-page.xhtml']) {
      const content = files
        .find((file) => file.name === name)
        ?.content.toString();
      expect(content).toContain('lang="en"');
      expect(content).toContain('xml:lang="en"');
    }

    const contents = files
      .find(({ name }) => name === 'toc.xhtml')
      ?.content.toString();
    expect(contents).toMatch(/<section[^>]+epub:type="frontmatter"/);
    expect(contents).toMatch(/<nav[^>]+epub:type="toc"[^>]+role="doc-toc"/);
  });

  it('serializes caller-supplied accessibility metadata as separate escaped elements', () => {
    const epub = new Epub({
      metadata: {
        ...metadata,
        accessMode: ['textual', 'visual'],
        accessModeSufficient: ['textual'],
        accessibilityFeature: ['structuralNavigation', 'alternativeText'],
        accessibilityHazard: ['none'],
        accessibilitySummary: 'Useful & clear <summary>.',
      },
      sections,
    });
    const opf = epub
      .getFiles()
      .find(({ name }) => name === 'ebook.opf')
      ?.content.toString();

    expect(opf).toContain('<meta property="schema:accessMode">textual</meta>');
    expect(opf).toContain('<meta property="schema:accessMode">visual</meta>');
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
        ...metadata,
        sequence: 2,
        series: 'Example series',
        title: 'Exact title',
      },
      sections,
    });
    const opf = epub
      .getFiles()
      .find(({ name }) => name === 'ebook.opf')
      ?.content.toString();

    expect(opf).toContain('<dc:title id="title">Exact title</dc:title>');
    expect(opf).not.toContain('Exact title (Example series #2)');
    expect(opf).toContain(
      '<meta id="series" property="belongs-to-collection">Example series</meta>',
    );
    expect(opf).toContain(
      '<meta property="collection-type" refines="#series">series</meta>',
    );
    expect(opf).toContain(
      '<meta property="group-position" refines="#series">2</meta>',
    );
    expect(opf).toContain('content="Example series"');
    expect(opf).toContain('content="2"');
  });

  it('serializes a series without requiring a group position', () => {
    const epub = new Epub({
      metadata: {
        ...metadata,
        sequence: 0,
        series: 'Unnumbered series',
      },
      sections,
    });
    const opf = epub
      .getFiles()
      .find(({ name }) => name === 'ebook.opf')
      ?.content.toString();

    expect(opf).toContain(
      '<meta id="series" property="belongs-to-collection">Unnumbered series</meta>',
    );
    expect(opf).toContain(
      '<meta property="collection-type" refines="#series">series</meta>',
    );
    expect(opf).not.toContain('property="group-position"');
    expect(opf).not.toContain('name="calibre:series"');
  });

  it('rejects resource basenames that collide inside the archive', () => {
    expect(
      () =>
        new Epub({
          metadata,
          resources: [
            { data: Buffer.from('first'), name: 'a/image.png' },
            { data: Buffer.from('second'), name: 'b/image.png' },
          ],
          sections,
        }),
    ).toThrow(/resource.*image\.png.*collision/i);
  });

  it('accepts a complete XHTML section filename without duplicating the extension', () => {
    const epub = new Epub({
      metadata,
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
            metadata,
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
          metadata,
          resources: [{ data: Buffer.from('data'), name: 'resource.unknown' }],
          sections,
        }),
    ).toThrow(/media type.*provide type explicitly/i);

    expect(
      () =>
        new Epub({
          metadata,
          resources: [
            {
              data: Buffer.from('data'),
              name: 'resource.unknown',
              type: 'application/octet-stream',
            },
          ],
          sections,
        }),
    ).not.toThrow();
  });

  it('zero-pads the default publication date', () => {
    const epub = new Epub({
      metadata: { ...metadata, published: undefined },
      sections,
    });

    expect(epub.data.metadata.published).toBe('2023-06-03');
  });
});
