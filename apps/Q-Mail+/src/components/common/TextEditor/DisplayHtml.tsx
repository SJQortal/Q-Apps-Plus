/**
 * Renders a message body (Quill HTML, normalised to the Quill 1 shape and
 * sanitised) with sane typography in all four themes. Images, video and
 * tables fit the pane width and nothing scrolls sideways (UX #11a).
 *
 * Anyone can send mail, so the body is treated as hostile (docs/QORTAL.md →
 * Hub & GO pitfalls 18): DOMPurify first, then every change is made on DOM
 * nodes (links, colours) and the result is serialised once at the end.
 * Nothing is ever pasted into an HTML string.
 */
import { useMemo, type MouseEvent } from "react";
import { useDispatch } from "react-redux";
import DOMPurify from "dompurify";
import { Box, styled } from "@mui/material";
import { linkifyQortalText } from "./utils";
import { toQuill1Html } from "./quillHtml";
import { copyText } from "../GlobalContextMenu/GlobalContextMenu";
import { setNotification } from "../../../state/features/notificationsSlice";

const Body = styled(Box)(({ theme }) => ({
  display: "block",
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  // Keep position: fixed content, or a class borrowed from the app, painted
  // inside this box and not over the app.
  contain: "paint",
  color: theme.palette.text.primary,
  fontSize: "1rem",
  lineHeight: 1.55,
  fontWeight: 400,
  letterSpacing: 0,
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  overflowX: "hidden",
  "& .ql-editor-display": {
    width: "100%",
    minHeight: 20,
    padding: 0,
    color: "inherit",
    fontSize: "inherit",
    fontFamily: "inherit",
    whiteSpace: "normal",
  },
  // The Quill display classes a message body can carry (quill.core.css only
  // scopes them to the live editor, so they are written out here and the
  // three Quill stylesheets stay in the compose chunk).
  "& .ql-align-center": { textAlign: "center" },
  "& .ql-align-right": { textAlign: "right" },
  "& .ql-align-justify": { textAlign: "justify" },
  "& .ql-direction-rtl": { direction: "rtl", textAlign: "inherit" },
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [
      `& .ql-indent-${i + 1}:not(.ql-direction-rtl)`,
      { paddingLeft: `${(i + 1) * 3}em` },
    ])
  ),
  ...Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [
      `& .ql-indent-${i + 1}.ql-direction-rtl.ql-align-right`,
      { paddingRight: `${(i + 1) * 3}em` },
    ])
  ),
  "& .ql-size-small": { fontSize: "0.75em" },
  "& .ql-size-large": { fontSize: "1.5em" },
  "& .ql-size-huge": { fontSize: "2.5em" },
  "& .ql-font-serif": { fontFamily: "Georgia, 'Times New Roman', serif" },
  "& .ql-font-monospace": { fontFamily: "var(--qapp-font-mono, monospace)" },
  "& .ql-code-block-container": { fontFamily: "var(--qapp-font-mono, monospace)" },
  "& .ql-video": { display: "block", maxWidth: "100%" },
  "& .ql-ui": { display: "none" },
  "& ul[data-checked] > li::before": { marginRight: "0.4em" },
  "& ul[data-checked='true'] > li::before": { content: "'\\2611'" },
  "& ul[data-checked='false'] > li::before": { content: "'\\2610'" },
  "& ul[data-checked] > li": { listStyle: "none" },
  "& img, & video": {
    maxWidth: "100%",
    height: "auto",
    borderRadius: theme.shape.borderRadius,
  },
  "& table": {
    display: "block",
    maxWidth: "100%",
    overflowX: "auto",
    borderCollapse: "collapse",
  },
  "& td, & th": {
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(0.5, 1),
  },
  "& pre, & pre.ql-syntax": {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    overflowX: "auto",
    maxWidth: "100%",
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.primary,
    fontSize: "0.9375rem",
  },
  "& code": {
    fontSize: "0.9375rem",
  },
  "& blockquote": {
    margin: theme.spacing(1, 0),
    paddingLeft: theme.spacing(2),
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    color: theme.palette.text.secondary,
  },
  "& a": {
    color: theme.palette.primary.main,
    textDecorationColor: theme.palette.primary.main,
  },
  // Web, mail and phone links copy themselves (see DisplayHtml); the arrow says they leave Qortal.
  "& a[data-copy-link]": { cursor: "copy" },
  "& a[data-copy-link]::after": {
    // The second value gives the arrow empty alt text, so screen readers skip it.
    content: ['"\\2197"', '"\\2197" / ""'],
    display: "inline-block",
    marginLeft: "0.15em",
    fontSize: "0.85em",
  },
  "& p": {
    margin: 0,
  },
  "& p + p, & ul, & ol": {
    marginTop: theme.spacing(0.5),
  },
  "& h1, & h2, & h3": {
    margin: theme.spacing(1.5, 0, 0.5),
    lineHeight: 1.3,
  },
  "& h1": { fontSize: "1.5rem" },
  "& h2": { fontSize: "1.3rem" },
  "& h3": { fontSize: "1.15rem" },
}));

/** DOMPurify's default URI allow-list plus qortal:, so qortal links written as links keep their href. */
const ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|qortal):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

/** Quill never writes these. <style> would restyle the whole app; forms and image-map areas navigate this frame. */
const FORBIDDEN_TAGS = ["style", "form", "input", "button", "select", "option", "optgroup", "textarea", "datalist", "map", "area"];

