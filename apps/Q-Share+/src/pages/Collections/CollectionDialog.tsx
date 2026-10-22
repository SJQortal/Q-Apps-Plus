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
  buildCollectionBody,
  buildCollectionIdentifier,
  newCollectionUid,
  publishCollection,
  type Collection,
  type CollectionItem,
} from "../../utils/collections";
import { isHubDecline } from "../../utils/hubErrors";

export interface CollectionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Edit this collection; omit to create a new one. */
  collection?: Collection | null;
  /** Shares a new collection starts with (e.g. the one being saved). */
  initialItems?: CollectionItem[];
  onSaved?: (collection: Collection) => void;
}

/** Create or edit a collection. One PUBLISH_QDN_RESOURCE, confirmed in Hub. */
export function CollectionDialog({ open, onClose, collection, initialItems, onSaved }: CollectionDialogProps) {
  const dispatch = useDispatch();
  const myName = useSelector((state: RootState) => state.auth.user?.name);
  const isEdit = Boolean(collection);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the fields each time the dialog opens (state adjusted during render, no effect).
  const [seededOpen, setSeededOpen] = useState(false);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setTitle(collection?.title ?? "");
      setDescription(collection?.description ?? "");
      setTouched(false);
      setBusy(false);
      setError(null);
    }
  }

  const trimmedTitle = title.trim();
  const titleError = touched && !trimmedTitle ? "Give the collection a title" : null;
  const startCount = !isEdit ? (initialItems?.length ?? 0) : 0;

  const save = async () => {
    setTouched(true);
    if (!trimmedTitle) return;
    const name = collection?.name ?? myName;
    if (!name) {
      setError("Sign in with a Qortal name to publish a collection.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const identifier = collection?.identifier ?? buildCollectionIdentifier(trimmedTitle, newCollectionUid());
      const body = buildCollectionBody({
        title: trimmedTitle,
        description,
        items: collection?.items ?? initialItems ?? [],
        created: collection?.created,
      });
      const saved = await publishCollection({ name, identifier, body, previousItems: collection?.items ?? [] });
      dispatch(upsertCollection(saved));
      if (name === myName) {
        dispatch(
          addToMine({
            name,
            identifier,
            title: saved.title,
            description: saved.description,
            created: saved.created,
            updated: saved.updated,
          })
        );
      }
      dispatch(setNotification({ msg: isEdit ? "Collection saved" : "Collection created", alertType: "success" }));
      onSaved?.(saved);
      onClose();
    } catch (error) {
      // A "no" in Hub's dialog is the user's choice, not a failure: keep the form open, no error.
      if (isHubDecline(error)) {
        setError(null);
        return;
      }
      setError(isEdit ? "The collection was not saved." : "The collection was not created.");
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
      title={isEdit ? "Edit collection" : "New collection"}
      maxWidth="xs"
      actions={
        <>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} disabled={busy}>
            {busy ? "Publishing…" : isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <Box component="form" onSubmit={(e) => { e.preventDefault(); save(); }} sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, COLLECTION_TITLE_MAX))}
          onBlur={() => setTouched(true)}
          required
          autoFocus
          fullWidth
          error={Boolean(titleError)}
          helperText={titleError ?? `${title.length}/${COLLECTION_TITLE_MAX}`}
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
        {startCount > 0 && (
          <Typography variant="body2">
            Starts with {startCount} {startCount === 1 ? "share" : "shares"}.
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Publishing a collection asks Hub to confirm and costs the usual small QDN fee.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </Box>
    </ResponsiveDialog>
  );
}
