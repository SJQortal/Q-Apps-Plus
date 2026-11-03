import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";
import { ResponsiveDialog } from "../../../components/common/mobile/ResponsiveDialog";
import { upsertCollection } from "../../../state/features/collectionsSlice";
import { setNotification } from "../../../state/features/notificationsSlice";
import { editCollectionBody, itemCoverOf, publishCollection, withItemCover, type Collection, type CollectionCover } from "../../../utils/collections";
import { ImageTooBigError, makeBookCoverFile, makeFilmCoverFile } from "../../../utils/coverImage";
import { isHubDecline } from "../../../utils/hubErrors";
import { KEEP_COVER, coverChange, type CoverChoice } from "../CoverPicker";
import type { SpaceShare } from "./useSpaceItems";

/** Hub published the collection but not the share's new cover. */
export const ITEM_COVER_FAILED = "Saved, but the cover image wasn't published. Choose it again.";

/** The shapes a cover comes in: a book's 2:3, or a video's 16:9 still. */
const SHAPES = {
  book: {
    title: "Book cover",
    make: makeBookCoverFile,
    note: "Shown on this collection's shelves in place of the share's own picture, cut to a book's shape.",
    previewWidth: 112,
  },
  film: {
    title: "Video cover",
    make: makeFilmCoverFile,
    note: "Shown on this collection's posters and in its player in place of the share's own picture, cut to 16:9.",
    previewWidth: 192,
  },
} as const;

interface ItemCoverDialogProps {
  open: boolean;
  onClose: () => void;
  collection: Collection;
  share: SpaceShare;
  shape: keyof typeof SHAPES;
  /** The share as the look shows it, with `src` (a picture not published yet) or `cover` (the one chosen now), or neither for its own. */
  preview: (choice: { src: string | null; cover: CollectionCover | null | undefined }) => ReactNode;
}

/**
 * The collection owner's cover for one of its shares: a picture of their own,
 * cut to the look's shape on the device, shown in this collection in place of
 * the share's own picture. It is stored in the collection (`itemCovers`), so
 * saving republishes it with the image: one Hub confirmation.
 */
export function ItemCoverDialog({ open, onClose, collection, share, shape, preview }: ItemCoverDialogProps) {
  const kind = SHAPES[shape];
  const dispatch = useDispatch();
  const input = useRef<HTMLInputElement>(null);
  const item = { name: share.user, identifier: share.identifier };
  const current = itemCoverOf(collection, item);
  const [choice, setChoice] = useState<CoverChoice>(KEEP_COVER);
  const [working, setWorking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = choice.kind === "new" ? choice.url : null;

  // A fresh start each time it opens (state adjusted during render, no effect).
  const [seededOpen, setSeededOpen] = useState(false);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setChoice(KEEP_COVER);
      setProblem(null);
      setError(null);
      setBusy(false);
    }
  }

  // The preview's object URL lives as long as it is the choice.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setWorking(true);
    try {
      const cover = await kind.make(file);
      setChoice({ kind: "new", file: cover, url: URL.createObjectURL(cover) });
    } catch (error) {
      setProblem(
        error instanceof ImageTooBigError
          ? "That image is too big to use on this device. Try a smaller one."
          : "Couldn't use that image. Try a JPEG, PNG or WebP."
      );
    } finally {
      setWorking(false);
      if (input.current) input.current.value = "";
    }
  };

  const save = async () => {
    if (choice.kind === "keep" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { cover, covers } = coverChange(choice, collection.name);
      let coverFailed = false;
      const saved = await publishCollection({
        name: collection.name,
        identifier: collection.identifier,
        body: editCollectionBody(collection, { itemCovers: withItemCover(collection.itemCovers, item, cover ?? null) }),
        previous: collection,
        covers,
        onCoversFailed: () => (coverFailed = true),
      });
      dispatch(upsertCollection(saved));
      dispatch(
        coverFailed
          ? setNotification({ msg: ITEM_COVER_FAILED, alertType: "info" })
          : setNotification({ msg: cover ? "Cover saved" : "Cover removed", alertType: "success" })
      );
      onClose();
    } catch (error) {
      // A "no" in Hub's dialog is the user's choice, not a failure: keep it open, no error.
      if (!isHubDecline(error)) setError("The cover was not saved.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  const shown = choice.kind === "keep" ? current : null;
  const hasOwn = choice.kind === "new" || Boolean(shown);
  const title = share.title || "Untitled";

  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      dismissible={!busy}
      title={kind.title}
      maxWidth="xs"
      actions={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={busy || working || choice.kind === "keep"}>
            {busy ? "Publishing…" : "Save"}
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", pt: 0.5 }}>
        <Box sx={{ width: kind.previewWidth, maxWidth: "45%", flexShrink: 0 }}>{preview({ src: previewUrl, cover: shown })}</Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, alignItems: "flex-start" }}>
          <Typography component="p" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
            {title}
          </Typography>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            data-testid="book-cover-input"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={working ? <CircularProgress size={16} color="inherit" /> : <AddPhotoAlternateOutlinedIcon />}
            onClick={() => input.current?.click()}
            disabled={busy || working}
            sx={{ minHeight: 44 }}
          >
            {hasOwn ? "Change image" : "Choose image"}
          </Button>
          {hasOwn ? (
            <Button
              color="inherit"
              size="small"
              startIcon={<RestoreOutlinedIcon />}
              onClick={() => setChoice(current ? { kind: "remove" } : KEEP_COVER)}
              disabled={busy || working}
              sx={{ minHeight: 44, textAlign: "left" }}
            >
              Use the share's own picture
            </Button>
          ) : null}
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" role={problem ? "alert" : undefined} sx={{ mt: 2 }}>
        {problem ??
          `${kind.note} Published with the collection, for one more small QDN fee.`}
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      ) : null}
    </ResponsiveDialog>
  );
}
