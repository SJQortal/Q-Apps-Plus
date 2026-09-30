import { useMemo, useState, type MouseEvent } from "react";
import { useDispatch } from "react-redux";
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  MenuList,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BookmarkAddOutlinedIcon from "@mui/icons-material/BookmarkAddOutlined";
import BookmarkAddedIcon from "@mui/icons-material/BookmarkAdded";
import BookmarkBorderOutlinedIcon from "@mui/icons-material/BookmarkBorderOutlined";
import CheckIcon from "@mui/icons-material/Check";
import { BottomSheet } from "../mobile/BottomSheet";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { CollectionDialog } from "../../../pages/Collections/CollectionDialog";
import { upsertCollection } from "../../../state/features/collectionsSlice";
import { setNotification } from "../../../state/features/notificationsSlice";
import {
  buildCollectionBody,
  collectionKey,
  fetchCollection,
  hasItem,
  publishCollection,
  toggleItem,
  type CollectionSummary,
} from "../../../utils/collections";
import { useMyCollections } from "./useMyCollections";

export interface SaveToCollectionButtonProps {
  share: { name: string; identifier: string; title?: string };
  size?: "small" | "medium";
  variant?: "icon" | "button";
  /** With variant "button": the one-word label for the share page's phone action row. */
  compact?: boolean;
}

const LABEL = "Add to collection";

/**
 * Add a share to one of the signed-in name's collections. Opens a bottom
 * sheet on phones and a menu on wider screens; each toggle republishes that
 * collection (one Hub confirmation). Renders nothing when not signed in.
 * Called "Add to collection", not "Save": on the share page "Save" is the
 * file row's SAVE_FILE.
 */
