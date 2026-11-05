/**
 * Markdown in descriptions (Simon, 2026-10-29: "make sure the copy paste
 * descriptions render markdown"): text written with Markdown (from a chat
 * bot, a notes app, a README) is pasted into the description editor as its
 * formatting, and a plain description (the original's `description`, a shop's
 * description) written with it shows formatted. Only what a description can
 * show is made: headings, bold, italic, strikethrough, links (web, mail and
 * qortal://), lists (nested), quotes and code. A picture shows its text: a
 * description loads nothing from outside Qortal. The HTML is made safe after
 * (richtext/sanitize.ts sanitizeDescription), like any description's.
 *
 * Each line of text is a paragraph of its own, as plain descriptions show
 * (richtext/plainText.ts plainToHtml), not joined as Markdown would: sellers
 * write "Weight: 30 g" and "Origin: Japan" on lines of their own.
 */

const LIST_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/;
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const FENCE = /^ {0,3}(```|~~~)/;
const LINK_URL = /^(https?:\/\/|qortal:\/\/|mailto:)[^\s<>"]+$/i;

/** Text that is written with Markdown, so it is worth showing formatted. */
export function looksLikeMarkdown(text: string | null | undefined): boolean {
  if (!text) return false;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.some((line) => HEADING.test(line) || FENCE.test(line))) return true;
  if (/\*\*[^*\n]+\*\*|__[^_\n]+__/.test(text)) return true;
  if (/\[[^\]\n]+\]\((?:https?|qortal):\/\/[^)\s]+\)/i.test(text)) return true;
  if (lines.filter((line) => LIST_ITEM.test(line)).length >= 2) return true;
  return lines.some((line) => QUOTE.test(line) && line.trim().length > 1);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One line's inline Markdown as HTML. */
export function inlineMarkdown(source: string): string {
  const kept: string[] = [];
  const keep = (html: string) => `\uE000${kept.push(html) - 1}\uE000`;
  let text = source
    // Code first: nothing inside it is formatting.
    .replace(/`([^`\n]+)`/g, (_, code: string) => keep(`<code>${escapeHtml(code)}</code>`))
    // A character after a backslash is itself.
    .replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, (_, ch: string) => keep(escapeHtml(ch)));
  // A picture shows its text; a link stays one when its address is a web, mail or qortal:// one.
  // An address may hold one level of brackets (a wiki page's).
  text = text.replace(/!\[([^\]\n]*)\]\(((?:[^()\s]|\([^()\s]*\))*)(?:\s+"[^"]*")?\)/g, (_, alt: string) => alt);
  text = text.replace(/\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)/g, (_all, label: string, url: string) =>
    LINK_URL.test(url) ? keep(`<a href="${escapeHtml(url)}">${inlineMarkdown(label)}</a>`) : label
  );
  text = text.replace(/<((?:https?|qortal):\/\/[^\s<>]+)>/gi, (_, url: string) => keep(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`));
  text = escapeHtml(text)
    .replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])__(?=\S)([^_]*?\S)__(?=[^\w]|$)/g, "$1<strong>$2</strong>")
    .replace(/~~(?=\S)([^~]*?\S)~~/g, "<s>$1</s>")
    .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?![*\w])/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?=[^\w]|$)/g, "$1<em>$2</em>");
  return text.replace(/\uE000(\d+)\uE000/g, (_, n: string) => kept[Number(n)] ?? "");
}

interface ListLine {
  depth: number;
  ordered: boolean;
  html: string;
}

/** List lines as nested lists: a deeper line opens a list inside the item before it. */
function listHtml(items: ListLine[]): string {
  let out = "";
  const open: { ordered: boolean; depth: number }[] = [];
  for (const item of items) {
    const depth = open.length === 0 ? 0 : Math.min(item.depth, open[open.length - 1].depth + 1);
    while (open.length > 0 && open[open.length - 1].depth > depth) out += `</li></${open.pop()!.ordered ? "ol" : "ul"}>`;
    const top = open[open.length - 1];
    if (top && top.depth === depth && top.ordered !== item.ordered) {
      out += `</li></${open.pop()!.ordered ? "ol" : "ul"}>`;
    }
    const current = open[open.length - 1];
    if (!current || current.depth < depth) {
      out += item.ordered ? "<ol>" : "<ul>";
      open.push({ ordered: item.ordered, depth });
    } else {
      out += "</li>";
    }
    out += `<li>${item.html}`;
  }
  while (open.length > 0) out += `</li></${open.pop()!.ordered ? "ol" : "ul"}>`;
  return out;
}

function depthOf(indent: string): number {
  const width = indent.replace(/\t/g, "    ").length;
  return Math.floor(width / 2);
}

/** Markdown text as a description's HTML (see above). */
export function markdownToHtml(text: string | null | undefined): string {
  if (!text) return "";
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fence = FENCE.exec(line);
    if (fence) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trimStart().startsWith(fence[1]); i++) code.push(lines[i]);
      out.push(`<pre>${escapeHtml(code.join("\n"))}</pre>`);
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      out.push(heading[1].length <= 2 ? `<h2>${inlineMarkdown(heading[2])}</h2>` : `<h3>${inlineMarkdown(heading[2])}</h3>`);
      continue;
    }
    if (RULE.test(line)) continue;
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      for (; i < lines.length && QUOTE.test(lines[i]); i++) quoted.push(inlineMarkdown(QUOTE.exec(lines[i])![1]));
      i--;
      out.push(`<blockquote>${quoted.filter(Boolean).join("<br>")}</blockquote>`);
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const items: ListLine[] = [];
      for (; i < lines.length; i++) {
        const item = LIST_ITEM.exec(lines[i]);
        if (!item) break;
        // A task's box as a character: ☐ to do, ☑ done.
        const body = item[3].replace(/^\[ \][ \t]+/, "☐ ").replace(/^\[[xX]\][ \t]+/, "☑ ");
        items.push({ depth: depthOf(item[1]), ordered: /\d/.test(item[2]), html: inlineMarkdown(body) });
      }
      i--;
      out.push(listHtml(items));
      continue;
    }
    out.push(`<p>${inlineMarkdown(line.trim())}</p>`);
  }
  return out.join("");
}

/** Pasted HTML that carries formatting of its own (a web page, a chat bot's reply), which a paste keeps as it is. */
export function hasFormatting(html: string | null | undefined): boolean {
  if (!html) return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return !!doc.body.querySelector("strong, b, em, i, u, s, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, a[href], pre, code, table");
}
