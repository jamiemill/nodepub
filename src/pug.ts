import pug from 'pug';

import type { Data, Section } from './types.js';

const { url } = import.meta;
const getPath = (path: string) => new URL(path, url).pathname;

const options = {
  doctype: 'xml',
  pretty: true,
};

const pugContainer = pug.compileFile(
  getPath('../templates/container.pug'),
  options,
);
const pugContents = pug.compileFile(
  getPath('../templates/contents.pug'),
  options,
);
const pugCover = pug.compileFile(getPath('../templates/cover.pug'), options);
const pugOpf = pug.compileFile(getPath('../templates/opf.pug'), options);
const pugSection = pug.compileFile(
  getPath('../templates/section.pug'),
  options,
);

// Provide the contents of the container XML file.
const getContainer = () => pugContainer();

// Provide the contents page.
const getContents = (data: Data) => pugContents({ data });

const processTextContent = (content: string) =>
  content.replace(/&nbsp;/g, '&#xa0;').replace(/&copy;/g, '&#xa9;');

// Provide the contents of the cover HTML enclosure.
const getCover = (data: Data) => {
  const { coverType } = data.options;
  const { cover } = data;

  if (coverType !== 'text') {
    throw new Error('Cover documents are only generated for text covers');
  }

  if (coverType === 'text' && typeof cover === 'string') {
    const coverText = processTextContent(cover);
    return pugCover({ coverText, data });
  }

  return pugCover({ data });
};

// Provide the contents of the OPF (spine) file.
const getOPF = (data: Data) => pugOpf({ data });

// Provide the contents of a single section's HTML.
const getSection = (data: Data, section: Section) => {
  const content = processTextContent(section.content);
  return pugSection({ content, data, section });
};

export { getContainer, getContents, getCover, getOPF, getSection };
