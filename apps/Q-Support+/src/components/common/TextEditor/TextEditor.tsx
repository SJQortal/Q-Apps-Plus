import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import QuillResizeImage from "quill-resize-image";

// Quill 2 replacement for quill-image-resize-module-react (Quill 1 only).
Quill.register("modules/resize", QuillResizeImage as unknown as typeof Quill);

const modules = {
  resize: {
    locale: {},
  },
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
  setInlineContent: (html: string) => void;
}

/**
 * The editor keeps Quill 2's own HTML in state (so typing never re-parses the
 * document). Convert it with `toQuill1Html` from ./quillCompat when publishing.
 */
export const TextEditor = ({ inlineContent, setInlineContent }: TextEditorProps) => {
  return (
    <ReactQuill
      theme="snow"
      value={inlineContent}
      onChange={setInlineContent}
      modules={modules}
      useSemanticHTML={false}
    />
  );
};
