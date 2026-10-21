/**
 * Quill 2 (react-quill-new) writes some HTML differently from Quill 1
 * (react-quill), which the original Q-Mail uses. Mail bodies are stored as
 * HTML in `textContentV2` and rendered as plain sanitized HTML, so a Quill 2
 * bullet list (`<ol><li data-list="bullet">`) would show as a numbered list
 * in the original app. This converts Quill 2 editor HTML to the Quill 1
 * shape before it is published. It is idempotent, and it leaves Quill 1 HTML
 * (and any other HTML) unchanged.
 */
const QUILL2_MARKERS = /data-list=|ql-code-block|ql-ui|ql-cursor/

export function toQuill1Html(html: string): string {
  if (typeof html !== 'string' || !html || !QUILL2_MARKERS.test(html)) return html
  if (typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body
  convertQuill2Markup(doc, body)
  return body.innerHTML
}

function convertQuill2Markup(doc: Document, body: HTMLElement): void {
  // Quill 2 puts an empty UI span in every list item.
  body.querySelectorAll('span.ql-ui').forEach((el) => el.remove())

  // A pending format at a collapsed cursor (Bold pressed, nothing typed yet)
  // lives in a cursor span holding a zero-width character: unwrap it.
  body.querySelectorAll('span.ql-cursor').forEach((el) => {
    const text = (el.textContent ?? '').replace(/\uFEFF/g, '')
    el.replaceWith(doc.createTextNode(text))
  })

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
}

const NBSP = '\u00a0'

/**
 * A run of `length` spaces as Quill 1 mail carries it: plain spaces, with a
 * non-breaking one between them where a run of two or more would otherwise
 * collapse in the reader (" &nbsp; " for three). A single space is a plain
 * space, so long lines wrap.
 */
function spaceRun(length: number, wholeBlock: boolean): string {
  if (length === 1) return wholeBlock ? NBSP : ' '
  let run = ''
  for (let i = 0; i < length; i += 1) run += i % 2 === 1 || (wholeBlock && i === 0) ? NBSP : ' '
  return run
}

const TEXT_BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, div, td, th'
const BLOCK_CONTAINERS = new Set(['BODY', 'UL', 'OL', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'TR'])

/**
 * Quill 2's `getSemanticHTML()` writes every space as `&nbsp;`, so a body
 * would be one unbreakable line in a reader and unlike the HTML the original
 * Q-Mail (Quill 1) writes. Text keeps plain spaces; inside `<pre>` every
 * space is plain, since `<pre>` keeps whitespace anyway. Whitespace between
 * blocks (formatting newlines) is left alone.
 */
function normalizeSpaces(doc: Document, body: HTMLElement): void {
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)
  for (const node of nodes) {
    const text = node.data
    if (!/[ \u00a0]/.test(text)) continue
    if (node.parentElement?.closest('pre')) {
      if (text.includes(NBSP)) node.data = text.replace(/\u00a0/g, ' ')
      continue
    }
    const parent = node.parentElement
    if (!parent || BLOCK_CONTAINERS.has(parent.tagName)) continue
    if (/^[ \u00a0]*[\n\t\r][\s]*$/.test(text)) continue
    // A line holding only spaces must stay visible, so it starts non-breaking.
    const block = parent.closest(TEXT_BLOCKS) ?? parent
    const wholeBlock = !(block.textContent ?? '').replace(/[ \u00a0]/g, '')
    const next = text.replace(/[ \u00a0]+/g, (run) => spaceRun(run.length, wholeBlock))
    if (next !== text) node.data = next
  }
}

/**
 * The HTML that is published as `textContentV2`: the Quill 1 shape
 * (`toQuill1Html`) with plain spaces (`normalizeSpaces`). Idempotent.
 * Display goes through `toQuill1Html` alone, so received mail renders as
 * its sender wrote it.
 */
export function toPublishedMailHtml(html: string): string {
  if (typeof html !== 'string' || !html) return html
  if (typeof DOMParser === 'undefined') return html
  if (!QUILL2_MARKERS.test(html) && !/\u00a0|&nbsp;|&#160;| {2}|<p><\/p>/.test(html)) return html

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const body = doc.body
  convertQuill2Markup(doc, body)
  normalizeSpaces(doc, body)
  // An empty line is <p><br></p> in Quill 1; <p></p> would collapse.
  body.querySelectorAll('p').forEach((p) => {
    if (!p.firstChild) p.appendChild(doc.createElement('br'))
  })
  return body.innerHTML
}
