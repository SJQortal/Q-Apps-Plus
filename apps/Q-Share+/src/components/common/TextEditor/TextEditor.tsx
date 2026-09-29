import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

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

interface TextEditorProps {
  inlineContent: string;
  setInlineContent: (value: string) => void;
}

/**
 * The value handed back is the editor's raw innerHTML as-is (the component
 * compares it with the next `value` prop, so it must round-trip untouched).
 * Quill 2.0.3's getSemanticHTML() loses the text of code blocks, so the
 * semantic mode is switched off; `normalizeQuillHtml` turns the raw markup
 * into the Quill 1 shape before it is stored on QDN.
 */
export const TextEditor = ({ inlineContent, setInlineContent }: TextEditorProps) => {
  return (
    <ReactQuill
      theme="snow"
      value={inlineContent}
      onChange={setInlineContent}
      useSemanticHTML={false}
      modules={modules}
    />
  );
};
