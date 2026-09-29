import React, { useEffect, useMemo, useRef } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import ImageResize from "quill-image-resize-module-react";
import './texteditor.css'
Quill.register("modules/imageResize", ImageResize);

interface TextEditorProps {
  inlineContent: string
  setInlineContent: (value: string) => void
  className?: string
  placeholder?: string
  autoFocus?: boolean
  focusToken?: string | number | null
}

export const TextEditor = ({
  inlineContent,
  setInlineContent,
  className,
  placeholder,
  autoFocus = false,
  focusToken = null,
}: TextEditorProps) => {
  const quillRef = useRef<ReactQuill | null>(null);

  const modules = useMemo(() => {
    return {
      imageResize: {
        parchment: Quill.import("parchment"),
        modules: ["Resize", "DisplaySize"],
      },
      keyboard: {
        bindings: {
          // When replying with quoted content, Enter should create a normal line
          // instead of continuing the quote style.
          exitQuoteOnEnter: {
            key: "Enter",
            shiftKey: false,
            collapsed: true,
            format: ["blockquote"],
            handler(this: any, range: any, context: any) {
              const [line, offset] = this.quill.getLine(range.index);
              const lineLength =
                line && typeof line.length === "function" ? line.length() : 0;
              const atLineEnd = lineLength > 0 && offset >= lineLength - 1;
              const shouldExitQuote = Boolean(context?.empty || atLineEnd);

              if (!shouldExitQuote) return true;

              this.quill.insertText(range.index, "\n", "user");
              this.quill.setSelection(range.index + 1, "silent");
              this.quill.format("blockquote", false, "user");
              return false;
            },
          },
        },
      },
      toolbar: [
        ["bold", "italic", "underline", "strike"],
        ["blockquote", "code-block"],
        [{ header: 1 }, { header: 2 }],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ script: "sub" }, { script: "super" }],
        [{ indent: "-1" }, { indent: "+1" }],
        [{ direction: "rtl" }],
        [{ size: ["small", false, "large", "huge"] }],
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ color: [] }, { background: [] }],
        [{ font: [] }],
        [{ align: [] }],
        ["clean"],
      ],
    };
  }, []);

  useEffect(() => {
    const editor = quillRef.current?.getEditor();
    const toolbar = editor?.getModule("toolbar")?.container as
      | HTMLElement
      | undefined;
    if (!toolbar) return;

    const controlTitles: Array<[string, string]> = [
      [".ql-bold", "Bold"],
      [".ql-italic", "Italic"],
      [".ql-underline", "Underline"],
      [".ql-strike", "Strikethrough"],
      [".ql-blockquote", "Quote"],
      [".ql-code-block", "Code block"],
      [".ql-header[value=\"1\"]", "Heading 1"],
      [".ql-header[value=\"2\"]", "Heading 2"],
      [".ql-list[value=\"ordered\"]", "Numbered list"],
      [".ql-list[value=\"bullet\"]", "Bullet list"],
      [".ql-script[value=\"sub\"]", "Subscript"],
      [".ql-script[value=\"super\"]", "Superscript"],
      [".ql-indent[value=\"-1\"]", "Outdent"],
      [".ql-indent[value=\"+1\"]", "Indent"],
      [".ql-direction[value=\"rtl\"]", "Right-to-left text"],
      [".ql-clean", "Clear formatting"],
      [".ql-size .ql-picker-label", "Text size"],
      [".ql-header.ql-picker .ql-picker-label", "Heading level"],
      [".ql-color .ql-picker-label", "Text color"],
      [".ql-background .ql-picker-label", "Highlight color"],
      [".ql-font .ql-picker-label", "Font family"],
      [".ql-align .ql-picker-label", "Alignment"],
    ];

    controlTitles.forEach(([selector, title]) => {
      const nodes = toolbar.querySelectorAll<HTMLElement>(selector);
      nodes.forEach((node) => {
        node.setAttribute("title", title);
        node.setAttribute("aria-label", title);
      });
    });
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    const focusEditor = window.setTimeout(() => {
      editor.focus();
      editor.setSelection(0, 0, "silent");
    }, 0);

    return () => {
      window.clearTimeout(focusEditor);
    };
  }, [autoFocus, focusToken]);

  return (
    <ReactQuill
      ref={quillRef}
      className={className}
      theme="snow"
      value={inlineContent}
      onChange={setInlineContent}
      modules={modules}
      placeholder={placeholder}
    />
  );
};
