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
 * A video can have a thumbnail (Simon, 2026-10-23): a picture the seller
 * picks, published as a THUMBNAIL of theirs (with an uploaded video, in the
 * same publish), shown until the video plays. VideoThumbnailDialog adds or
 * changes one for a video already in the description. A Q-Tube video comes
 * with Q-Tube's own (Simon, 2026-10-27), read from its document, nothing
 * published; a picture the seller picks takes its place.
 *
 * Publishing goes through Hub, which asks the seller to confirm and shows the
 * fee and progress (richtext/publishMedia.ts).
 */
import { useId, useRef, useState, type ReactNode } from "react";
import { Box, Button, CircularProgress, List, ListItemButton, ListItemText, Tab, Tabs, TextField, Typography } from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { compressImage } from "../components/common/ImageUploader";
import { resourcePath } from "../qdn/search";
import { ResponsiveDialog } from "../components/common/mobile";
import { searchQdn, type QdnResourceSummary } from "../qdn/search";
import { parseQortalLink, resourceLink, type FileEmbed, type VideoEmbed } from "./embeds";
import { MAX_PDF_BYTES, MAX_VIDEO_BYTES, buildPdfSharePublish, buildThumbnailPublish, buildVideoPublish, filesFromQshare, videoFromQtube } from "./qortalSources";
import { publishMedia } from "./publishMedia";
import { useQtubeThumbnail } from "./useQtubeThumbnail";
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

/** A thumbnail as wide as a phone screen shows it sharp, as WebP (a THUMBNAIL stays small). */
export const THUMBNAIL_WIDTH = 960;

/**
 * A video's thumbnail: the picture picked (a WebP data URL), else the one it
 * has (`current`, its THUMBNAIL), with Choose and Remove; else Q-Tube's
 * (`qtube`), which a picked one replaces and can't be removed.
 */
