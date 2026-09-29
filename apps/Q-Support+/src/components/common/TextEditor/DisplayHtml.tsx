import { useMemo } from "react";
import DOMPurify from "dompurify";
import { alpha, styled } from "@mui/material/styles";
import { convertQortalLinks } from "./utils";

const INDENT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Renders issue and comment HTML written by Quill 1 (the original Q-Support)
 * or Quill 2 (this app) without loading Quill's stylesheets: both list forms,
 * both code-block forms, and the ql-* alignment, indent, size, font and
 * direction classes.
 */
const RichText = styled("div")(({ theme }) => ({
  width: "100%",
  minWidth: 0,
  fontSize: 16,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
  color: theme.palette.text.primary,
  "& p, & h1, & h2, & h3, & h4, & h5, & h6, & ol, & ul, & pre, & blockquote": {
    margin: 0,
    padding: 0,
  },
  "& h1": { fontSize: "2em", lineHeight: 1.2 },
  "& h2": { fontSize: "1.5em", lineHeight: 1.25 },
  "& h3": { fontSize: "1.17em" },
  "& h4": { fontSize: "1em" },
  "& h5": { fontSize: "0.83em" },
  "& h6": { fontSize: "0.67em" },
  "& ol, & ul": { paddingLeft: "1.5em" },
  "& ul": { listStyleType: "disc" },
  "& ol": { listStyleType: "decimal" },
  "& li[data-list='bullet']": { listStyleType: "disc" },
  "& li[data-list='ordered']": { listStyleType: "decimal" },
  "& ul[data-checked] > li, & li[data-list='checked'], & li[data-list='unchecked']": {
    listStyleType: "none",
    marginLeft: "-1.2em",
  },
  "& ul[data-checked='true'] > li::before, & li[data-list='checked']::before": {
    content: "'\\2611 '",
  },
  "& ul[data-checked='false'] > li::before, & li[data-list='unchecked']::before": {
    content: "'\\2610 '",
  },
  "& .ql-ui": { display: "none" },
  ...Object.fromEntries(
    INDENT_LEVELS.flatMap((level) => [
      [`& .ql-indent-${level}:not(.ql-direction-rtl)`, { paddingLeft: `${3 * level}em` }],
      [`& li.ql-indent-${level}:not(.ql-direction-rtl)`, { paddingLeft: 0, marginLeft: `${3 * level}em` }],
      [`& .ql-indent-${level}.ql-direction-rtl`, { paddingRight: `${3 * level}em` }],
      [`& li.ql-indent-${level}.ql-direction-rtl`, { paddingRight: 0, marginRight: `${3 * level}em` }],
    ])
  ),
  "& .ql-direction-rtl": { direction: "rtl", textAlign: "inherit" },
  "& .ql-align-center": { textAlign: "center" },
  "& .ql-align-right": { textAlign: "right" },
  "& .ql-align-justify": { textAlign: "justify" },
  "& .ql-size-small": { fontSize: "0.75em" },
  "& .ql-size-large": { fontSize: "1.5em" },
  "& .ql-size-huge": { fontSize: "2.5em" },
  "& .ql-font-serif": { fontFamily: "Georgia, 'Times New Roman', serif" },
  "& .ql-font-monospace": { fontFamily: "Monaco, 'Courier New', monospace" },
  "& blockquote": {
    borderLeft: `4px solid ${theme.palette.divider}`,
    margin: "5px 0",
    paddingLeft: 16,
  },
  "& pre.ql-syntax, & .ql-code-block-container": {
    backgroundColor: alpha(theme.palette.text.primary, 0.08),
    borderRadius: theme.shape.borderRadius,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: "0.9em",
    margin: "5px 0",
    overflowX: "auto",
    padding: "6px 10px",
    whiteSpace: "pre-wrap",
  },
  "& .ql-code-block": { display: "block" },
  "& code": {
    backgroundColor: alpha(theme.palette.text.primary, 0.08),
    borderRadius: 3,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: "0.9em",
    padding: "1px 4px",
  },
  "& img": { maxWidth: "100%", height: "auto" },
  "& iframe, & video": { maxWidth: "100%" },
  "& a": { color: theme.palette.primary.main },
}));

export const DisplayHtml = ({ html }: { html: string }) => {
  const cleanContent = useMemo(() => {
    if (!html) return null;

    const sanitize: string = DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
    });
    const anchorQortal = convertQortalLinks(sanitize);
    return anchorQortal;
  }, [html]);

  if (!cleanContent) return null;
  return <RichText dangerouslySetInnerHTML={{ __html: cleanContent }} />;
};
