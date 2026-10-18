import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { ResponsiveDialog } from "../../components/common/mobile/ResponsiveDialog";
import { addToMine, upsertCollection } from "../../state/features/collectionsSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import type { RootState } from "../../state/store";
import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_TITLE_MAX,
  buildCollectionIdentifier,
  copyCollectionBody,
  newCollectionUid,
  publishCollection,
  type Collection,
} from "../../utils/collections";
import { allCollectionItems, folderCount } from "../../utils/collectionFolders";
import { isHubDecline } from "../../utils/hubErrors";

interface CopyCollectionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Someone else's collection. */
  source: Collection;
  onCopied: (copy: Collection) => void;
}

/**
 * Copy someone's collection into the signed-in name's collections: a new
 * collection with the same shares and folders, which names where it came
 * from (and tells that collection's owner). One publish, confirmed in Hub.
 */
export function CopyCollectionDialog({ open, onClose, source, onCopied }: CopyCollectionDialogProps) {
  const dispatch = useDispatch();
  const myName = useSelector((state: RootState) => state.auth.user?.name);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the fields each time the dialog opens (state adjusted during render, no effect).
  const [seededOpen, setSeededOpen] = useState(false);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setTitle(source.title);
      setDescription(source.description);
      setBusy(false);
      setError(null);
    }
  }

  const shares = allCollectionItems(source).length;
  const folders = folderCount(source);
  const trimmed = title.trim();

  const copy = async () => {
    if (!trimmed || !myName) return;
    setBusy(true);
    setError(null);
    try {
      const identifier = buildCollectionIdentifier(trimmed, newCollectionUid());
      const body = copyCollectionBody(source, { title: trimmed, description });
      const saved = await publishCollection({ name: myName, identifier, body, previous: null, previousItems: [] });
      dispatch(upsertCollection(saved));
      dispatch(
        addToMine({
          name: myName,
          identifier,
          title: saved.title,
          description: saved.description,
          created: saved.created,
          updated: saved.updated,
        })
      );
      dispatch(setNotification({ msg: `Copied to your collections`, alertType: "success" }));
      onCopied(saved);
    } catch (error) {
      // A "no" in Hub's dialog is the user's choice: keep the form open, no error.
      if (!isHubDecline(error)) setError("The collection was not copied.");
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={close}
      dismissible={!busy}
      title="Copy to my collections"
      maxWidth="xs"
      actions={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={copy} disabled={busy || !trimmed || !myName}>
            {busy ? "Publishing…" : "Copy"}
          </Button>
        </>
      }
    >
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          void copy();
        }}
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}
      >
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, COLLECTION_TITLE_MAX))}
          required
          fullWidth
          error={!trimmed}
          helperText={trimmed ? `${title.length}/${COLLECTION_TITLE_MAX}` : "Give your copy a title"}
          slotProps={{ htmlInput: { maxLength: COLLECTION_TITLE_MAX } }}
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, COLLECTION_DESCRIPTION_MAX))}
          multiline
          minRows={2}
          fullWidth
          helperText={`${description.length}/${COLLECTION_DESCRIPTION_MAX}`}
          slotProps={{ htmlInput: { maxLength: COLLECTION_DESCRIPTION_MAX } }}
        />
        <Typography variant="body2">
          Your copy is a new collection under {myName ?? "your name"} with its {shares} {shares === 1 ? "share" : "shares"}
          {folders > 0 ? ` and ${folders} ${folders === 1 ? "folder" : "folders"}` : ""}. It shows that it is a copy of “
          {source.title || "Untitled collection"}” by {source.name}, and {source.name} is told about it.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Hub asks you to confirm, and the usual small QDN fee applies. Later changes to the original don't change your
          copy.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </Box>
    </ResponsiveDialog>
  );
}