function ThumbnailPick({
  value,
  current,
  qtube,
  onChange,
  disabled,
}: {
  value: string | null;
  current?: string | null;
  qtube?: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removable = value ?? current ?? null;
  const shown = removable ?? qtube ?? null;
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Pick a picture (JPEG, PNG or WebP).");
    setBusy(true);
    try {
      onChange(await compressImage(file, THUMBNAIL_WIDTH));
    } catch {
      setError("That picture couldn't be read. Try another.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box component="section" aria-label="Thumbnail" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Thumbnail{" "}
        <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
          (optional): shown until the video plays
        </Box>
      </Typography>
      {shown && (
        <Box component="img" src={shown} alt="The video's thumbnail" sx={{ maxWidth: 240, maxHeight: 180, borderRadius: 1, border: 1, borderColor: "divider", objectFit: "contain", alignSelf: "flex-start" }} />
      )}
      {shown && !removable && (
        <Typography variant="body2" color="text.secondary">
          Q-Tube&apos;s thumbnail, nothing to publish. Choose another picture to use your own.
        </Typography>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} aria-hidden tabIndex={-1} />
        <Button
          variant="outlined"
          color="inherit"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <AddPhotoAlternateOutlinedIcon />}
          onClick={() => input.current?.click()}
          disabled={disabled || busy}
          sx={{ minHeight: 44 }}
        >
          {shown ? "Choose another picture" : "Add a thumbnail"}
        </Button>
        {removable && (
          <Button color="inherit" onClick={() => onChange(null)} disabled={disabled || busy} sx={{ minHeight: 44 }}>
            Remove
          </Button>
        )}
      </Box>
      {error && (
        <Typography role="alert" variant="body2" color="error">
          {error}
        </Typography>
      )}
    </Box>
  );
}

/** Publishes a picked thumbnail under `name`: the embed with it, null when declined, or a problem. */
async function withPublishedThumbnail(embed: VideoEmbed, name: string, dataUrl: string): Promise<{ embed: VideoEmbed } | { declined: true } | { problem: string }> {
  const built = buildThumbnailPublish({ name, dataUrl, title: embed.title });
  const outcome = await publishMedia(built.resource, { service: "THUMBNAIL", name, identifier: built.identifier });
  if (outcome.kind === "done") return { embed: { ...embed, thumbnail: built.thumbnail } };
  if (outcome.kind === "declined") return { declined: true };
  return { problem: outcome.message };
}

/** Adds, changes or removes the thumbnail of a video already in the description. */
export function VideoThumbnailDialog({
  embed,
  name,
  onClose,
  onSave,
}: {
  embed: VideoEmbed;
  /** The name the shop publishes under: the thumbnail is published by it. */
  name: string | null | undefined;
  onClose: () => void;
  onSave: (embed: VideoEmbed) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = !removed && embed.thumbnail ? resourcePath("THUMBNAIL", embed.thumbnail.name, embed.thumbnail.identifier) : null;
  const qtube = useQtubeThumbnail(embed);
  const changed = picked !== null || removed;
  const save = async () => {
    setError(null);
    if (picked) {
      if (!name) return setError("Sign in with your shop's Qortal name to publish a thumbnail.");
      setPublishing(true);
      const result = await withPublishedThumbnail(embed, name, picked);
      setPublishing(false);
      if ("embed" in result) onSave(result.embed);
      else if ("problem" in result) setError(result.problem);
      return;
    }
    const rest = { ...embed };
    delete rest.thumbnail;
    onSave(rest);
  };
  return (
    <ResponsiveDialog
      open
      onClose={publishing ? () => {} : onClose}
      title="Video thumbnail"
      maxWidth="sm"
      busy={publishing}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={publishing}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void save()} disabled={!changed || publishing}>
            {publishing ? "Publishing…" : picked ? "Publish and save" : "Save"}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{embed.title || "Video"}</Typography>
        <ThumbnailPick
          value={picked}
          current={current}
          qtube={qtube}
          onChange={(dataUrl) => {
            setPicked(dataUrl);
            if (!dataUrl) setRemoved(true);
          }}
          disabled={publishing}
        />
        {picked && (
          <Typography variant="body2" color="text.secondary">
            The picture is published under {name ?? "your name"}. {FEE_NOTE}
          </Typography>
        )}
        {error && (
          <Typography role="alert" color="error">
            {error}
          </Typography>
        )}
      </Box>
    </ResponsiveDialog>
  );
}

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
  const [picked, setPicked] = useState<VideoEmbed | null>(null);
  // The thumbnail picked for it (any tab), and a publish of it in progress.
  const [thumb, setThumb] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
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
    const built = buildVideoPublish({ name, file, title, shopTitle, thumbnail: thumb });
    setPublishing(true);
    const outcome = await publishMedia(built.request, { service: "VIDEO", name, identifier: built.identifier });
    setPublishing(false);
    if (outcome.kind === "done") onAdd(built.embed);
    else if (outcome.kind === "failed") setUploadError(outcome.message);
  };

  // A video from a link or the seller's list: its thumbnail, when picked, is published first.
  const add = async (embed: VideoEmbed | null) => {
    if (!embed) return;
    setAddError(null);
    if (!thumb) return onAdd(embed);
    if (!name) return setAddError("Sign in with your shop's Qortal name to publish a thumbnail.");
    setAdding(true);
    const result = await withPublishedThumbnail(embed, name, thumb);
    setAdding(false);
    if ("embed" in result) onAdd(result.embed);
    else if ("problem" in result) setAddError(result.problem);
  };
  const busy = publishing || adding;
  // A Q-Tube video's own thumbnail, shown with it when the seller picks none.
  const qtube = useQtubeThumbnail(tab === "link" ? found : tab === "mine" ? picked : null);

  const tabs = [
    { key: "link" as const, label: "Link" },
    { key: "mine" as const, label: "Your videos" },
    { key: "upload" as const, label: "Publish" },
  ];

  return (
    <ResponsiveDialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Add a video"
      maxWidth="sm"
      busy={busy}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {(tab === "link" || tab === "mine") && (
            <Button variant="contained" disabled={!(tab === "link" ? found : picked) || adding} onClick={() => void add(tab === "link" ? found : picked)}>
              {adding ? "Publishing…" : thumb ? "Publish thumbnail and add" : "Add video"}
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
          <Typography color="text.secondary">{mineError ?? `${name} has no videos on Qortal yet. Publish one, or paste a link.`}</Typography>
        ) : (
          <>
            <List aria-label="Your videos" disablePadding sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
              {rows.map((row) => {
                const label = row.metadata?.title?.trim() || row.identifier;
                return (
                  <ListItemButton
                    key={row.identifier}
                    selected={picked?.identifier === row.identifier}
                    aria-pressed={picked?.identifier === row.identifier}
                    onClick={() => setPicked({ kind: "video", name: row.name, identifier: row.identifier, title: label.slice(0, 180) })}
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
          The video is published under {name ?? "your name"} and plays under this product's pictures. {FEE_NOTE}
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
      {/* Once a video is chosen, in any tab: its thumbnail. */}
      {(tab === "link" ? found : tab === "mine" ? picked : file) && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 2 }}>
          <ThumbnailPick value={thumb} qtube={qtube} onChange={setThumb} disabled={busy} />
          {addError && (
            <Typography role="alert" color="error">
              {addError}
            </Typography>
          )}
        </Box>
      )}
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
        <Tab value="upload" label="Publish a PDF" id={`${id}-upload-tab`} aria-controls={`${id}-upload-panel`} sx={{ minHeight: 48 }} />
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
