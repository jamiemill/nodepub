import defaults from 'defaults';
import zip from 'archiver';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { Data, Document, Metadata, Section } from './types.js';
import {
  defaultCss,
  defaultMetadata,
  defaultOptions,
  defaultSection,
} from './constants.js';
import {
  getContainer,
  getContents,
  getCover,
  getOPF,
  getSection,
} from './pug.js';
import {
  addResourceDetails,
  assertUniqueResourceBases,
  makeFolder,
  uniqueResources,
} from './utils.js';

const normalizeSectionFilename = (filename: string, fallback: string) => {
  const source = filename || fallback;
  if (
    source === '.' ||
    source === '..' ||
    source.includes('/') ||
    source.includes('\\')
  ) {
    throw new Error(`Invalid section filename: "${source}"`);
  }

  return source.toLowerCase().endsWith('.xhtml')
    ? source
    : `${source}.xhtml`;
};

class Epub {
  data: Data;

  constructor({
    css: overrideCss = '',
    metadata: partialMetadata,
    options: partialOptions = {},
    resources = [],
    sections: partialSections,
  }: Document) {
    const metadata: Required<Metadata> = defaults(
      partialMetadata,
      defaultMetadata,
    );

    // Buffer being lost by defaults
    if (typeof metadata.cover !== 'string' && typeof partialMetadata.cover !== 'string') {
      metadata.cover.data = partialMetadata.cover.data;
    }

    const options = {
      coverType: partialOptions.coverType ?? defaultOptions.coverType,
      showContentsInSpine:
        partialOptions.showContentsInSpine ??
        partialOptions.showContents ??
        defaultOptions.showContentsInSpine,
    };

    const sections: Required<Section>[] = [];
    partialSections.forEach((section, index) => {
      const requiredSection: Required<Section> = defaults(
        section,
        defaultSection,
      );

      const sectionIndex = index + 1;
      const filename = normalizeSectionFilename(
        section.filename || '',
        `s${sectionIndex}`,
      );

      requiredSection.index = sectionIndex;
      requiredSection.filename = filename;

      sections.push(requiredSection);
    });

    const { cover } = metadata;

    const css = [defaultCss, overrideCss].join('\n');

    const dataCover =
      typeof cover === 'string'
        ? cover
        : addResourceDetails({ ...cover, properties: 'cover-image' });
    const initialResources = typeof dataCover === 'string' ? [] : [dataCover];
    const detailedResources = resources
      .reduce(uniqueResources, initialResources)
      .map(addResourceDetails);
    assertUniqueResourceBases(detailedResources);

    this.data = {
      cover: dataCover,
      css,
      metadata,
      options,
      resources: detailedResources,
      sections,
    };
  }

  // Gets the files needed for the EPUB, as an array of objects.
  // Note that 'compress:false' MUST be respected for valid EPUB files.
  getFiles() {
    const { data } = this;

    const files = [];

    // Required files.
    files.push({
      compress: false,
      content: 'application/epub+zip',
      folder: '',
      name: 'mimetype',
    });

    files.push({
      compress: true,
      content: getContainer(),
      folder: 'META-INF',
      name: 'container.xml',
    });

    files.push({
      compress: true,
      content: getOPF(data),
      folder: 'OPS',
      name: 'ebook.opf',
    });

    files.push({
      compress: true,
      content: getCover(data),
      folder: 'OPS',
      name: 'cover.xhtml',
    });

    // Optional files.
    files.push({
      compress: true,
      content: data.css,
      folder: 'OPS/css',
      name: 'ebook.css',
    });

    const { sections } = data;
    for (let i = 0, len = sections.length; i < len; i += 1) {
      const section = sections[i];
      files.push({
        compress: true,
        content: getSection(data, section),
        folder: 'OPS/content',
        name: section.filename,
      });
    }

    // EPUB 3 always requires a navigation document. The option only controls
    // whether that document is also visible in the reading-order spine.
    files.push({
      compress: true,
      content: getContents(data),
      folder: 'OPS/content',
      name: 'toc.xhtml',
    });

    data.resources.forEach((resource) => {
      files.push({
        compress: true,
        content: resource.data,
        folder: 'OPS/resources',
        name: resource.base,
      });
    });

    // Return with the files.
    return files;
  }

  async write(folder: string, filename: string) {
    const files = this.getFiles();

    const fullFilename = filename.endsWith('.epub')
      ? filename
      : `${filename}.epub`;
    const outputPath = join(folder, fullFilename);

    // Start creating the zip.
    await makeFolder(folder);
    const output = createWriteStream(outputPath);
    const archive = zip('zip', { store: false });

    try {
      await new Promise<void>((resolveWrite, rejectWrite) => {
        let settled = false;
        const settle = (callback: () => void) => {
          if (!settled) {
            settled = true;
            callback();
          }
        };
        const rejectOnce = (error: Error) =>
          settle(() => rejectWrite(error));

        archive.once('error', rejectOnce);
        output.once('error', rejectOnce);
        output.once('close', () => settle(resolveWrite));
        archive.pipe(output);

        files.forEach((file) => {
          if (file.folder.length > 0) {
            archive.append(file.content, {
              name: `${file.folder}/${file.name}`,
              store: !file.compress,
            });
          } else {
            archive.append(file.content, {
              name: file.name,
              store: !file.compress,
            });
          }
        });

        void archive.finalize().catch(rejectOnce);
      });
    } catch (error) {
      archive.abort();
      output.destroy();
      await unlink(outputPath).catch(() => undefined);
      throw error;
    }
  }
}

export default Epub;
