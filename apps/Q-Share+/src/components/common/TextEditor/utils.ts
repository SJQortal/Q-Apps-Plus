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
 * string, so text like `qortal://x"onclick="…` can't become markup.
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

export function extractTextFromHTML(htmlString: any, length = 150) {
    // Create a temporary DOM element
    const tempDiv = document.createElement("div");
    // Replace br tags and block-level tags with a space before setting the HTML content
    const htmlWithSpaces = htmlString.replace(/<\/?(br|p|div|h[1-6]|ul|ol|li|blockquote)[^>]*>/gi, ' ');
    tempDiv.innerHTML = htmlWithSpaces;
    // Extract the text content
    let text = tempDiv.textContent || tempDiv.innerText || "";
    // Replace multiple spaces with a single space and trim
    text = text.replace(/\s+/g, ' ').trim();
    // Slice the text to the desired length
    return text.slice(0, length);
  }