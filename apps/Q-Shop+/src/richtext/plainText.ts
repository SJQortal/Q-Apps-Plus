/**
 * A product's description in two forms (docs/apps/Q-Shop+.md → Data
 * contract): `description`, the original's plain text, which Q-Shop shows as
 * it is, and, when the seller formatted it, `htmlDescription` (additive), the
 * editor's HTML in Quill 1's shape (richtext/quillHtml.ts), which Q-Shop+
 * shows. The plain text is always written, worked out from the HTML, so the
 * original keeps a readable description: paragraphs and list items on lines
 * of their own, a link's address after its text, a video or file as its label
 * and link.
 */
import { EMBED_CLASS, embedFromData, embedLabel, embedLink } from "./embeds";
import { normalizeQuillHtml } from "./quillHtml";
import { looksLikeMarkdown, markdownToHtml } from "./markdown";

/** The most HTML a description may have (it is stored in the catalogue, with up to 9 other products). */
export const MAX_DESCRIPTION_HTML = 20_000;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A plain description as the editor's HTML: a paragraph a line, `<p><br></p>` for an empty one. "" stays "". */
export function plainToHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>"))
    .join("");
}

const BLOCKS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE", "PRE"]);

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
  if (!(node instanceof Element)) return "";
  if (node.tagName === "BR") return "\n";
  const inner = Array.from(node.childNodes).map(inlineText).join("");
  if (node.tagName === "A") {
    const href = node.getAttribute("href") ?? "";
    const label = inner.trim();
    if (/^(qortal|https?):\/\//i.test(href) && label && label !== href) return `${inner} (${href})`;
  }
  return inner;
}

/** The plain text of a description's HTML, for `description` (see above). */
export function htmlToPlainText(html: string | null | undefined): string {
  const source = normalizeQuillHtml(html);
  if (!source) return "";
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, "text/html");
  const lines: string[] = [];
  const walk = (parent: Element) => {
    let inline = "";
    const flush = () => {
      if (inline) lines.push(inline);
      inline = "";
    };
    for (const node of Array.from(parent.childNodes)) {
      if (node instanceof Element && node.classList.contains(EMBED_CLASS)) {
        flush();
        const embed = embedFromData({ ...(node as HTMLElement).dataset });
        if (embed) lines.push(`${embedLabel(embed)} (${embedLink(embed)})`);
        continue;
      }
      if (node instanceof Element && (node.tagName === "UL" || node.tagName === "OL")) {
        flush();
        const ordered = node.tagName === "OL";
        Array.from(node.children).forEach((li, i) => {
          if (li.tagName === "LI") lines.push(`${ordered ? `${i + 1}.` : "•"} ${inlineText(li).replace(/\n$/, "")}`);
        });
        continue;
      }
      if (node instanceof Element && BLOCKS.has(node.tagName)) {
        flush();
        // A paragraph with only <br> is an empty line; a trailing <br> ends the line, it adds none.
        const text = inlineText(node).replace(/\n$/, "");
        if (node.tagName === "BLOCKQUOTE") lines.push(...text.split("\n").map((line) => `> ${line}`));
        else lines.push(...text.split("\n"));
        continue;
      }
      inline += inlineText(node);
    }
    flush();
  };
  walk(doc.body);
  return lines
    .join("\n")
    .replace(/\u00a0/g, " ")
    .replace(/\s+$/, "");
}

/**
 * Whether the HTML carries anything plain text doesn't: anything but
 * paragraphs and line breaks with no attributes. Plain HTML needs no
 * `htmlDescription`; `description` says it all.
 */
export function isPlainHtml(html: string | null | undefined): boolean {
  const source = normalizeQuillHtml(html);
  if (!source) return true;
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, "text/html");
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (el.tagName !== "P" && el.tagName !== "BR") return false;
    if (el.attributes.length > 0) return false;
  }
  // Text with qortal:// links in it shows them as links in Q-Shop+, from either form.
  return true;
}

function sameText(a: string, b: string): boolean {
  const norm = (text: string) => text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").replace(/\s+$/, "");
  return norm(a) === norm(b);
}

/**
 * A product's description as HTML (the editor's start, and what its page
 * shows): its `htmlDescription` while that still says what `description`
 * says, else its plain description. The original's edit keeps unknown
 * fields and rewrites only `description`, so a formatted description that no
 * longer matches is older than the seller's last edit there.
 */
export function descriptionHtmlOf(
  product: { description?: unknown; htmlDescription?: unknown } | null | undefined,
  { markdown = false }: { markdown?: boolean } = {}
): string {
  const plain = typeof product?.description === "string" ? product.description : "";
  const html = product?.htmlDescription;
  if (typeof html === "string" && html.trim() && sameText(htmlToPlainText(html), plain)) return html;
  // Shown on its page, a plain description written with Markdown shows formatted (richtext/markdown.ts);
  // the editor starts from its text as written.
  return markdown && looksLikeMarkdown(plain) ? markdownToHtml(plain) : plainToHtml(plain);
}
