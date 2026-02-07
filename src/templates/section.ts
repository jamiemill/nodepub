const template = `doctype xml
| <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
html(
  xml:lang=data.metadata.language,
  xmlns:epub='http://www.idpf.org/2007/ops',
  xmlns='http://www.w3.org/1999/xhtml'
)
  head
    title=data.metadata.title
    link(
      href='../css/ebook.css',
      rel='stylesheet',
      type='text/css'
    )
    meta(
      charset='utf-8'
    )

  body
    div(
      id=\`s\${ section.index }\`
    )!= content
`;
export default template;
