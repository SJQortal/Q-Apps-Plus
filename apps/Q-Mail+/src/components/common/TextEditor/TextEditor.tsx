import React, { useId, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import './texteditor.css'
import { watchQuillPickers } from './pickerA11y'

interface TextEditorProps {
  inlineContent: string
  /**
   * The editor's HTML (its own markup, `root.innerHTML`, with plain spaces;
   * `toPublishedMailHtml` turns it into the Quill 1 shape before publishing)
   * and who changed it: "user" for typing and toolbar use, "api" when a new
   * `inlineContent` was loaded and Quill normalised it.
   */
  setInlineContent: (value: string, source?: string) => void
  className?: string
  placeholder?: string
  autoFocus?: boolean
  focusToken?: string | number | null
  /**
   * Files dropped on the editor go here (the composers attach them) instead
   * of Quill's uploader, which put PNG and JPEG inline as base64 and dropped
   * every other file silently. Pasted images stay inline, as in Q-Mail.
   */
  onDropFiles?: (files: File[]) => void
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
  onDropFiles,
}: TextEditorProps) => {
  const quillRef = useRef<ReactQuill | null>(null);
  const reactId = useId();
  const toolbarId = useMemo(() => `qmail-toolbar-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const carriesFiles = (event: React.DragEvent) => Array.from(event.dataTransfer?.types || []).includes("Files");

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

  // Quill's pickers come without accessible names; add them (pickerA11y.ts).
  React.useEffect(() => {
    const toolbar = document.getElementById(toolbarId);
    if (!toolbar) return;
    return watchQuillPickers(toolbar);
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
    <div
      className={`qmail-editor-root${className ? ` ${className}` : ""}`}
      onDragEnterCapture={event => {
        if (onDropFiles && carriesFiles(event)) setDraggingFiles(true);
      }}
      onDragOverCapture={event => {
        if (onDropFiles && carriesFiles(event)) event.preventDefault();
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggingFiles(false);
      }}
      onDropCapture={event => {
        setDraggingFiles(false);
        const files = Array.from(event.dataTransfer?.files || []);
        if (!onDropFiles || !files.length) return;
        // Before Quill's own drop handler on the editor below.
        event.preventDefault();
        event.stopPropagation();
        onDropFiles(files);
      }}
    >
      {draggingFiles && (
        <div className="qmail-editor-drop" aria-hidden="true">
          Drop to attach
        </div>
      )}
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
        onChange={(html, _delta, source) => setInlineContent(html, source)}
        // Quill 2's getSemanticHTML() writes every space as &nbsp; and an
        // empty line as <p></p>; the editor's own HTML is what Quill 1 (the
        // original Q-Mail) publishes, plus list/code markup quillHtml.ts maps.
        useSemanticHTML={false}
        modules={modules}
        placeholder={placeholder}
      />
    </div>
  );
};
