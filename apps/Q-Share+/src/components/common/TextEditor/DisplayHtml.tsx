import { useMemo } from "react";
import DOMPurify from "dompurify";
import { styled } from "@mui/material/styles";
import { linkifyQortalText } from "./utils";
import { normalizeQuillHtml } from "../../../utils/quillHtml";

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
    RETURN_DOM_FRAGMENT: true,
  });
  // A link that lost its href (Quill stores qortal: links as about:blank) is
  // only text now: unwrap it, so a qortal:// URL in it becomes a real link.
  fragment.querySelectorAll("a:not([href])").forEach((a) => a.replaceWith(...a.childNodes));
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
  const cleanContent = useMemo(() => sanitizeDescription(html), [html]);

  if (!cleanContent) return null;
  return <RichText dangerouslySetInnerHTML={{ __html: cleanContent }} />;
};
