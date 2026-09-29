/**
 * Q-Support+ edits issues with Quill 2 (react-quill-new), while the original
 * Q-Support still displays them with Quill 1's stylesheet. Quill 2 writes two
 * things differently in the editor's HTML:
 *
 *   lists        <ol><li data-list="bullet">…      (Quill 1: <ul><li>…)
 *   code blocks  <div class="ql-code-block-container"><div class="ql-code-block">…
 *                                                  (Quill 1: <pre class="ql-syntax">…)
 *
 * Everything else (headers, inline formats, ql-align-*, ql-indent-*, ql-size-*,
 * ql-font-*, colours, images, links) is the same in both. `toQuill1Html` turns
 * the Quill 2 form into the Quill 1 form before an issue is published, so
 * `htmlDescription` stays readable in both apps (CLAUDE.md ground rule 1).
 * Quill 1 HTML passes through unchanged, so it is safe to call on anything.
 */

const LIST_TAGS: Record<string, string> = {
  bullet: 'ul',
  ordered: 'ol',
  checked: 'ul',
  unchecked: 'ul',
};

function convertLists(root: ParentNode): void {
  const lists = Array.from(root.querySelectorAll('ol')).filter((ol) =>
    Array.from(ol.children).some((child) => child.tagName === 'LI' && child.hasAttribute('data-list'))
  );
  for (const ol of lists) {
    const replacements: HTMLElement[] = [];
    let current: HTMLElement | null = null;
    let currentType = '';
    for (const child of Array.from(ol.children)) {
      const type = child.getAttribute('data-list') || 'ordered';
      if (!current || type !== currentType) {
        current = ol.ownerDocument.createElement(LIST_TAGS[type] || 'ol');
        if (type === 'checked' || type === 'unchecked') {
          current.setAttribute('data-checked', type === 'checked' ? 'true' : 'false');
        }
        replacements.push(current);
        currentType = type;
      }
      child.removeAttribute('data-list');
      current.appendChild(child);
    }
    for (const list of replacements) ol.parentNode?.insertBefore(list, ol);
    ol.remove();
  }
}

function convertCodeBlocks(root: ParentNode): void {
  for (const container of Array.from(root.querySelectorAll('div.ql-code-block-container'))) {
    const lines = Array.from(container.querySelectorAll('.ql-code-block')).map(
      (line) => line.textContent ?? ''
    );
    const pre = container.ownerDocument.createElement('pre');
    pre.className = 'ql-syntax';
    pre.setAttribute('spellcheck', 'false');
    pre.textContent = `${lines.join('\n')}\n`;
    container.replaceWith(pre);
  }
}

/** Convert Quill 2 editor HTML to the form Quill 1 (the original app) renders. */
export function toQuill1Html(html: string): string {
  if (!html || typeof document === 'undefined') return html;
  if (!/data-list=|ql-code-block-container|ql-ui/.test(html)) return html;
  const template = document.createElement('template');
  template.innerHTML = html;
  const root = template.content;
  for (const ui of Array.from(root.querySelectorAll('.ql-ui'))) ui.remove();
  convertLists(root);
  convertCodeBlocks(root);
  return template.innerHTML;
}