/** Inline declarations that would override the theme's text and paper colours. */
const THEME_OWNED_STYLE = /^(?:color|-webkit-text-fill-color|background(?:-.+)?)$/;

/**
 * Text pasted into the composer keeps the colours of the page it came from:
 * white text is blank on the light themes and black headings vanish on
 * Black. The theme colours the body, so drop those declarations and keep
 * the rest (bold, underline, size…).
 */
function dropInlineColours(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    for (let i = el.style.length - 1; i >= 0; i--) {
      const name = el.style[i];
      if (THEME_OWNED_STYLE.test(name)) el.style.removeProperty(name);
    }
    if (el.style.length === 0) el.removeAttribute("style");
  });
}

/** The absolute URL of a link to another web site, or null. */
function webLinkUrl(href: string): string | null {
  try {
    const url = new URL(href, window.location.href);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin) return url.href;
  } catch {
    // not a URL
  }
  return null;
}

type CopyKind = "web" | "mail" | "phone";

const COPY_TEXT: Record<CopyKind, { title: string; copied: string; failed: (text: string) => string }> = {
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

/**
 * What a link copies instead of opening: a web link its absolute URL, a
 * mailto: or tel: link its address (no scheme, no ?subject=…). Null for any
 * other link, or a mailto:/tel: link with no address.
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

/**
 * Decides what each link in a body may do:
 *
 * - qortal:// links stay; q-apps.js routes them, but only the lower-case scheme.
 * - Web, mail and phone links are marked, and DisplayHtml copies them on
 *   click instead: Core's q-apps.js swallows clicks on http(s) links in
 *   every Q-App, Hub can't open web pages, and Hub's frame sandbox (no
 *   allow-popups or allow-top-navigation) blocks mailto: and tel:.
 * - Any other link becomes its text. A relative or same-origin link would
 *   load another page of the node, such as another Q-App, inside this
 *   frame, and Hub would still treat that page as Q-Mail+. A link with no
 *   href left (Quill stores qortal: links as about:blank) becomes text too,
 *   so a qortal:// URL in it is linkified afterwards.
 */
export type LinkDecision =
  | { kind: "qortal"; href: string }
  | { kind: "copy"; copy: { kind: CopyKind; text: string } }
  | { kind: "text" };

/** The link policy below as a pure decision, shared with the legacy Slate renderer. */
export function linkPolicy(href: string): LinkDecision {
  if (/^qortal:\/\//i.test(href)) return { kind: "qortal", href: `qortal://${href.slice("qortal://".length)}` };
  const target = copyTarget(href);
  return target ? { kind: "copy", copy: target } : { kind: "text" };
}

function settleLinks(root: ParentNode): void {
  root.querySelectorAll("a").forEach((a) => {
    const decision = linkPolicy(a.getAttribute("href") ?? "");
    if (decision.kind === "qortal") {
      a.setAttribute("href", decision.href);
      return;
    }
    if (decision.kind === "text") {
      a.replaceWith(...a.childNodes);
      return;
    }
    const target = decision.copy;
    if (target.kind === "web") a.setAttribute("href", target.text);
    a.setAttribute("data-copy-link", "");
    a.setAttribute("title", COPY_TEXT[target.kind].title);
    a.removeAttribute("target");
  });
}

/**
 * Makes a stored message body safe to show. After DOMPurify every change is
 * made on DOM nodes and the result is only serialised at the end.
 */
export function sanitizeMessageHtml(html: string | null | undefined): string {
  if (!html) return "";
  const source = toQuill1Html(html);
  if (!source) return "";
  const fragment: DocumentFragment = DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: ALLOWED_URI,
    // <font color> and <td bgcolor> are the old way of doing the same.
    // data-copy-link is the app's own marker: a sender who sets it would
    // turn a qortal:// link into one that copies itself.
    FORBID_ATTR: ["color", "bgcolor", "data-copy-link"],
    FORBID_TAGS: FORBIDDEN_TAGS,
    RETURN_DOM_FRAGMENT: true,
  });
  dropInlineColours(fragment);
  settleLinks(fragment);
  linkifyQortalText(fragment);
  // Serialise in DOMPurify's inert document, so nothing loads before render.
  const box = fragment.ownerDocument.createElement("div");
  box.append(fragment);
  return box.innerHTML;
}

export const DisplayHtml = ({ html, textColor }: { html?: string | null; textColor?: string }) => {
  const dispatch = useDispatch();
  const cleanContent = useMemo(() => sanitizeMessageHtml(html), [html]);

  // qortal:// links keep their default: q-apps.js routes them in Hub.
  const copyLink = async (event: MouseEvent<HTMLDivElement>) => {
    const link = event.target instanceof Element ? event.target.closest("a[data-copy-link]") : null;
    const target = link ? copyTarget(link.getAttribute("href") ?? "") : null;
    if (!target) return;
    event.preventDefault();
    const messages = COPY_TEXT[target.kind];
    const copied = await copyText(target.text);
    dispatch(
      setNotification(
        copied ? { msg: messages.copied, alertType: "success" } : { msg: messages.failed(target.text), alertType: "error" }
      )
    );
  };

  if (!cleanContent) return null;
  return (
    <Body sx={textColor ? { color: textColor } : undefined} onClick={copyLink}>
      <div className="ql-editor-display" dangerouslySetInnerHTML={{ __html: cleanContent }} />
    </Body>
  );
};
