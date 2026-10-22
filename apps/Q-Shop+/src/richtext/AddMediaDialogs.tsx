/**
 * The description editor's Video and File buttons (Simon, 2026-10-22):
 *
 * - Add a video: from a link (a Q-Tube video page or a `qortal://VIDEO/…`
 *   link), from the seller's videos already on Qortal (their VIDEO
 *   resources, newest first, 20 at a time), or uploaded and published now
 *   (richtext/qortalSources.ts buildVideoPublish).
 * - Add a file: from a Q-Share link (every file of the share; a
 *   `qortal://FILE/…` link adds one), or a PDF uploaded and published now to
 *   Q-Share, in Q-Share's own format (buildPdfSharePublish).
 *
 * Publishing goes through Hub, which asks the seller to confirm and shows the
 * fee and progress (richtext/publishMedia.ts).
 */
import { useId, useRef, useState, type ReactNode } from "react";
import { Box, Button, CircularProgress, List, ListItemButton, ListItemText, Tab, Tabs, TextField, Typography } from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { ResponsiveDialog } from "../components/common/mobile";
import { searchQdn, type QdnResourceSummary } from "../qdn/search";
import { parseQortalLink, resourceLink, type FileEmbed, type VideoEmbed } from "./embeds";
import { MAX_PDF_BYTES, MAX_VIDEO_BYTES, buildPdfSharePublish, buildVideoPublish, filesFromQshare, videoFromQtube } from "./qortalSources";
import { publishMedia } from "./publishMedia";
import { formatBytes } from "./QortalFile";

const PAGE = 20;