export function SaveToCollectionButton({ share, size = "small", variant = "icon", compact = false }: SaveToCollectionButtonProps) {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const { myName, mine, loading, error, byKey, reload } = useMyCollections();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // The dialog mounts on first use: one per row would otherwise run its hooks for nothing.
  const [dialogMounted, setDialogMounted] = useState(false);
  const openDialog = () => {
    setDialogMounted(true);
    setDialogOpen(true);
  };
  const item = useMemo(() => ({ name: share.name, identifier: share.identifier }), [share.name, share.identifier]);

  const savedIn = useMemo(
    () =>
      (mine ?? []).filter((row) => {
        const collection = byKey[collectionKey(row.name, row.identifier)];
        return collection ? hasItem(collection, item) : false;
      }),
    [mine, byKey, item]
  );

  if (!myName) return null;

  const saved = savedIn.length > 0;
  const open = Boolean(anchor) || sheetOpen;
  const openPicker = (event: MouseEvent<HTMLElement>) => {
    // Opening before the deferred first load has run: fetch the list now.
    if (mine === null && !loading) void reload();
    if (phone) setSheetOpen(true);
    else setAnchor(event.currentTarget);
  };
  const closePicker = () => {
    setAnchor(null);
    setSheetOpen(false);
  };

  const toggle = async (row: CollectionSummary) => {
    closePicker();
    const key = collectionKey(row.name, row.identifier);
    let current = byKey[key];
    try {
      if (!current) current = await fetchCollection(row.name, row.identifier);
    } catch {
      current = null;
    }
    if (!current) {
      dispatch(setNotification({ msg: `Could not load ${row.title || "that collection"}`, alertType: "error" }));
      return;
    }
    const adding = !hasItem(current, item);
    const next = toggleItem(current, item);
    const body = buildCollectionBody({
      title: next.title,
      description: next.description,
      items: next.items,
      created: next.created,
    });
    dispatch(upsertCollection({ ...next, ...body }));
    try {
      const published = await publishCollection({ name: row.name, identifier: row.identifier, body });
      dispatch(upsertCollection(published));
      dispatch(
        setNotification({
          msg: adding ? `Added to ${published.title}` : `Removed from ${published.title}`,
          alertType: "success",
        })
      );
    } catch {
      dispatch(upsertCollection(current));
      dispatch(setNotification({ msg: `Could not update ${current.title}`, alertType: "error" }));
    }
  };

  const rows = (
    <>
      {loading && !mine ? (
        <MenuItem disabled sx={{ minHeight: 48, opacity: 1 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <CircularProgress size={18} />
          </ListItemIcon>
          <ListItemText primary="Loading your collections…" />
        </MenuItem>
      ) : null}
      {error ? (
        <MenuItem onClick={() => reload()} sx={{ minHeight: 48 }}>
          <ListItemText primary="Couldn't load your collections" secondary="Tap to retry" />
        </MenuItem>
      ) : null}
      {mine && mine.length === 0 ? (
        <MenuItem disabled sx={{ minHeight: 48 }}>
          <ListItemText primary="No collections yet" secondary="Make one below" />
        </MenuItem>
      ) : null}
      {(mine ?? []).map((row) => {
        const key = collectionKey(row.name, row.identifier);
        const collection = byKey[key];
        const checked = collection ? hasItem(collection, item) : false;
        return (
          <MenuItem
            key={key}
            role="menuitemcheckbox"
            aria-checked={checked}
            onClick={() => toggle(row)}
            sx={{ minHeight: 48 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {checked ? <CheckIcon color="primary" /> : <BookmarkBorderOutlinedIcon sx={{ opacity: 0.6 }} />}
            </ListItemIcon>
            <ListItemText
              primary={row.title || row.identifier}
              secondary={collection ? (collection.items.length === 0 ? "Empty" : `${collection.items.length} ${collection.items.length === 1 ? "item" : "items"}`) : undefined}
              slotProps={{ primary: { noWrap: true } }}
            />
          </MenuItem>
        );
      })}
      <Divider />
      <MenuItem
        onClick={() => {
          closePicker();
          openDialog();
        }}
        sx={{ minHeight: 48 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <AddIcon />
        </ListItemIcon>
        <ListItemText primary="New collection…" />
      </MenuItem>
    </>
  );

  const tooltip = saved
    ? `In ${savedIn.length} ${savedIn.length === 1 ? "collection" : "collections"}`
    : LABEL;
  const icon = saved ? <BookmarkAddedIcon fontSize={size} /> : <BookmarkAddOutlinedIcon fontSize={size} />;
  const buttonLabel = compact ? (saved ? "Collected" : "Collect") : saved ? "In collection" : LABEL;

  return (
    <>
      {variant === "button" ? (
        <Button
          size={size}
          variant="outlined"
          startIcon={icon}
          aria-label={LABEL}
          aria-pressed={saved}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={openPicker}
          sx={{ minHeight: phone ? 44 : undefined }}
        >
          {buttonLabel}
        </Button>
      ) : (
        <Tooltip title={tooltip}>
          <IconButton
            size={size}
            aria-label={LABEL}
            aria-pressed={saved}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={openPicker}
            sx={{
              color: saved ? "primary.main" : undefined,
              // Same 44 px target as the row's Copy link on phones.
              minWidth: phone ? 44 : undefined,
              minHeight: phone ? 44 : undefined,
            }}
          >
            {icon}
          </IconButton>
        </Tooltip>
      )}

      {phone ? (
        <BottomSheet open={sheetOpen} onClose={closePicker} title={LABEL}>
          <MenuList sx={{ mx: -2 }}>{rows}</MenuList>
        </BottomSheet>
      ) : (
        <Menu
          open={Boolean(anchor)}
          anchorEl={anchor}
          onClose={closePicker}
          slotProps={{ list: { "aria-label": LABEL, dense: false }, paper: { sx: { minWidth: 240, maxWidth: 320 } } }}
        >
          {rows}
        </Menu>
      )}

      {dialogMounted ? (
        <CollectionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initialItems={[item]}
          onSaved={() => setDialogOpen(false)}
        />
      ) : null}
    </>
  );
}
