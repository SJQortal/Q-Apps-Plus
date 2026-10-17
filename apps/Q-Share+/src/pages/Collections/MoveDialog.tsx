import { List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { ResponsiveDialog } from "../../components/common/mobile/ResponsiveDialog";
import type { Collection } from "../../utils/collections";
import { containerOptions } from "../../utils/collectionFolders";

interface MoveDialogProps {
  open: boolean;
  onClose: () => void;
  collection: Collection;
  /** The share being moved, for the title. */
  shareTitle: string;
  /** Where it is now: a folder's id, or null for the collection itself. */
  from: string | null;
  busy: boolean;
  onMove: (to: string | null) => void;
}

/** Pick where in the collection a share goes: the collection itself or any of its folders. */
export function MoveDialog({ open, onClose, collection, shareTitle, from, busy, onMove }: MoveDialogProps) {
  const options = containerOptions(collection);
  return (
    <ResponsiveDialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      dismissible={!busy}
      title="Move to"
      maxWidth="xs"
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Where should “{shareTitle}” go? Moving republishes the collection: Hub asks you to confirm.
      </Typography>
      <List aria-label="Folders in this collection" sx={{ mx: -1 }}>
        {options.map((option) => {
          const here = option.id === from;
          const label = option.id === null ? option.title || "Untitled collection" : option.title || "Untitled folder";
          return (
            <ListItemButton
              key={option.id ?? "root"}
              disabled={here || busy}
              onClick={() => onMove(option.id)}
              sx={{ minHeight: 48, pl: 1 + Math.min(option.depth, 4) * 2, borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {option.id === null ? <CollectionsBookmarkOutlinedIcon /> : <FolderOutlinedIcon />}
              </ListItemIcon>
              <ListItemText
                primary={label}
                secondary={here ? "It's here now" : option.id === null ? "The collection itself" : undefined}
                slotProps={{ primary: { noWrap: true } }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </ResponsiveDialog>
  );
}
