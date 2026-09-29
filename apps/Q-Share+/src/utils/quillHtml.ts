/**
 * Rich-text descriptions are stored as raw HTML in `htmlDescription` (see the
 * data contract in docs/apps/Q-Share+.md). The original Q-Share writes and
 * renders them with Quill 1.3 (react-quill 2); this app uses Quill 2
 * (react-quill-new). Quill 2's `getSemanticHTML()` differs from what Quill 1
 * stored, so everything published from here is normalised back to the
 * Quill 1 shape, and everything displayed here is normalised the same way in
 * case another client stored raw Quill 2 markup:
 *
 * - lists: `<ol><li data-list="bullet">` → `<ul><li>`, `data-list="ordered"`
 *   → `<ol><li>`, checked/unchecked → `<ul data-checked="true|false">`
 *   (Quill 1's own checklist markup), `.ql-ui` helper spans removed;
 * - code: `<div class="ql-code-block-container">` lines and the bare `<pre>`
 *   of semantic HTML → `<pre class="ql-syntax" spellcheck="false">`;
 * - spaces: Quill 2 writes every space as `&nbsp;`, which stops words from
 *   wrapping in Quill 1; the first `&nbsp;` of each run becomes a plain space
 *   (later ones stay, so aligned text keeps its width);
 * - `contenteditable` attributes are dropped.
 *
 * The function is idempotent, and Quill 1 markup passes through unchanged.
 */

const LIST_TAG: Record<string, 'ul' | 'ol'> = {
  bullet: 'ul',
  ordered: 'ol',
  checked: 'ul',
  unchecked: 'ul',
};

function splitListByType(doc: Document, list: HTMLElement): void {
  const items = Array.from(list.children).filter(
    (el): el is HTMLLIElement => el.tagName === 'LI'
  );
  if (!items.some((li) => li.hasAttribute('data-list'))) return;

  const fallback = list.tagName === 'OL' ? 'ordered' : 'bullet';
  const groups: { type: string; items: HTMLLIElement[] }[] = [];
  for (const li of items) {
    const type = li.getAttribute('data-list') || fallback;
    const last = groups[groups.length - 1];
    if (last && last.type === type) last.items.push(li);
    else groups.push({ type, items: [li] });
  }

  const replacement = doc.createDocumentFragment();
  for (const group of groups) {
    const tag = LIST_TAG[group.type] ?? 'ul';
    const el = doc.createElement(tag);
    if (group.type === 'checked') el.setAttribute('data-checked', 'true');
    if (group.type === 'unchecked') el.setAttribute('data-checked', 'false');
    for (const li of group.items) {
      li.removeAttribute('data-list');
      el.appendChild(li);
    }
    replacement.appendChild(el);
  }
  list.replaceWith(replacement);
}

function normalizeNbsp(html: string): string {
  // The first entity of a run that is not already preceded by a plain space
  // becomes a plain space; the rest of the run is kept.
  return html.replace(/(^|[^ ])((?:&nbsp;)+)/g, (_m, before: string, run: string) =>
    `${before} ${run.slice('&nbsp;'.length)}`
  );
}

export function normalizeQuillHtml(html: string | null | undefined): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return normalizeNbsp(html);

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  body.querySelectorAll('div.ql-code-block-container').forEach((container) => {
    const lines = Array.from(container.querySelectorAll('.ql-code-block')).map(
      (line) => line.textContent ?? ''
    );
    const pre = doc.createElement('pre');
    pre.textContent = `${lines.join('\n')}\n`;
    container.replaceWith(pre);
  });

  body.querySelectorAll('pre').forEach((pre) => {
    pre.classList.add('ql-syntax');
    if (!pre.hasAttribute('spellcheck')) pre.setAttribute('spellcheck', 'false');
    const first = pre.firstChild;
    // Quill 2 wraps code as "\n…\n" so that leading blank lines survive;
    // Quill 1 stores "…\n".
    if (first?.nodeType === Node.TEXT_NODE && first.textContent?.startsWith('\n')) {
      first.textContent = first.textContent.slice(1);
    }
  });

  body.querySelectorAll('span.ql-ui').forEach((el) => el.remove());
  body.querySelectorAll('[contenteditable]').forEach((el) =>
    el.removeAttribute('contenteditable')
  );
  body.querySelectorAll('ol, ul').forEach((list) => splitListByType(doc, list as HTMLElement));

  return normalizeNbsp(body.innerHTML);
}

/** True when the editor holds no text and no media (Quill's empty value is `<p><br></p>`). */
export function isQuillHtmlEmpty(html: string | null | undefined): boolean {
  if (!html) return true;
  if (/<(img|video|audio|iframe)\b/i.test(html)) return false;
  return (html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim() === '');
}
