/**
 * The product form's description editor (Simon, 2026-10-22): text
 * formatting, links (qortal:// ones too), and videos and files from Qortal,
 * after Q-Share+'s TextEditorQuill (Quill 2, react-quill-new). Loaded with
 * the product form only (React.lazy), never for buyers.
 *
 * - Pasted text written with Markdown comes in formatted (richtext/markdown.ts),
 *   when the paste carries no formatting of its own (a text editor's copy).
 * - Pasted rich text keeps its formatting: headings, bold, lists, links…
 *   Colours, pictures and other embeds in a paste are dropped (a description
 *   is read in four themes; a pasted picture could load from outside Qortal).
 * - Quill keeps a link only for its allowed schemes; qortal: is added, so a
 *   qortal:// link stays one (Quill wrote about:blank before).
 * - Videos and files are added under the product's pictures
 *   (richtext/MediaFields.tsx, Simon 2026-10-25), not here: the form hands
 *   this editor the text alone (richtext/embeds.ts splitDescription).
 *
 * The value handed back is the editor's own HTML (Quill's raw markup); the
 * draft builders turn it into the stored forms (richtext/plainText.ts).
 * Only the seller's own edits count as changes, not Quill tidying the HTML
 * it was given. The editor keeps its own content (uncontrolled): fed the
 * stored HTML on every render, Quill would load it again each time it
 * writes it differently (lists, blocks), on every key typed elsewhere in the
 * form. `value` is read when the editor mounts (again when a phone turns).
 */
import { useEffect, useMemo, useRef } from "react";
import { Box } from "@mui/material";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { usePhoneLayout } from "../hooks/usePhoneLayout";
import { EMBED_CLASS, embedData, embedFromData, embedLabel, type QortalEmbed } from "./embeds";
import { QORTAL_URL } from "./sanitize";
import { hasFormatting, looksLikeMarkdown, markdownToHtml } from "./markdown";

// ---------------------------------------------------------------- Quill setup (once)

type BlotClass = { create(value?: unknown): HTMLElement; new (...args: never[]): unknown };
const BlockEmbed = Quill.import("blots/block/embed") as unknown as BlotClass;

/** A video or file block: its data in `data-*`, its label as text (richtext/embeds.ts). */
class QortalEmbedBlot extends (BlockEmbed as unknown as { new (...args: never[]): object; create(value?: unknown): HTMLElement }) {
  static blotName = "qortalEmbed";
  static tagName = "div";
  static className = EMBED_CLASS;
  static create(value: QortalEmbed) {
    const node = super.create(value) as HTMLElement;
    const embed = embedFromData(embedData(value));
    if (embed) {
      for (const [key, item] of Object.entries(embedData(embed))) node.dataset[key] = item;
      node.textContent = embedLabel(embed);
    }
    node.setAttribute("contenteditable", "false");
    return node;
  }
  static value(node: HTMLElement) {
    return embedFromData({ ...node.dataset });
  }
}

let registered = false;
function setUpQuill() {
  if (registered) return;
  registered = true;
  Quill.register(QortalEmbedBlot as never, true);
  // qortal:// links stay links (Quill turns any other scheme into about:blank).
  const Link = Quill.import("formats/link") as unknown as { PROTOCOL_WHITELIST: string[] };
  if (!Link.PROTOCOL_WHITELIST.includes("qortal")) Link.PROTOCOL_WHITELIST = [...Link.PROTOCOL_WHITELIST, "qortal"];
}
setUpQuill();

/**
 * Everything a description may be formatted with. Colours are left out (they
 * break in half the themes), and so are pictures and Quill's own video (an
 * iframe): a paste brings none of them.
 */
/** Quill's clipboard matcher: the qortal:// addresses in pasted text as links (after Quill's own text matcher). */
function linkQortalText(_node: Node, delta: { ops: { insert?: unknown; attributes?: Record<string, unknown> }[] }) {
  if (!delta.ops.some((op) => typeof op.insert === "string" && op.insert.includes("qortal://"))) return delta;
  const Delta = Quill.import("delta") as unknown as new () => { insert(text: unknown, attributes?: Record<string, unknown>): unknown };
  const out = new Delta();
  for (const op of delta.ops) {
    if (typeof op.insert !== "string" || op.attributes?.link || !op.insert.includes("qortal://")) {
      out.insert(op.insert, op.attributes);
      continue;
    }
    const text = op.insert;
    let last = 0;
    for (const match of text.matchAll(QORTAL_URL)) {
      const at = match.index ?? 0;
      if (at > last) out.insert(text.slice(last, at), op.attributes);
      out.insert(match[0], { ...op.attributes, link: match[0] });
      last = at + match[0].length;
    }
    if (last < text.length) out.insert(text.slice(last), op.attributes);
  }
  return out;
}

