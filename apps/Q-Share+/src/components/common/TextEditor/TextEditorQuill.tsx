import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import type { TextEditorProps } from "./TextEditor";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";

// Quill 2 has no maintained image-resize module; the toolbar never offered an
// image button, so the old quill-image-resize-module-react is dropped.
// Quill 2's uploader would turn an image file dropped or pasted into the
// editor into a base64 image inside the description; it is switched off.
// Pasted HTML loses its images and video too (see withoutPastedEmbeds), so
// images come only with descriptions that already have them.
const uploader = { handler: () => {} };

/**
 * Pasted HTML without its <img> and <iframe>. With image and video listed in
 * `formats`, Quill keeps them from a paste as it does from a loaded
 * description, so a copied web page would bring hotlinked images (loaded by
 * every reader from outside Qortal) or data: URIs (a larger body for every
 * row that fetches it). The whole document is kept, as Quill reads markers on
 * it (Word, Google Docs).
 */
function withoutPastedEmbeds(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("img, iframe").forEach((element) => element.remove());
  return doc.documentElement.outerHTML;
}

const modules = {
  uploader,
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
    [{ font: [] }], // font family
    [{ align: [] }], // text align
    ["clean"], // remove formatting
  ],
};

/**
 * Every format except text and highlight colours. A description is read in
 * four themes, light and dark, so a fixed colour (often white text pasted
 * from a dark web page) turns unreadable in half of them; display strips
 * colours too. Leaving them out of `formats` also drops them on paste.
 * Image and video stay, with no toolbar buttons: Quill drops any format not
 * listed when it loads a description, so without them an update would strip
 * the images a description from the original Q-Share has. Pastes still lose
 * them (withoutPastedEmbeds).
 */
const formats = [
  "bold", "italic", "underline", "strike", "code", "link", "script", "size", "font",
  "blockquote", "code-block", "header", "list", "indent", "direction", "align", "image", "video",
];

/**
 * On phones the toolbar is one row of nine 40 px buttons. Only the buttons
 * change: every format still renders and survives editing, and the desktop
 * toolbar is one rotation away.
 */
const phoneModules = {
  uploader,
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
  // Quill 2 names its toolbar buttons but not the dropdown pickers.
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = wrapper.current;
    if (!root) return;
    const names: Record<string, string> = {
      "ql-size": "Text size",
      "ql-header": "Heading level",
      "ql-font": "Font",
      "ql-align": "Alignment",
    };
    root.querySelectorAll<HTMLElement>(".ql-picker").forEach((picker) => {
      const key = Object.keys(names).find((k) => picker.classList.contains(k));
      const label = picker.querySelector<HTMLElement>(".ql-picker-label");
      if (key && label && !label.getAttribute("aria-label")) label.setAttribute("aria-label", names[key]);
    });
  }, [phone]);
  // A paste whose HTML carries images or video is handed to Quill without
  // them; this runs before Quill's own paste handler, which then stands
  // aside. Loading a description is not a paste, so it keeps what it has.
  useEffect(() => {
    const root = wrapper.current;
    if (!root) return;
    const onPaste = (event: ClipboardEvent) => {
      const html = event.clipboardData?.getData("text/html");
      if (!html || !/<(img|iframe)\b/i.test(html)) return;
      const container = root.querySelector(".ql-container");
      const quill = container ? Quill.find(container) : null;
      if (!(quill instanceof Quill) || !quill.isEnabled()) return;
      // A paste into the link tooltip's field is that field's own.
      if (!(event.target instanceof Node) || !quill.root.contains(event.target)) return;
      event.preventDefault();
      quill.clipboard.onPaste(quill.getSelection(true), {
        html: withoutPastedEmbeds(html),
        text: event.clipboardData?.getData("text/plain") ?? "",
      });
    };
    root.addEventListener("paste", onPaste, true);
    return () => root.removeEventListener("paste", onPaste, true);
  }, []);
  return (
    <Box
      ref={wrapper}
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
        formats={formats}
        placeholder={placeholder}
      />
    </Box>
  );
}
