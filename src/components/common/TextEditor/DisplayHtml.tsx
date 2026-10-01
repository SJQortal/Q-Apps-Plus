/**
 * Renders a message body (Quill HTML, normalised to the Quill 1 shape and
 * sanitised) with sane typography in all four themes. Images, video and
 * tables fit the pane width and nothing scrolls sideways (UX #11a).
 */
import { useMemo } from "react";
import DOMPurify from "dompurify";
import "react-quill-new/dist/quill.snow.css";
import "react-quill-new/dist/quill.core.css";
import "react-quill-new/dist/quill.bubble.css";
import { convertQortalLinks } from "./utils";
import { toQuill1Html } from "./quillHtml";
import { Box, styled } from "@mui/material";

const Body = styled(Box)(({ theme }) => ({
  display: "block",
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
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
  "& img, & video, & iframe, & embed": {
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

export const DisplayHtml = ({ html, textColor }: { html?: string | null; textColor?: string }) => {
  const cleanContent = useMemo(() => {
    if (!html) return null;
    const sanitize: string = DOMPurify.sanitize(toQuill1Html(html), {
      USE_PROFILES: { html: true },
    });
    const anchorQortal = convertQortalLinks(sanitize);
    return anchorQortal;
  }, [html]);

  if (!cleanContent) return null;
  return (
    <Body sx={textColor ? { color: textColor } : undefined}>
      <div className="ql-editor-display" dangerouslySetInnerHTML={{ __html: cleanContent }} />
    </Body>
  );
};