function TabPanel({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  if (!active) return null;
  return (
    <Box role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab`} sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
      {children}
    </Box>
  );
}

/** A file picker as a button: the input is hidden, the button names what was picked. */
function FilePick({ accept, label, file, onPick }: { accept: string; label: string; file: File | null; onPick: (file: File | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
      <input ref={input} type="file" accept={accept} hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} aria-hidden tabIndex={-1} />
      <Button variant="outlined" color="inherit" startIcon={<UploadFileOutlinedIcon />} onClick={() => input.current?.click()} sx={{ minHeight: 44 }}>
        {file ? "Choose another" : label}
      </Button>
      {file && (
        <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
          {file.name} · {formatBytes(file.size)}
        </Typography>
      )}
    </Box>
  );
}

const FEE_NOTE = "Publishing goes through Hub, which asks you to confirm and shows the small QORT fee and its progress.";

export function AddVideoDialog({
  open,
  onClose,
  onAdd,
  name,
  productTitle,
  shopTitle,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (embed: VideoEmbed) => void;
  /** The name the shop publishes under. */
  name: string | null | undefined;
  productTitle: string;
  shopTitle?: string;
}) {
  const id = useId();
  const [tab, setTab] = useState<"link" | "mine" | "upload">("link");
  // Link
  const [link, setLink] = useState("");
  const [found, setFound] = useState<VideoEmbed | null>(null);
  const [checking, setChecking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // Mine
  const [rows, setRows] = useState<QdnResourceSummary[] | null>(null);
  const [more, setMore] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);
  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(productTitle);
  const [publishing, setPublishing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const loadMine = async (offset: number) => {
    if (!name) return;
    setMineError(null);
    try {
      const page = await searchQdn({ service: "VIDEO", name, exactmatchnames: true, includemetadata: true, limit: PAGE, offset, reverse: true });
      const own = page.filter((row) => row.name === name);
      setRows((prev) => (offset === 0 ? own : [...(prev ?? []), ...own]));
      setMore(page.length === PAGE);
    } catch {
      setMineError("Your videos couldn't be listed right now.");
      setRows((prev) => prev ?? []);
    }
  };

  const check = async () => {
    setLinkError(null);
    setFound(null);
    const target = parseQortalLink(link);
    if (!target || (target.kind !== "qtube" && target.kind !== "video")) {
      setLinkError("Paste a Q-Tube video link (qortal://APP/Q-Tube/video/…) or a qortal://VIDEO/… link.");
      return;
    }
    if (target.kind === "video") {
      setFound({ kind: "video", name: target.name, identifier: target.identifier, link: resourceLink("VIDEO", target.name, target.identifier) });
      return;
    }
    setChecking(true);
    try {
      setFound(await videoFromQtube(target.name, target.identifier));
    } catch {
      setLinkError("That Q-Tube video couldn't be read from your node. Check the link, or try again in a moment.");
    } finally {
      setChecking(false);
    }
  };

  const publish = async () => {
    if (!name || !file) return;
    setUploadError(null);
    if (!file.type.startsWith("video/")) return setUploadError("Pick a video file.");
    if (file.size > MAX_VIDEO_BYTES) return setUploadError(`Use a video under ${formatBytes(MAX_VIDEO_BYTES)}.`);
    const built = buildVideoPublish({ name, file, title, shopTitle });
    setPublishing(true);
    const outcome = await publishMedia(built.request, { service: "VIDEO", name, identifier: built.identifier });
    setPublishing(false);
    if (outcome.kind === "done") onAdd(built.embed);
    else if (outcome.kind === "failed") setUploadError(outcome.message);
  };

  const tabs = [
    { key: "link" as const, label: "Link" },
    { key: "mine" as const, label: "Your videos" },
    { key: "upload" as const, label: "Upload" },
  ];

  return (
    <ResponsiveDialog
      open={open}
      onClose={publishing ? () => {} : onClose}
      title="Add a video"
      maxWidth="sm"
      busy={publishing}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
          {tab === "link" && (
            <Button variant="contained" disabled={!found} onClick={() => found && onAdd(found)}>
              Add video
            </Button>
          )}
          {tab === "upload" && (
            <Button variant="contained" disabled={!file || !name || publishing} onClick={publish}>
              {publishing ? "Publishing…" : "Publish and add"}
            </Button>
          )}
        </>
      }
    >
      <Tabs
        value={tab}
        onChange={(_, v: typeof tab) => {
          setTab(v);
          // Read once, when the tab is first opened.
          if (v === "mine" && rows === null) void loadMine(0);
        }}
        variant="fullWidth"
        aria-label="Where the video comes from"
      >
        {tabs.map((t) => (
          <Tab key={t.key} value={t.key} label={t.label} id={`${id}-${t.key}-tab`} aria-controls={`${id}-${t.key}-panel`} sx={{ minHeight: 48 }} />
        ))}
      </Tabs>
      <TabPanel id={`${id}-link`} active={tab === "link"}>
        <TextField
          label="Q-Tube or Qortal link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setFound(null);
            setLinkError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && void check()}
          placeholder="qortal://APP/Q-Tube/video/…"
          fullWidth
          error={!!linkError}
          helperText={linkError ?? "In Q-Tube, Copy link on the video's page."}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button variant="outlined" color="inherit" onClick={check} disabled={!link.trim() || checking} sx={{ minHeight: 44 }}>
            Find the video
          </Button>
          {checking && <CircularProgress size={20} aria-label="Finding the video" />}
        </Box>
        {found && (
          <Box role="status" sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{found.title || "Video"}</Typography>
            <Typography variant="body2" color="text.secondary">
              by {found.name}
            </Typography>
          </Box>
        )}
      </TabPanel>
      <TabPanel id={`${id}-mine`} active={tab === "mine"}>
        {!name ? (
          <Typography color="text.secondary">Sign in with your Qortal name to see your videos.</Typography>
        ) : rows === null ? (
          <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={20} />
            <Typography>Looking for your videos…</Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary">{mineError ?? `${name} has no videos on Qortal yet. Upload one, or paste a link.`}</Typography>
        ) : (
          <>
            <List aria-label="Your videos" disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
              {rows.map((row) => {
                const label = row.metadata?.title?.trim() || row.identifier;
                return (
                  <ListItemButton
                    key={row.identifier}
                    onClick={() => onAdd({ kind: "video", name: row.name, identifier: row.identifier, title: label.slice(0, 180) })}
                    sx={{ minHeight: 56 }}
                  >
                    <ListItemText
                      primary={label}
                      secondary={[row.created ? new Date(row.updated ?? row.created).toLocaleDateString() : "", formatBytes(row.size)].filter(Boolean).join(" · ")}
                      slotProps={{ primary: { sx: { overflowWrap: "anywhere" } } }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
            {mineError && (
              <Typography role="alert" color="error">
                {mineError}
              </Typography>
            )}
            {more && (
              <Button variant="outlined" color="inherit" onClick={() => loadMine(rows.length)} sx={{ minHeight: 44 }}>
                Show more
              </Button>
            )}
          </>
        )}
      </TabPanel>
      <TabPanel id={`${id}-upload`} active={tab === "upload"}>
        <FilePick accept="video/*" label="Choose a video" file={file} onPick={setFile} />
        <TextField label="Video title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: 180 } }} />
        <Typography variant="body2" color="text.secondary">
          The video is published under {name ?? "your name"} and plays in this product's description. {FEE_NOTE}
        </Typography>
        {publishing && (
          <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={20} />
            <Typography>Publishing… Hub shows the progress. A big video can take several minutes.</Typography>
          </Box>
        )}
        {uploadError && (
          <Typography role="alert" color="error">
            {uploadError}
          </Typography>
        )}
      </TabPanel>
    </ResponsiveDialog>
  );
}

export function AddFileDialog({
  open,
  onClose,
  onAdd,
  name,
  shopTitle,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (embeds: FileEmbed[]) => void;
  name: string | null | undefined;
  shopTitle?: string;
}) {
  const id = useId();
  const [tab, setTab] = useState<"link" | "upload">("link");
  const [link, setLink] = useState("");
  const [found, setFound] = useState<FileEmbed[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const check = async () => {
    setLinkError(null);
    setFound(null);
    const target = parseQortalLink(link);
    if (!target || (target.kind !== "qshare" && target.kind !== "file")) {
      setLinkError("Paste a Q-Share link (qortal://APP/Q-Share/share/…) or a qortal://FILE/… link.");
      return;
    }
    if (target.kind === "file") {
      setFound([{ kind: "file", name: target.name, identifier: target.identifier, link: resourceLink("FILE", target.name, target.identifier) }]);
      return;
    }
    setChecking(true);
    try {
      const share = await filesFromQshare(target.name, target.identifier);
      if (share.files.length === 0) setLinkError("That share has no files.");
      else setFound(share.files);
    } catch {
      setLinkError("That Q-Share link couldn't be read from your node. Check the link, or try again in a moment.");
    } finally {
      setChecking(false);
    }
  };

  const pick = (picked: File | null) => {
    setFile(picked);
    setUploadError(null);
    if (picked && !title.trim()) setTitle(picked.name.replace(/\.pdf$/i, ""));
  };

  const publish = async () => {
    if (!name || !file) return;
    setUploadError(null);
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return setUploadError("Pick a PDF file.");
    if (file.size > MAX_PDF_BYTES) return setUploadError(`Use a PDF under ${formatBytes(MAX_PDF_BYTES)}.`);
    const built = buildPdfSharePublish({ name, file, title, shopTitle });
    setPublishing(true);
    const outcome = await publishMedia(built.request, { service: "DOCUMENT", name, identifier: built.metadataId });
    setPublishing(false);
    if (outcome.kind === "done") onAdd([built.embed]);
    else if (outcome.kind === "failed") setUploadError(outcome.message);
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={publishing ? () => {} : onClose}
      title="Add a file"
      maxWidth="sm"
      busy={publishing}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
          {tab === "link" && (
            <Button variant="contained" disabled={!found} onClick={() => found && onAdd(found)}>
              {found && found.length > 1 ? `Add ${found.length} files` : "Add file"}
            </Button>
          )}
          {tab === "upload" && (
            <Button variant="contained" disabled={!file || !name || publishing} onClick={publish}>
              {publishing ? "Publishing…" : "Publish to Q-Share and add"}
            </Button>
          )}
        </>
      }
    >
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" aria-label="Where the file comes from">
        <Tab value="link" label="Q-Share link" id={`${id}-link-tab`} aria-controls={`${id}-link-panel`} sx={{ minHeight: 48 }} />
        <Tab value="upload" label="Upload a PDF" id={`${id}-upload-tab`} aria-controls={`${id}-upload-panel`} sx={{ minHeight: 48 }} />
      </Tabs>
      <TabPanel id={`${id}-link`} active={tab === "link"}>
        <TextField
          label="Q-Share link"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            setFound(null);
            setLinkError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && void check()}
          placeholder="qortal://APP/Q-Share/share/…"
          fullWidth
          error={!!linkError}
          helperText={linkError ?? "In Q-Share, Copy link on the share's page."}
        />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Button variant="outlined" color="inherit" onClick={check} disabled={!link.trim() || checking} sx={{ minHeight: 44 }}>
            Find the files
          </Button>
          {checking && <CircularProgress size={20} aria-label="Finding the files" />}
        </Box>
        {found && (
          <Box role="status" component="ul" sx={{ m: 0, p: 1.5, pl: 3.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
            {found.map((f) => (
              <Typography component="li" key={f.identifier} sx={{ overflowWrap: "anywhere" }}>
                {f.filename || f.title || f.identifier}
                {f.size ? ` · ${formatBytes(f.size)}` : ""}
              </Typography>
            ))}
          </Box>
        )}
      </TabPanel>
      <TabPanel id={`${id}-upload`} active={tab === "upload"}>
        <FilePick accept="application/pdf,.pdf" label="Choose a PDF" file={file} onPick={pick} />
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: 180 } }} />
        <Typography variant="body2" color="text.secondary">
          The PDF is published to Q-Share under {name ?? "your name"} (category Document, PDF), so it is in Q-Share too, and buyers can preview it here.{" "}
          {FEE_NOTE}
        </Typography>
        {publishing && (
          <Box role="status" sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={20} />
            <Typography>Publishing… Hub shows the progress.</Typography>
          </Box>
        )}
        {uploadError && (
          <Typography role="alert" color="error">
            {uploadError}
          </Typography>
        )}
      </TabPanel>
    </ResponsiveDialog>
  );
}
