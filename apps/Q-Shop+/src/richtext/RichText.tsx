/**
 * A description's formatted text, styled by the theme (after Q-Share+'s
 * DisplayHtml), and what its links do: qortal:// ones open in a new Hub tab
 * (QortalText.tsx useOpenQortalLink); web, mail and phone links copy
 * themselves. Its own module, so a shop's page shows a description written
 * with Markdown without the product page's players.
 */
import type { MouseEvent } from "react";
import { useDispatch } from "react-redux";
import { styled } from "@mui/material/styles";
import { setNotification } from "../state/features/notificationsSlice";
import { copyText } from "../utils/clipboard";
import { COPY_TEXT, copyTarget } from "./sanitize";
import { useOpenQortalLink } from "./QortalText";

export const RichText = styled("div")(({ theme }) => ({
  width: "100%",
  minWidth: 0,
  // Anyone can publish a description: keep anything it positions painted inside this box.
  contain: "paint",
  fontSize: 16,
  lineHeight: 1.6,
  color: theme.palette.text.primary,
  overflowWrap: "anywhere",
  "& > *": { margin: 0 },
  "& > * + *": { marginTop: theme.spacing(0.75) },
  "& h1": { fontSize: "1.5em", lineHeight: 1.25 },
  "& h2": { fontSize: "1.3em", lineHeight: 1.3 },
  "& h3": { fontSize: "1.15em" },
  "& h4, & h5, & h6": { fontSize: "1em" },
  "& ul, & ol": { paddingLeft: "1.5em" },
  "& ul": { listStyle: "disc" },
  "& ol": { listStyle: "decimal" },
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
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "0.875em",
  },
  "& code": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  "& a": { color: theme.palette.primary.main, wordBreak: "break-all" },
  "& a[data-copy-link]": { cursor: "copy" },
  "& a[data-copy-link]::after": { content: ['"\\2197"', '"\\2197" / ""'], display: "inline-block", marginLeft: "0.15em", fontSize: "0.85em" },
  "& .ql-align-center": { textAlign: "center" },
  "& .ql-align-right": { textAlign: "right" },
  "& .ql-align-justify": { textAlign: "justify" },
  "& .ql-size-small": { fontSize: "0.75em" },
  "& .ql-size-large": { fontSize: "1.5em" },
  "& .ql-size-huge": { fontSize: "2em" },
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`& .ql-indent-${i + 1}:not(li)`, { paddingLeft: `${(i + 1) * 3}em` }])),
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`& li.ql-indent-${i + 1}`, { marginLeft: `${(i + 1) * 1.5}em` }])),
}));

/** The click handler for a RichText's links (see above). */
export function useRichTextLinks() {
  const dispatch = useDispatch();
  const openQortal = useOpenQortalLink();
  return async (event: MouseEvent<HTMLDivElement>) => {
    const qortal = event.target instanceof Element ? event.target.closest("a[href]") : null;
    const href = qortal?.getAttribute("href") ?? "";
    if (/^qortal:\/\//i.test(href)) return openQortal(event, href);
    const link = event.target instanceof Element ? event.target.closest("a[data-copy-link]") : null;
    const target = link ? copyTarget(link.getAttribute("href") ?? "") : null;
    if (!target) return;
    event.preventDefault();
    const messages = COPY_TEXT[target.kind];
    const copied = await copyText(target.text);
    dispatch(setNotification(copied ? { msg: messages.copied, alertType: "success" } : { msg: messages.failed(target.text), alertType: "error" }));
  };
}
