const template = `-
  let coverType = data.options.coverType;

doctype xml
html(
  xml:lang=data.metadata.language,
  xmlns:epub='http://www.idpf.org/2007/ops',
  xmlns='http://www.w3.org/1999/xhtml'
)
  head
    title=data.metadata.title
    link(
      href='css/ebook.css',
      rel='stylesheet',
      type='text/css'
    )
    meta(
      charset='utf-8'
    )

    if coverType === 'image'
      style(
        type='text/css'
      ).
        @page {
          padding: 0pt;
          margin: 0pt;
        }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        body img {
          max-width: 100%;
          max-height: 100%;
        }

  body
    if coverType === 'image'
      img(
        alt='Cover',
        src=\`resources/\${data.cover.base}\`,
        style='height: 100%; width: 100%;'
      )
    else if coverText
      div!= coverText
`;
export default template;
