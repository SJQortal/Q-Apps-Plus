import { useMemo, type MouseEvent } from "react";
import { useDispatch } from "react-redux";
import DOMPurify from "dompurify";
import { styled } from "@mui/material/styles";
import { linkifyQortalText } from "./utils";
import { normalizeQuillHtml } from "../../../utils/quillHtml";
import { copyText } from "../../../utils/clipboard";
import { setNotification } from "../../../state/features/notificationsSlice";

/**
 * Renders a stored `htmlDescription` with the app's own styles instead of
 * Quill's editor stylesheet, so markup written by Quill 1 (the original
 * Q-Share) and Quill 2 (this app) both read the same way in all themes.
 */
const RichText = styled("div")(({ theme }) => {
  const indent: Record<string, object> = {};
  for (let level = 1; level <= 8; level++) {
    indent[`& .ql-indent-${level}:not(li)`] = { paddingLeft: `${level * 3}em` };
    indent[`& li.ql-indent-${level}`] = { marginLeft: `${level * 1.5}em` };
  }
  return {
    width: "100%",
    minWidth: 0,
    // Anyone can publish a description: keep position: fixed content (or a
    // class borrowed from the app) painted inside this box, not over the app.
    contain: "paint",
    fontSize: 16,
    lineHeight: 1.5,
    color: theme.palette.text.primary,
    wordBreak: "break-word",
    "& > *": { margin: 0 },
    "& > * + *": { marginTop: theme.spacing(0.5) },
    "& h1": { fontSize: "1.75em", lineHeight: 1.25 },
    "& h2": { fontSize: "1.5em", lineHeight: 1.25 },
    "& h3": { fontSize: "1.25em" },
    "& h4, & h5, & h6": { fontSize: "1em" },
    "& ul, & ol": { paddingLeft: "1.5em" },
    "& ul": { listStyle: "disc" },
    "& ol": { listStyle: "decimal" },
    "& ul[data-checked] > li": { listStyle: "none", position: "relative" },
    "& ul[data-checked] > li::before": {
      position: "absolute",
      left: "-1.5em",
      content: '"\\2610"',
    },
    '& ul[data-checked="true"] > li::before': { content: '"\\2611"' },
    "& blockquote": {
      borderLeft: `4px solid ${theme.palette.divider}`,
      margin: 0,
      paddingLeft: theme.spacing(2),
      color: theme.palette.text.secondary,
    },
    "& pre": {
      background: theme.palette.action.hover,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(1, 1.5),
      whiteSpace: "pre-wrap",
      overflowX: "auto",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: "0.875em",
    },
    "& code": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
    "& img": { maxWidth: "100%", height: "auto", borderRadius: theme.shape.borderRadius },
    "& a": { color: theme.palette.primary.main, wordBreak: "break-all" },
    // Web, mail and phone links copy themselves (see DisplayHtml); the arrow says they leave Qortal.
    "& a[data-copy-link]": { cursor: "copy" },
    "& a[data-copy-link]::after": {
      // The second value gives the arrow empty alt text, so screen readers skip it.
      content: ['"\\2197"', '"\\2197" / ""'],
      display: "inline-block",
      marginLeft: "0.15em",
      fontSize: "0.85em",
    },
    "& .ql-align-center": { textAlign: "center" },
    "& .ql-align-right": { textAlign: "right" },
    "& .ql-align-justify": { textAlign: "justify" },
    "& .ql-direction-rtl": { direction: "rtl" },
    "& .ql-size-small": { fontSize: "0.75em" },
    "& .ql-size-large": { fontSize: "1.5em" },
    "& .ql-size-huge": { fontSize: "2.5em" },
    "& .ql-font-serif": { fontFamily: "Georgia, 'Times New Roman', serif" },
    "& .ql-font-monospace": { fontFamily: "Monaco, 'Courier New', monospace" },
    ...indent,
  };
});

/** DOMPurify's default URI allow-list plus qortal:, so qortal links written as links keep their href. */
const ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|qortal):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

const DESCRIPTION_FORBIDDEN_TAGS = [
  "style",
  "form",
  "input",
  "button",
  "select",
  "option",
  "optgroup",
  "textarea",
  "datalist",
  "map",
  "area",
];

/** Inline declarations that would override the theme's text and paper colours. */
const THEME_OWNED_STYLE = /^(?:color|-webkit-text-fill-color|background(?:-.+)?)$/;

/**
 * Text pasted into the editor keeps the colours of the page it came from:
 * real shares have white text (blank on Hub 3.0 Light) and black headings
 * (gone on Black). The theme colours descriptions, so drop those
 * declarations and keep the rest (bold, underline, size…).
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
function copyTarget(href: string): { kind: CopyKind; text: string } | null {
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
 * Decides what each link in a description may do:
 *
 * - qortal:// links stay; q-apps.js routes them, but only the lower-case scheme.
 * - Web, mail and phone links are marked, and DisplayHtml copies them on
 *   click instead: Core's q-apps.js swallows clicks on http(s) links in
 *   every Q-App, Hub can't open web pages, and Hub's frame sandbox (no
 *   allow-popups or allow-top-navigation) blocks mailto: and tel:.
 * - Any other link becomes its text. A relative or same-origin link would
 *   load another page of the node, such as another Q-App, inside this
 *   frame, and Hub would still treat that page as Q-Share+. A link with no
 *   href left (Quill stores qortal: links as about:blank) becomes text too,
 *   so a qortal:// URL in it is linkified afterwards.
 */
function settleLinks(root: ParentNode): void {
  root.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    if (/^qortal:\/\//i.test(href)) {
      a.setAttribute("href", `qortal://${href.slice("qortal://".length)}`);
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

/**
 * Makes a stored `htmlDescription` safe to show. Anyone can publish one, so
 * after DOMPurify every change is made on DOM nodes and the result is only
 * serialised at the end; nothing is pasted into an HTML string.
 */
export function sanitizeDescription(html: string | null | undefined): string {
  const source = normalizeQuillHtml(html);
  if (!source) return "";
  const fragment: DocumentFragment = DOMPurify.sanitize(source, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: ALLOWED_URI,
    // <font color> and <td bgcolor> are the old way of doing the same.
    // data-copy-link is the app's own marker: a publisher who sets it would
    // turn a qortal:// link into one that copies itself.
    FORBID_ATTR: ["color", "bgcolor", "data-copy-link"],
    // Quill never writes these. <style> would restyle the whole app, forms
    // and image-map areas navigate this frame.
    FORBID_TAGS: DESCRIPTION_FORBIDDEN_TAGS,
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

interface DisplayHtmlProps {
  html: string | null | undefined;
}

export const DisplayHtml = ({ html }: DisplayHtmlProps) => {
  const dispatch = useDispatch();
  const cleanContent = useMemo(() => sanitizeDescription(html), [html]);

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
  return <RichText onClick={copyLink} dangerouslySetInnerHTML={{ __html: cleanContent }} />;
};
