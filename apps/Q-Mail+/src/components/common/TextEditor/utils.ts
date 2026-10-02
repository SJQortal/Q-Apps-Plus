/**
 * A qortal:// URL typed as plain text. It ends at whitespace, a comma (as
 * upstream did), or any character that could close an HTML attribute.
 */
const QORTAL_URL = /qortal:\/\/[^\s,<>"'`]+/g;

/** Text inside these is left as it is: it is already a link, or it is code or raw text. */
const NO_LINKS_INSIDE = new Set(["A", "PRE", "CODE", "STYLE", "SCRIPT", "TEXTAREA", "TITLE", "NOSCRIPT", "OPTION"]);

function insideNoLinkElement(node: Node, root: Node): boolean {
  for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
    if (NO_LINKS_INSIDE.has(el.tagName)) return true;
  }
  return false;
}

/**
 * Turns qortal:// URLs in the text under `root` into
 * `<a href="…" class="qortal-link">` links, in place. The links are built with
 * DOM calls on already-sanitised nodes, never by pasting the URL into an HTML
 * string, so text like `qortal://x"onclick="…` can't become markup
 * (docs/QORTAL.md → Hub & GO pitfalls 18; upstream had a stored XSS hole
 * from the regex version of this).
 */
export function linkifyQortalText(root: Node): void {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue?.includes("qortal://") && !insideNoLinkElement(node, root)) texts.push(node as Text);
  }
  for (const text of texts) {
    const value = text.data;
    const pieces = doc.createDocumentFragment();
    let last = 0;
    for (const match of value.matchAll(QORTAL_URL)) {
      const start = match.index ?? 0;
      if (start > last) pieces.append(value.slice(last, start));
      const a = doc.createElement("a");
      a.setAttribute("href", match[0]);
      a.setAttribute("class", "qortal-link");
      a.textContent = match[0];
      pieces.append(a);
      last = start + match[0].length;
    }
    if (last === 0) continue;
    if (last < value.length) pieces.append(value.slice(last));
    text.replaceWith(pieces);
  }
}

/**
 * The old string API, kept for callers that hold sanitised HTML: parses it
 * into an inert document, links the qortal:// text on the DOM and serialises
 * the body again. Pass sanitised HTML only; linking never adds markup beyond
 * the `<a>` it builds, but it does not sanitise either.
 */
export function convertQortalLinks(sanitizedHtml: string): string {
  if (!sanitizedHtml || !sanitizedHtml.includes("qortal://")) return sanitizedHtml;
  const doc = new DOMParser().parseFromString(`<body>${sanitizedHtml}</body>`, "text/html");
  linkifyQortalText(doc.body);
  return doc.body.innerHTML;
}
