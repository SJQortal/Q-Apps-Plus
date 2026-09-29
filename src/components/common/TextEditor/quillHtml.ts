/**
 * Quill 2 (react-quill-new) writes some HTML differently from Quill 1
 * (react-quill), which the original Q-Mail uses. Mail bodies are stored as
 * HTML in `textContentV2` and rendered as plain sanitized HTML, so a Quill 2
 * bullet list (`<ol><li data-list="bullet">`) would show as a numbered list
 * in the original app. This converts Quill 2 editor HTML to the Quill 1
 * shape before it is published. It is idempotent, and it leaves Quill 1 HTML
 * (and any other HTML) unchanged.
 */
const QUILL2_MARKERS = /data-list=|ql-code-block|ql-ui/

export function toQuill1Html(html: string): string {
  if (typeof html !== 'string' || !html || !QUILL2_MARKERS.test(html)) return html
  if (typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body

  // Quill 2 puts an empty UI span in every list item.
  body.querySelectorAll('span.ql-ui').forEach((el) => el.remove())

  // Code blocks: Quill 2 uses one <div> per line inside a container; Quill 1
  // uses a single <pre class="ql-syntax"> with newline-separated text.
  body.querySelectorAll('div.ql-code-block-container').forEach((container) => {
    const pre = doc.createElement('pre')
    pre.className = 'ql-syntax'
    pre.setAttribute('spellcheck', 'false')
    const lines = Array.from(container.querySelectorAll('div.ql-code-block')).map(
      (line) => line.textContent ?? ''
    )
    pre.textContent = `${lines.join('\n')}\n`
    container.replaceWith(pre)
  })

  // Lists: Quill 2 renders every list as <ol> and marks the kind on each
  // <li data-list="bullet|ordered|checked|unchecked">. Quill 1 renders
  // <ul> for bullets, <ol> for numbers, and <ul data-checked> for checklists.
  body.querySelectorAll('ol, ul').forEach((list) => {
    const items = Array.from(list.children).filter((child) => child.tagName === 'LI')
    if (!items.some((li) => li.hasAttribute('data-list'))) return

    const fragment = doc.createDocumentFragment()
    let current: HTMLElement | null = null
    let currentKind = ''
    for (const li of items) {
      const kind =
        li.getAttribute('data-list') || (list.tagName === 'UL' ? 'bullet' : 'ordered')
      if (!current || currentKind !== kind) {
        current = doc.createElement(kind === 'ordered' ? 'ol' : 'ul')
        if (kind === 'checked' || kind === 'unchecked') {
          current.setAttribute('data-checked', String(kind === 'checked'))
        }
        fragment.appendChild(current)
        currentKind = kind
      }
      li.removeAttribute('data-list')
      current.appendChild(li)
    }
    list.replaceWith(fragment)
  })

  return body.innerHTML
}
