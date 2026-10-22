/**
 * Makes a stored description safe to show, after Q-Share+'s DisplayHtml:
 * anyone can publish a product, so its HTML goes through DOMPurify, and every
 * later change is made on DOM nodes, never by pasting text into HTML.
 *
 * - Colours go (a description is read in four themes, light and dark), and
 *   so do forms, styles and image maps.
 * - qortal:// links stay: Hub's q-apps.js opens them. Web, mail and phone
 *   links copy themselves instead (Hub can't open them; see `copyTarget`).
 *   Any other link becomes its text.
 * - qortal:// URLs typed as text become links.
 * - Embeds (richtext/embeds.ts) keep only well-formed data; others go.
 * - Pictures inside a description go too: a product's pictures are its
 *   gallery, and a description's image could be loaded from outside Qortal.
 */
import DOMPurify from "dompurify";
import { EMBED_CLASS, embedData, embedFromData, embedLabel } from "./embeds";
import { normalizeQuillHtml } from "./quillHtml";

/** DOMPurify's default URI allow-list plus qortal:. */
const ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|qortal):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

const FORBIDDEN_TAGS = ["style", "form", "input", "button", "select", "option", "optgroup", "textarea", "datalist", "map", "area", "img", "picture", "video", "audio", "iframe", "svg"];

const THEME_OWNED_STYLE = /^(?:color|-webkit-text-fill-color|background(?:-.+)?)$/;

function dropInlineColours(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    for (let i = el.style.length - 1; i >= 0; i--) {
      const name = el.style[i];
      if (THEME_OWNED_STYLE.test(name)) el.style.removeProperty(name);
    }
    if (el.style.length === 0) el.removeAttribute("style");
  });
}

export type CopyKind = "web" | "mail" | "phone";

function webLinkUrl(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin) return url.href;
  } catch {
    // not a URL
  }
  return null;
}

/**
 * What a link copies instead of opening: a web link its absolute URL, a
 * mailto: or tel: link its address. Null for any other link.
 */
export function copyTarget(href: string): { kind: CopyKind; text: string } | null {
  const contact = /^(mailto|tel):([^?#]*)/i.exec(href);
  if (contact) {
    let address = contact[2];
    try {
      address = decodeURIComponent(address);
    } catch {
      // keep it as written
    }
    address = address.trim();
    if (!address) return null;
    return { kind: contact[1].toLowerCase() === "tel" ? "phone" : "mail", text: address };
  }
  const url = webLinkUrl(href);
  return url ? { kind: "web", text: url } : null;
}

export const COPY_TEXT: Record<CopyKind, { title: string; copied: string; failed: (text: string) => string }> = {
  web: {
    title: "Copy web link (Hub can't open it)",
    copied: "Link copied. Hub can't open web links, so paste it in your browser.",
    failed: (text) => `Hub can't open web links, and copying failed. The link is ${text}`,
  },
  mail: {
    title: "Copy email address (Hub can't open mail links)",
    copied: "Email address copied. Hub can't open mail links.",
    failed: (text) => `Hub can't open mail links, and copying failed. The address is ${text}`,
  },
  phone: {
    title: "Copy phone number (Hub can't open phone links)",
    copied: "Phone number copied. Hub can't open phone links.",
    failed: (text) => `Hub can't open phone links, and copying failed. The number is ${text}`,
  },
};

function settleLinks(root: ParentNode): void {
  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (/^qortal:\/\//i.test(href)) {
      // q-apps.js routes only the lower-case scheme.
      a.setAttribute("href", `qortal://${href.slice("qortal://".length)}`);
      a.removeAttribute("target");
      return;
    }
    const target = copyTarget(href);
    if (!target) {
      a.replaceWith(...a.childNodes);
      return;
    }
    if (target.kind === "web") a.setAttribute("href", target.text);
    a.setAttribute("data-copy-link", "");
    a.setAttribute("title", COPY_TEXT[target.kind].title);
    a.removeAttribute("target");
  });
}

/** qortal:// URLs typed as text, up to whitespace or anything that could end an attribute. */
const QORTAL_URL = /qortal:\/\/[^\s,<>"'`]+/g;
const NO_LINKS_INSIDE = new Set(["A", "PRE", "CODE"]);

function linkifyQortalText(root: Node): void {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.includes("qortal://")) continue;
    let inside = false;
    for (let el = node.parentElement; el && el !== root; el = el.parentElement) {
      if (NO_LINKS_INSIDE.has(el.tagName) || el.classList.contains(EMBED_CLASS)) inside = true;
    }
    if (!inside) texts.push(node as Text);
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
      a.textContent = match[0];
      pieces.append(a);
      last = start + match[0].length;
    }
    if (last === 0) continue;
    if (last < value.length) pieces.append(value.slice(last));
    text.replaceWith(pieces);
  }
}

/** Each embed rebuilt from its checked data, so nothing else of the publisher's element survives. */
function settleEmbeds(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(`.${EMBED_CLASS}`).forEach((el) => {
    const embed = embedFromData({ ...el.dataset });
    if (!embed) {
      el.remove();
      return;
    }
    const clean = el.ownerDocument.createElement("div");
    clean.className = EMBED_CLASS;
    for (const [key, value] of Object.entries(embedData(embed))) clean.dataset[key] = value;
    clean.textContent = embedLabel(embed);
    el.replaceWith(clean);
  });
}

/** A description's HTML made safe to show (see above). */
export function sanitizeDescription(html: string | null | undefined): string {
  const source = normalizeQuillHtml(html);
  if (!source) return "";
  const fragment: DocumentFragment = DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: ALLOWED_URI,
    FORBID_ATTR: ["color", "bgcolor", "data-copy-link", "id"],
    FORBID_TAGS: FORBIDDEN_TAGS,
    RETURN_DOM_FRAGMENT: true,
  });
  dropInlineColours(fragment);
  settleEmbeds(fragment);
  settleLinks(fragment);
  linkifyQortalText(fragment);
  const box = fragment.ownerDocument.createElement("div");
  box.append(fragment);
  return box.innerHTML;
}
