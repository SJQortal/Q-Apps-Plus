/**
 * The product form's description editor (Simon, 2026-10-22): text
 * formatting, links (qortal:// ones too), and videos and files from Qortal,
 * after Q-Share+'s TextEditorQuill (Quill 2, react-quill-new). Loaded with
 * the product form only (React.lazy), never for buyers.
 *
 * - Pasted rich text keeps its formatting: headings, bold, lists, links…
 *   Colours, pictures and other embeds in a paste are dropped (a description
 *   is read in four themes; a pasted picture could load from outside Qortal).
 * - Quill keeps a link only for its allowed schemes; qortal: is added, so a
 *   qortal:// link stays one (Quill wrote about:blank before).
 * - Video and File (the last two toolbar buttons) open AddVideoDialog and
 *   AddFileDialog; what they add is a block in the text
 *   (richtext/embeds.ts), shown here as a card.
 *
 * The value handed back is the editor's own HTML (Quill's raw markup); the
 * draft builders turn it into the stored forms (richtext/plainText.ts).
 * Only the seller's own edits count as changes, not Quill tidying the HTML
 * it was given. The editor keeps its own content (uncontrolled): fed the
 * stored HTML on every render, Quill would load it again each time it
 * writes it differently (lists, blocks), on every key typed elsewhere in the
 * form. `value` is read when the editor mounts (again when a phone turns).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@mui/material";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { usePhoneLayout } from "../hooks/usePhoneLayout";
import { EMBED_CLASS, embedData, embedFromData, embedLabel, type QortalEmbed, type VideoEmbed } from "./embeds";
import { AddFileDialog, AddVideoDialog, VideoThumbnailDialog } from "./AddMediaDialogs";

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
  const icons = Quill.import("ui/icons") as unknown as Record<string, string>;
  icons.qortalVideo =
    '<svg viewBox="0 0 18 18"><rect class="ql-stroke" x="2" y="4" width="14" height="10" rx="2"/><polygon class="ql-fill" points="8 7 12 9 8 11 8 7"/></svg>';
  icons.qortalFile =
    '<svg viewBox="0 0 18 18"><path class="ql-stroke" d="M5 2h6l3 3v11H5z"/><polyline class="ql-stroke" points="11 2 11 5 14 5"/><line class="ql-stroke" x1="7" x2="12" y1="9" y2="9"/><line class="ql-stroke" x1="7" x2="12" y1="12" y2="12"/></svg>';
}
setUpQuill();

/**
 * Everything a description may be formatted with. Colours are left out (they
 * break in half the themes), and so are pictures and Quill's own video (an
 * iframe): a paste brings none of them.
 */
const FORMATS = ["bold", "italic", "underline", "strike", "link", "blockquote", "header", "list", "indent", "align", "qortalEmbed"];

const DESKTOP_TOOLBAR = [
  ["bold", "italic", "underline", "strike"],
  [{ header: 2 }, { header: 3 }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "link"],
  ["clean"],
  ["qortalVideo", "qortalFile"],
];
const PHONE_TOOLBAR = [["bold", "italic"], [{ list: "bullet" }], ["link"], ["qortalVideo", "qortalFile"]];

/** Names for the toolbar's buttons (Quill names them by format, in English or not at all). */
const BUTTON_NAMES: Record<string, string> = {
  "ql-bold": "Bold",
  "ql-italic": "Italic",
  "ql-underline": "Underline",
  "ql-strike": "Strikethrough",
  "ql-blockquote": "Quote",
  "ql-link": "Link (select text first)",
  "ql-clean": "Clear formatting",
  "ql-qortalVideo": "Add a video",
  "ql-qortalFile": "Add a file or PDF",
};

export interface DescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** The name the shop publishes under (for its videos, and uploads). */
  name: string | null | undefined;
  productTitle: string;
  shopTitle?: string;
  placeholder?: string;
  /** Labelled by this element (the field's visible label). */
  labelId?: string;
}

export default function DescriptionEditor({ value, onChange, name, productTitle, shopTitle, placeholder, labelId }: DescriptionEditorProps) {
  const phone = usePhoneLayout();
  const quillRef = useRef<ReactQuill>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<"video" | "file" | null>(null);
  // A video in the description whose thumbnail is being added or changed, by its place.
  const [thumbFor, setThumbFor] = useState<{ index: number; embed: VideoEmbed } | null>(null);
  const openRef = useRef(setDialog);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: phone ? PHONE_TOOLBAR : DESKTOP_TOOLBAR,
        handlers: {
          // With a video selected (from the keyboard), its thumbnail; else a new video.
          qortalVideo: () => {
            const quill = quillRef.current?.getEditor();
            const at = quill?.getSelection();
            const value = at && at.length === 1 ? (quill?.getContents(at.index, 1).ops[0]?.insert as { qortalEmbed?: QortalEmbed } | undefined)?.qortalEmbed : undefined;
            if (at && value?.kind === "video") setThumbFor({ index: at.index, embed: value });
            else openRef.current("video");
          },
          qortalFile: () => openRef.current("file"),
        },
      },
      clipboard: { matchVisual: false },
    }),
    [phone]
  );

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

  // A click on a video block opens its thumbnail (the block itself isn't editable text).
  useEffect(() => {
    const root = wrapper.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const node = event.target instanceof Element ? event.target.closest<HTMLElement>(`.ql-editor .${EMBED_CLASS}[data-kind="video"]`) : null;
      const quill = quillRef.current?.getEditor();
      if (!node || !quill) return;
      const embed = embedFromData({ ...node.dataset });
      const blot = Quill.find(node);
      if (embed?.kind !== "video" || !blot || blot instanceof Quill) return;
      setThumbFor({ index: quill.getIndex(blot as never), embed });
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  const replaceVideo = (index: number, embed: VideoEmbed) => {
    setThumbFor(null);
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    quill.deleteText(index, 1, "user");
    quill.insertEmbed(index, "qortalEmbed", embed, "user");
    quill.setSelection(index + 1, 0, "silent");
  };

  const insert = (embeds: QortalEmbed[]) => {
    setDialog(null);
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    let at = (quill.getSelection(true) ?? { index: quill.getLength() }).index;
    for (const embed of embeds) {
      quill.insertEmbed(at, "qortalEmbed", embed, "user");
      at += 1;
    }
    quill.setSelection(at, 0, "silent");
  };

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
      {dialog === "video" && (
        <AddVideoDialog open onClose={() => setDialog(null)} onAdd={(embed) => insert([embed])} name={name} productTitle={productTitle} shopTitle={shopTitle} />
      )}
      {dialog === "file" && <AddFileDialog open onClose={() => setDialog(null)} onAdd={insert} name={name} shopTitle={shopTitle} />}
      {thumbFor && (
        <VideoThumbnailDialog embed={thumbFor.embed} name={name} onClose={() => setThumbFor(null)} onSave={(embed) => replaceVideo(thumbFor.index, embed)} />
      )}
    </Box>
  );
}
