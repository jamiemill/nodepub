const template = `doctype xml
container(
  version='1.0',
  xmlns='urn:oasis:names:tc:opendocument:xmlns:container'
)
  rootfiles
    rootfile(
      full-path='OPS/ebook.opf',
      media-type='application/oebps-package+xml'
    )
`;
export default template;