const FORMATS = ["bold", "italic", "underline", "strike", "link", "blockquote", "header", "list", "indent", "align", "qortalEmbed"];

const DESKTOP_TOOLBAR = [
  ["bold", "italic", "underline", "strike"],
  [{ header: 2 }, { header: 3 }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "link"],
  ["clean"],
];
const PHONE_TOOLBAR = [["bold", "italic"], [{ list: "bullet" }], ["link"]];

/** Names for the toolbar's buttons (Quill names them by format, in English or not at all). */
const BUTTON_NAMES: Record<string, string> = {
  "ql-bold": "Bold",
  "ql-italic": "Italic",
  "ql-underline": "Underline",
  "ql-strike": "Strikethrough",
  "ql-blockquote": "Quote",
  "ql-link": "Link (select text first)",
  "ql-clean": "Clear formatting",
};

export interface DescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Labelled by this element (the field's visible label). */
  labelId?: string;
}

export default function DescriptionEditor({ value, onChange, placeholder, labelId }: DescriptionEditorProps) {
  const phone = usePhoneLayout();
  const quillRef = useRef<ReactQuill>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const modules = useMemo(
    () => ({
      toolbar: { container: phone ? PHONE_TOOLBAR : DESKTOP_TOOLBAR },
      // Pasted qortal:// addresses come in as links (Simon, 2026-10-25: "recognized automatically").
      clipboard: { matchVisual: false, matchers: [[Node.TEXT_NODE, linkQortalText]] },
    }),
    [phone]
  );

  // A qortal:// address typed into the text becomes a link once a space or a new line ends it.
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const onText = (delta: { ops: { insert?: unknown; retain?: number }[] }, _old: unknown, source: string) => {
      if (source !== "user") return;
      // Where the space (or new line) went in, from the change itself (the cursor hasn't moved yet).
      let at = 0;
      let typed: string | null = null;
      for (const op of delta.ops) {
        if (typeof op.retain === "number") at += op.retain;
        else if (typeof op.insert === "string") {
          typed = op.insert;
          break;
        }
      }
      if (!typed || !/^\s$/.test(typed) || at === 0) return;
      const from = Math.max(0, at - 300);
      const match = /qortal:\/\/\S+$/.exec(quill.getText(from, at - from));
      const url = match?.[0].match(QORTAL_URL)?.[0];
      if (!match || !url) return;
      const start = at - match[0].length;
      if (quill.getFormat(start, url.length).link) return;
      quill.formatText(start, url.length, "link", url, "user");
    };
    quill.on("text-change", onText as never);
    return () => {
      quill.off("text-change", onText as never);
    };
  }, [phone]);

  // Pasted Markdown as its formatting, through Quill's own paste of HTML (its formats and matchers).
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (!looksLikeMarkdown(text) || hasFormatting(e.clipboardData?.getData("text/html"))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const range = quill.getSelection(true);
      const Delta = Quill.import("delta") as unknown as new () => { retain(n: number): { delete(n: number): { concat(d: unknown): unknown } } };
      const pasted = quill.clipboard.convert({ html: markdownToHtml(text), text });
      quill.updateContents(new Delta().retain(range.index).delete(range.length).concat(pasted) as never, "user");
      quill.setSelection(range.index + pasted.length(), 0, "silent");
      quill.scrollSelectionIntoView();
    };
    quill.root.addEventListener("paste", onPaste, true);
    return () => quill.root.removeEventListener("paste", onPaste, true);
  }, [phone]);

  // Names for the buttons and pickers, and the editor named by the field's label.
  useEffect(() => {
    const root = wrapper.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(".ql-toolbar button").forEach((button) => {
      const key = Array.from(button.classList).find((c) => BUTTON_NAMES[c]);
      if (key) {
        button.setAttribute("aria-label", BUTTON_NAMES[key]);
        button.setAttribute("title", BUTTON_NAMES[key]);
      } else if (button.classList.contains("ql-header")) {
        const level = button.getAttribute("value");
        button.setAttribute("aria-label", `Heading ${level === "2" ? "1" : "2"}`);
      } else if (button.classList.contains("ql-list")) {
        button.setAttribute("aria-label", button.getAttribute("value") === "ordered" ? "Numbered list" : "Bulleted list");
      }
    });
    const editor = root.querySelector<HTMLElement>(".ql-editor");
    if (editor) {
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-multiline", "true");
      if (labelId) editor.setAttribute("aria-labelledby", labelId);
    }
  }, [phone, labelId]);

  return (
    <Box
      ref={wrapper}
      sx={(theme) => ({
        width: "100%",
        ...(phone && {
          "& .ql-toolbar.ql-snow button": { width: 44, height: 44, padding: "10px" },
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
        "& .ql-editor": { minHeight: 160, fontSize: 16, lineHeight: 1.5, color: theme.palette.text.primary },
        "& .ql-editor.ql-blank::before": { color: theme.palette.text.secondary, fontStyle: "normal" },
        "& .ql-snow .ql-stroke": { stroke: theme.palette.text.primary },
        "& .ql-snow .ql-fill, & .ql-snow .ql-stroke.ql-fill": { fill: theme.palette.text.primary },
        "& .ql-snow .ql-picker": { color: theme.palette.text.primary },
        "& .ql-snow.ql-toolbar button:hover .ql-stroke, & .ql-snow.ql-toolbar button.ql-active .ql-stroke": { stroke: theme.palette.primary.main },
        "& .ql-snow.ql-toolbar button:hover .ql-fill, & .ql-snow.ql-toolbar button.ql-active .ql-fill": { fill: theme.palette.primary.main },
        "& .ql-snow.ql-toolbar button:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
        "& .ql-snow .ql-tooltip": {
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderColor: theme.palette.divider,
          boxShadow: theme.shadows[3],
          zIndex: 2,
        },
        "& .ql-snow .ql-tooltip input[type=text]": {
          backgroundColor: theme.palette.background.default,
          color: theme.palette.text.primary,
          borderColor: theme.palette.divider,
        },
        "& .ql-snow .ql-editor a": { color: theme.palette.primary.main },
        [`& .ql-editor .${EMBED_CLASS}`]: {
          margin: "8px 0",
          padding: "10px 12px",
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: theme.shape.borderRadius,
          backgroundColor: theme.palette.action.hover,
          fontWeight: 600,
          userSelect: "none",
          cursor: "default",
        },
        // A video's thumbnail is added or changed by clicking it (the hint isn't stored: it's CSS).
        [`& .ql-editor .${EMBED_CLASS}[data-kind="video"]`]: { cursor: "pointer" },
        [`& .ql-editor .${EMBED_CLASS}[data-kind="video"]::after`]: {
          content: '"  ·  thumbnail: click to add"',
          fontWeight: 400,
          color: theme.palette.text.secondary,
        },
        // A Q-Tube video shows Q-Tube's thumbnail (richtext/qortalSources.ts qtubeDocumentOf).
        [`& .ql-editor .${EMBED_CLASS}[data-kind="video"][data-link^="qortal://APP/Q-Tube/"]::after, & .ql-editor .${EMBED_CLASS}[data-kind="video"][data-identifier^="qtube_vid_"]::after`]: {
          content: '"  ·  Q-Tube\'s thumbnail (click to change)"',
        },
        [`& .ql-editor .${EMBED_CLASS}[data-kind="video"][data-thumb-identifier]::after`]: { content: '"  ·  has a thumbnail (click to change)"' },
        [`& .ql-editor .${EMBED_CLASS}[data-kind="video"]::before`]: { content: '"▶ "', color: theme.palette.primary.main },
        [`& .ql-editor .${EMBED_CLASS}[data-kind="file"]::before`]: { content: '"📄 "' },
      })}
    >
      <ReactQuill
        ref={quillRef}
        key={phone ? "phone" : "desktop"}
        theme="snow"
        defaultValue={value}
        // Quill tidying the HTML it was given isn't the seller's change.
        onChange={(html, _delta, source) => source === "user" && onChange(html)}
        useSemanticHTML={false}
        modules={modules}
        formats={FORMATS}
        placeholder={placeholder}
      />
    </Box>
  );
}
