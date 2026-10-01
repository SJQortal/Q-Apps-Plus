import React, { useId, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import './texteditor.css'

interface TextEditorProps {
  inlineContent: string
  setInlineContent: (value: string) => void
  className?: string
  placeholder?: string
  autoFocus?: boolean
  focusToken?: string | number | null
}

/**
 * The composer's editor. The toolbar is our own markup (Quill attaches to the
 * `ql-*` controls inside the container we point it at), in two rows: the
 * everyday controls, and a "More formatting" row with everything the
 * original app offered (headings, sub/superscript, indent, direction, size,
 * colours, font, alignment) that stays hidden until asked for, so the bar
 * fits a 360 px screen without scrolling sideways.
 */
export const TextEditor = ({
  inlineContent,
  setInlineContent,
  className,
  placeholder,
  autoFocus = false,
  focusToken = null,
}: TextEditorProps) => {
  const quillRef = useRef<ReactQuill | null>(null);
  const reactId = useId();
  const toolbarId = useMemo(() => `qmail-toolbar-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const [moreOpen, setMoreOpen] = useState(false);

  const modules = useMemo(() => {
    return {
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
      toolbar: {
        container: `#${toolbarId}`,
      },
    };
  }, [toolbarId]);

  React.useEffect(() => {
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

  const control = (cls: string, title: string, value?: string) => (
    <button type="button" className={cls} value={value} title={title} aria-label={title} />
  );

  return (
    <div className={`qmail-editor-root${className ? ` ${className}` : ""}`}>
      <div id={toolbarId} className="qmail-toolbar">
        <div className="qmail-toolbar-row">
          <span className="ql-formats">
            {control("ql-bold", "Bold")}
            {control("ql-italic", "Italic")}
            {control("ql-underline", "Underline")}
            {control("ql-strike", "Strikethrough")}
          </span>
          <span className="ql-formats">
            {control("ql-blockquote", "Quote")}
            {control("ql-code-block", "Code block")}
          </span>
          <span className="ql-formats">
            {control("ql-list", "Numbered list", "ordered")}
            {control("ql-list", "Bullet list", "bullet")}
          </span>
          <span className="ql-formats">
            {control("ql-clean", "Clear formatting")}
          </span>
          <span className="ql-formats qmail-toolbar-more-toggle">
            <button
              type="button"
              className={`qmail-more-button${moreOpen ? " is-open" : ""}`}
              onClick={() => setMoreOpen(open => !open)}
              aria-expanded={moreOpen}
              aria-controls={`${toolbarId}-more`}
              title={moreOpen ? "Fewer formatting options" : "More formatting options"}
              aria-label={moreOpen ? "Fewer formatting options" : "More formatting options"}
            >
              {moreOpen ? "Less" : "More"}
            </button>
          </span>
        </div>
        <div
          id={`${toolbarId}-more`}
          className={`qmail-toolbar-row qmail-toolbar-more${moreOpen ? " is-open" : ""}`}
        >
          <span className="ql-formats">
            {control("ql-header", "Heading 1", "1")}
            {control("ql-header", "Heading 2", "2")}
          </span>
          <span className="ql-formats">
            {control("ql-script", "Subscript", "sub")}
            {control("ql-script", "Superscript", "super")}
          </span>
          <span className="ql-formats">
            {control("ql-indent", "Outdent", "-1")}
            {control("ql-indent", "Indent", "+1")}
          </span>
          <span className="ql-formats">
            {control("ql-direction", "Right-to-left text", "rtl")}
          </span>
          <span className="ql-formats">
            <select className="ql-size" title="Text size" aria-label="Text size" defaultValue="">
              <option value="small" />
              <option value="" />
              <option value="large" />
              <option value="huge" />
            </select>
            <select className="ql-header" title="Heading level" aria-label="Heading level" defaultValue="">
              <option value="1" />
              <option value="2" />
              <option value="3" />
              <option value="4" />
              <option value="5" />
              <option value="6" />
              <option value="" />
            </select>
          </span>
          <span className="ql-formats">
            <select className="ql-color" title="Text color" aria-label="Text color" />
            <select className="ql-background" title="Highlight color" aria-label="Highlight color" />
          </span>
          <span className="ql-formats">
            <select className="ql-font" title="Font family" aria-label="Font family" />
            <select className="ql-align" title="Alignment" aria-label="Alignment" />
          </span>
        </div>
      </div>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={inlineContent}
        onChange={setInlineContent}
        modules={modules}
        placeholder={placeholder}
      />
    </div>
  );
};
