import { Box } from "@mui/material";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import type { TextEditorProps } from "./TextEditor";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";

// Quill 2 has no maintained image-resize module; the toolbar never offered an
// image button, so the old quill-image-resize-module-react is dropped.
const modules = {
  toolbar: [
    ["bold", "italic", "underline", "strike"], // styled text
    ["blockquote", "code-block"], // blocks
    [{ header: 1 }, { header: 2 }], // custom button values
    [{ list: "ordered" }, { list: "bullet" }], // lists
    [{ script: "sub" }, { script: "super" }], // superscript/subscript
    [{ indent: "-1" }, { indent: "+1" }], // outdent/indent
    [{ direction: "rtl" }], // text direction
    [{ size: ["small", false, "large", "huge"] }], // custom dropdown
    [{ header: [1, 2, 3, 4, 5, 6, false] }], // custom button values
    [{ color: [] }, { background: [] }], // dropdown with defaults
    [{ font: [] }], // font family
    [{ align: [] }], // text align
    ["clean"], // remove formatting
  ],
};

/**
 * On phones the toolbar is one row of nine 40 px buttons. Only the buttons
 * change: every format still renders and survives editing, and the desktop
 * toolbar is one rotation away.
 */
const phoneModules = {
  toolbar: [
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "code-block"],
    ["clean"],
  ],
};

/**
 * The value handed back is the editor's raw innerHTML as-is (the component
 * compares it with the next `value` prop, so it must round-trip untouched).
 * Quill 2.0.3's getSemanticHTML() loses the text of code blocks, so the
 * semantic mode is switched off; `normalizeQuillHtml` turns the raw markup
 * into the Quill 1 shape before it is stored on QDN.
 *
 * The wrapper re-colours quill.snow.css (which hard-codes greys and black
 * icons) from the theme, wraps the toolbar on narrow screens and gives the
 * editor a usable minimum height.
 */
export default function TextEditorQuill({ inlineContent, setInlineContent, placeholder }: TextEditorProps) {
  const phone = usePhoneLayout();
  return (
    <Box
      sx={(theme) => ({
        width: "100%",
        ...(phone && {
          "& .ql-toolbar.ql-snow button": { width: 40, height: 40, padding: "8px" },
          "& .ql-toolbar.ql-snow .ql-formats": { marginRight: "4px" },
        }),
        "& .ql-toolbar.ql-snow": {
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "4px 0",
          padding: "6px 8px",
          borderColor: theme.palette.divider,
          borderTopLeftRadius: theme.shape.borderRadius,
          borderTopRightRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.background.paper,
        },
        "& .ql-toolbar.ql-snow .ql-formats": { marginRight: "10px" },
        "& .ql-container.ql-snow": {
          borderColor: theme.palette.divider,
          borderBottomLeftRadius: theme.shape.borderRadius,
          borderBottomRightRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.background.paper,
          fontFamily: theme.typography.fontFamily,
        },
        "& .ql-editor": {
          minHeight: 140,
          fontSize: 16,
          lineHeight: 1.5,
          color: theme.palette.text.primary,
        },
        "& .ql-editor.ql-blank::before": {
          color: theme.palette.text.secondary,
          fontStyle: "normal",
        },
        "& .ql-snow .ql-stroke": { stroke: theme.palette.text.primary },
        "& .ql-snow .ql-fill, & .ql-snow .ql-stroke.ql-fill": { fill: theme.palette.text.primary },
        "& .ql-snow .ql-picker": { color: theme.palette.text.primary },
        "& .ql-snow .ql-picker-options": {
          backgroundColor: theme.palette.background.paper,
          borderColor: theme.palette.divider,
        },
        "& .ql-snow.ql-toolbar button:hover .ql-stroke, & .ql-snow.ql-toolbar button.ql-active .ql-stroke, & .ql-snow .ql-picker-label:hover .ql-stroke, & .ql-snow .ql-picker-item:hover .ql-stroke, & .ql-snow .ql-picker-label.ql-active .ql-stroke":
          { stroke: theme.palette.primary.main },
        "& .ql-snow.ql-toolbar button:hover .ql-fill, & .ql-snow.ql-toolbar button.ql-active .ql-fill, & .ql-snow .ql-picker-label:hover .ql-fill, & .ql-snow .ql-picker-label.ql-active .ql-fill":
          { fill: theme.palette.primary.main },
        "& .ql-snow.ql-toolbar button:hover, & .ql-snow.ql-toolbar button.ql-active, & .ql-snow .ql-picker-label:hover, & .ql-snow .ql-picker-label.ql-active, & .ql-snow .ql-picker-item:hover, & .ql-snow .ql-picker-item.ql-selected":
          { color: theme.palette.primary.main },
        "& .ql-snow.ql-toolbar button:focus-visible": {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 1,
        },
        "& .ql-snow .ql-tooltip": {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderColor: theme.palette.divider,
          boxShadow: theme.shadows[3],
        },
        "& .ql-snow .ql-editor pre.ql-syntax": {
          backgroundColor: theme.palette.action.hover,
          color: theme.palette.text.primary,
        },
      })}
    >
      <ReactQuill
        key={phone ? "phone" : "desktop"}
        theme="snow"
        value={inlineContent}
        onChange={setInlineContent}
        useSemanticHTML={false}
        modules={phone ? phoneModules : modules}
        placeholder={placeholder}
      />
    </Box>
  );
}
