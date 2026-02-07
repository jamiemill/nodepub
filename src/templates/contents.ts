const template = `doctype xml
| <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
html(
  xmlns:epub='http://www.idpf.org/2007/ops',
  xmlns='http://www.w3.org/1999/xhtml'
)
  head
    title= data.metadata.contents
    link(
      href='../css/ebook.css',
      rel='stylesheet',
      type='text/css'
    )
    meta(
      charset='utf-8'
    )

  body
    section(
      class='frontmatter'
      epub:type='frontmatter toc'
    )
      header
        h1= data.metadata.contents

      nav(
        epub:type='toc',
        id='toc',
        xmlns:epub='http://www.idpf.org/2007/ops'
      )
        ol
          each section in data.sections
              unless section.excludeFromContents
                li(
                  id=\`toc-\${section.filename}\`
                )
                  a(
                    href=section.filename
                  )= section.title
`;
export default template;
