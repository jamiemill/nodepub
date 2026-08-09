![IDPF](https://img.shields.io/badge/idpf-valid-success)

# Nodepub

Create valid Epub 3.3 ebooks with metadata, contents, cover, and images.

_This is a utility module, not a user-facing one. In other words it is assumed that the caller has already validated the inputs. Only basic sanity checks are performed._

## Contents

- [About Nodepub](#about-nodepub)
- [Installation](#installation)
- [Creating an Epub](#creating-an-epub)
  - [Regarding Metadata](#regarding-metadata)
  - [Regarding Sections](#regarding-sections)
  - [Including Resources](#including-resources)
  - [Changing the Styling](#changing-the-styling)
  - [Advanced Options](#advanced-options)
  - [Generating Output](#generating-output)
- [A Full Example](#a-full-example)
- [Validation](#validation)
- [Changelog](#changelog)
- [Previous Work](#previous-work)

## About Nodepub

Nodepub is a **Node** module which can be used to create **Epub 3** documents.

- Generated fixtures pass EPUBCheck 5.3.0 and Ace by DAISY 1.4.6 in CI
- Files open fine in iBooks and Calibre
- PNG/JPEG cover images (or text)
- Inline resources within the Epub
  - See [Including Resources](#including-resources) for supported formats
- Custom CSS can be provided
- Front matter before the contents page
- Exclude sections from auto contents page and metadata-based navigation
- OPS and other 'expected' subfolders within the Epub

CI runs against Node 22. Node 18 or later is supported.

## About @jamiemill/nodepub

This fork continues [Dylan Armstrong's EPUB 3.3 rewrite](https://github.com/dylanarmstrong/nodepub),
which in turn continues [kcartlidge/nodepub](https://github.com/kcartlidge/nodepub).

## Installation

The package name is `@jamiemill/nodepub`.
To install it:

```sh
pnpm add @jamiemill/nodepub
```

Then import it for use:

```javascript
import Epub from '@jamiemill/nodepub';
```

## Creating an Epub

- Documents consist of _metadata_, _sections_, _resources_, _css_, and _options_
  - `metadata` is provided in the form of an object with various properties detailing the book
  - `sections` are chunks of HTML where each represent a chapter, front/back matter, or similar
  - `resources` are inlined image / mp3 files that can appear within the body of the Epub
    - The cover is a special resource which is declared within the metadata
  - `css` is for appending to the book `css`
  - `options` are for general options that control some formatting of the book

```javascript
const metadata = {
  author: 'Dylan',
  contents: 'Chapters',
  copyright: 'Dylan, 2023',
  cover: {
    data: await readFile('example/cover.png'),
    name: 'cover.png',
  },
  coverAlt: 'Cover of My First Book by Dylan',
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
  accessMode: ['textual', 'visual'],
  accessModeSufficient: ['textual'],
  accessibilityFeature: ['structuralNavigation'],
  accessibilityHazard: ['none'],
  accessibilitySummary: 'A text publication with structural navigation.',
};

const resources = [
  {
    data: await readFile('../example/hat.png'),
    name: '../example/hat.png',
  },
];

const sections = [
  {
    content: 'This is a libre book with no copyright',
    excludeFromContents: true,
    filename: 'copyright-page',
    isFrontMatter: true,
    title: 'Copyright',
  },
  {
    content: '<h1>Chapter One</h1><p>...</p>',
    title: 'Chapter 1',
  },
  {
    content: '<h1>Chapter Two</h1><p>...</p>',
    title: 'Chapter 2',
  },
];

const css = `
  table {
    border: 3px double #ccc;
    margin-left: auto;
    margin-right: auto;
    padding: 0.5em;
  }
`;

const options = {
  showContentsInSpine: true,
  coverType: 'image', // Possible types are 'image' and 'text'
};

const epub = new Epub({
  metadata,
  sections,
  // Optional
  css,
  options,
  resources,
});
```

### Regarding Metadata

- `cover` is either an image `Resource` or prevalidated XHTML content for a text cover
- `coverAlt` sets image-cover alternative text; use `''` only when the cover is intentionally decorative
- `fileAs` is the sortable version of the `author`, which is usually by last name
- `genre` becomes the main subject in the final Epub
- `language` is the short _ISO_ language name (`en`, `fr`, `de` etc)
- `published` is the publication date in _year-month-day_ format
- `series` emits EPUB 3 collection metadata; a non-zero `sequence` adds the group position, with Calibre metadata retained for compatibility
- `tags` also become subjects in the final Epub

Accessibility discovery metadata is optional and caller-controlled:

| PARAMETER            | TYPE       | PURPOSE                                                |
| -------------------- | ---------- | ------------------------------------------------------ |
| accessMode           | `string[]` | Emit repeated `schema:accessMode` properties           |
| accessModeSufficient | `string[]` | Emit repeated `schema:accessModeSufficient` properties |
| accessibilityFeature | `string[]` | Emit repeated `schema:accessibilityFeature` properties |
| accessibilityHazard  | `string[]` | Emit repeated `schema:accessibilityHazard` properties  |
| accessibilitySummary | `string`   | Emit `schema:accessibilitySummary`                     |

Nodepub serializes these values but does not infer them. The caller is
responsible for ensuring that every claim is true for the complete publication.
An Ace pass is not a certification, and nodepub never emits conformance or
certification claims automatically.

When an image cover omits `coverAlt`, nodepub uses `Cover of {title}` as a
backward-compatible fallback. Callers should normally provide a more useful
value. `coverAlt` is XML-escaped during serialization.

### Regarding Sections

| PARAMETER           | PURPOSE                          | DEFAULT |
| ------------------- | -------------------------------- | ------- |
| title (required)    | Table of contents entry text     |         |
| content (required)  | HTML body text                   |         |
| excludeFromContents | Hide from contents/navigation    | `false` |
| isFrontMatter       | Place before the contents page   | `false` |
| filename            | Section filename inside the Epub |         |

`filename` accepts either a stem such as `chapter-1` or a complete `.xhtml`
filename. Directory and traversal components are rejected.

### Including Resources

Resources include images and mp3s.

In the example above:

```javascript
const resources = [
  {
    data: await readFile('../example/hat.png'),
    name: '../example/hat.png',
  },
];
```

This part of the metadata is an array of objects which provide a data buffer and the name of the file.

These resources are automatically added into the Epub when it is generated.
They always go in a `resources` folder internally. Exact duplicate source names
are removed; distinct resources whose basenames collide are rejected. If a
media type cannot be inferred from the filename, provide the resource's `type`
explicitly.

To include the resources in your content the HTML should refer to this internal folder rather than the original source folder, so for example `<img src="../resources/hat.png" />` in the above example.

### Changing the Styling

You can inject basic CSS into your book. This allows you to override the basic styling to change how it looks.
You should use this sparingly - there is inconsistent CSS support across ereader devices/software.

Pass custom CSS in the `Epub` constructor.

```javascript
const css = `p { text-indent: 0; } p+p { text-indent: 0.75em; }`);
const epub = new Epub({
  css,
  resources,
  metadata,
  sections,
});
```

### Advanced Options

You can also modify the book with advanced options.

| PARAMETER           | PURPOSE                                    | DEFAULT |
| ------------------- | ------------------------------------------ | ------- |
| showContentsInSpine | Include the contents page in reading order | `true`  |
| showContents        | Deprecated alias for `showContentsInSpine` |         |
| coverType           | Is the cover `image` or `text`?            | `image` |

EPUB 3 always requires a navigation document. Both option values therefore
generate and manifest `toc.xhtml`; the option controls only whether it appears
as a visible reading-order page.

```javascript
const options = {
  showContentsInSpine: true,
  coverType: 'image', // Possible types are 'image' and 'text'  (default: 'image')
};

const epub = new Epub({
  metadata,
  options,
  sections,
});
```

### Generating Output

Having defined your document generating an Epub is as simple as:

```javascript
await epub.write(folder, filename);
```

## A Full Example

In the top folder (the one containing the `package.json` file) run the following:

```sh
pnpm run example
```

This compiles [`example/example.ts`](./example/example.ts) and generates a final
EPUB in the `example` folder.

## Validation

Unit and artifact regression tests run with:

```sh
pnpm test -- --runInBand
```

The full validator gate requires `EPUBCHECK_JAR` to point to the official
EPUBCheck 5.3.0 jar and a Chromium installation available to Puppeteer:

```sh
EPUBCHECK_JAR=/path/to/epubcheck-5.3.0/epubcheck.jar pnpm validate
```

The command fails clearly if the pinned EPUBCheck jar, Ace dependency, or
browser runtime is missing.

## Changelog

- [You can view the change log here.](./CHANGELOG.md)

## Previous Work & Credits

- [Original](https://github.com/kcartlidge/nodepub)
- [Original Fork with Pug Templates](https://github.com/fholzer/nodepub).
- [Nodepub3 with MP3](https://gitee.com/taolt/nodepub3/tree/master)
