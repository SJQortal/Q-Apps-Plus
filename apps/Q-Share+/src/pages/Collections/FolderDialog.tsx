import { useState } from "react";
import { useDispatch } from "react-redux";
import { Alert, Box, Button, TextField, Typography } from "@mui/material";
import { ResponsiveDialog } from "../../components/common/mobile/ResponsiveDialog";
import { upsertCollection } from "../../state/features/collectionsSlice";
import { setNotification } from "../../state/features/notificationsSlice";
import {
  FOLDER_DESCRIPTION_MAX,
  FOLDER_TITLE_MAX,
  editCollectionBody,
  publishCollection,
  type Collection,
  type CollectionFolder,
} from "../../utils/collections";
import { addFolder, editFolder, newFolderId } from "../../utils/collectionFolders";
import { isHubDecline } from "../../utils/hubErrors";

export interface FolderDialogProps {
  open: boolean;
  onClose: () => void;
  collection: Collection;
  /** Edit this folder; omit to make a new one inside `parentId`. */
  folder?: CollectionFolder | null;
  /** Where a new folder goes: a folder's id, or null for the collection itself. */
  parentId?: string | null;
  onSaved?: (folderId: string, saved: Collection) => void;
}

/**
 * Make or edit a folder inside a collection. The folder lives in the
 * collection's JSON, so saving republishes the collection: one
 * PUBLISH_QDN_RESOURCE, confirmed in Hub.
 */
export function FolderDialog({ open, onClose, collection, folder, parentId = null, onSaved }: FolderDialogProps) {
  const dispatch = useDispatch();
  const isEdit = Boolean(folder);
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
      setTitle(folder?.title ?? "");
      setDescription(folder?.description ?? "");
      setTouched(false);
      setBusy(false);
      setError(null);
    }
  }

  const trimmedTitle = title.trim();
  const titleError = touched && !trimmedTitle ? "Give the folder a title" : null;

  const save = async () => {
    setTouched(true);
    if (!trimmedTitle) return;
    setBusy(true);
    setError(null);
    try {
      const id = folder?.id ?? newFolderId(collection);
      const changed = folder
        ? editFolder(collection, folder.id, { title: trimmedTitle, description: description.trim() })
        : addFolder(collection, parentId, { id, title: trimmedTitle, description: description.trim(), items: [], folders: [] });
      const saved = await publishCollection({
        name: collection.name,
        identifier: collection.identifier,
        body: editCollectionBody(changed),
        previous: collection,
      });
      dispatch(upsertCollection(saved));
      dispatch(setNotification({ msg: isEdit ? "Folder saved" : "Folder created", alertType: "success" }));
      onSaved?.(id, saved);
      onClose();
    } catch (error) {
      // A "no" in Hub's dialog is the user's choice, not a failure: keep the form open, no error.
      if (!isHubDecline(error)) setError(isEdit ? "The folder was not saved." : "The folder was not created.");
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
      title={isEdit ? "Edit folder" : "New folder"}
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
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}
      >
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, FOLDER_TITLE_MAX))}
          onBlur={() => setTouched(true)}
          required
          autoFocus
          fullWidth
          error={Boolean(titleError)}
          helperText={titleError ?? `${title.length}/${FOLDER_TITLE_MAX}`}
          slotProps={{ htmlInput: { maxLength: FOLDER_TITLE_MAX } }}
        />
        <TextField
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, FOLDER_DESCRIPTION_MAX))}
          multiline
          minRows={2}
          fullWidth
          helperText={`${description.length}/${FOLDER_DESCRIPTION_MAX}`}
          slotProps={{ htmlInput: { maxLength: FOLDER_DESCRIPTION_MAX } }}
        />
        <Typography variant="body2" color="text.secondary">
          The folder is part of “{collection.title}”: saving republishes the collection, so Hub asks to confirm and the
          usual small QDN fee applies.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </Box>
    </ResponsiveDialog>
  );
}
