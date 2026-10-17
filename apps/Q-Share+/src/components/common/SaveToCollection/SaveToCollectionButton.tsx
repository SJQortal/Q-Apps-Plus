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
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { BottomSheet } from "../mobile/BottomSheet";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { CollectionDialog } from "../../../pages/Collections/CollectionDialog";
import { upsertCollection } from "../../../state/features/collectionsSlice";
import { setNotification } from "../../../state/features/notificationsSlice";
import {
  collectionKey,
  editCollectionBody,
  fetchCollection,
  publishCollection,
  type CollectionSummary,
} from "../../../utils/collections";
import { allCollectionItems, containerOptions, findFolder, hasItemIn, toggleItemIn } from "../../../utils/collectionFolders";
import { isHubDecline } from "../../../utils/hubErrors";
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
 * Add a share to one of the signed-in name's collections, or to a folder in
 * one: each collection is listed with its folders below it. Opens a bottom
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
        return collection ? allCollectionItems(collection).some((i) => i.name === item.name && i.identifier === item.identifier) : false;
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

  const toggle = async (row: CollectionSummary, folderId: string | null = null) => {
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
    const adding = !hasItemIn(current, folderId, item);
    const next = toggleItemIn(current, folderId, item);
    const body = editCollectionBody(next);
    const place = folderId ? findFolder(current, folderId)?.folder.title || "the folder" : null;
    dispatch(upsertCollection({ ...next, ...body }));
    try {
      const published = await publishCollection({
        name: row.name,
        identifier: row.identifier,
        body,
        previous: current,
      });
      dispatch(upsertCollection(published));
      dispatch(
        setNotification({
          msg: adding ? `Added to ${place ?? published.title}` : `Removed from ${place ?? published.title}`,
          alertType: "success",
        })
      );
    } catch (error) {
      dispatch(upsertCollection(current));
      // Saying no in Hub's publish dialog is not an error: just undo.
      if (!isHubDecline(error)) dispatch(setNotification({ msg: `Could not update ${current.title}`, alertType: "error" }));
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
      {(mine ?? []).flatMap((row) => {
        const key = collectionKey(row.name, row.identifier);
        const collection = byKey[key];
        // The collection itself, then its folders in tree order, indented.
        const places = collection ? containerOptions(collection) : [{ id: null, title: row.title, depth: 0 }];
        return places.map((place) => {
          const checked = collection ? hasItemIn(collection, place.id, item) : false;
          const container = collection ? (place.id ? findFolder(collection, place.id)?.folder : collection) : null;
          const count = container?.items.length ?? 0;
          const label =
            place.id === null ? row.title || collection?.title || row.identifier : place.title || "Untitled folder";
          return (
            <MenuItem
              key={`${key}/${place.id ?? ""}`}
              role="menuitemcheckbox"
              aria-checked={checked}
              aria-label={place.id === null ? label : `${label}, in ${row.title || collection?.title || "collection"}`}
              onClick={() => toggle(row, place.id)}
              sx={{ minHeight: 48, pl: 2 + Math.min(place.depth, 4) * 2 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {checked ? (
                  <CheckIcon color="primary" />
                ) : place.id === null ? (
                  <BookmarkBorderOutlinedIcon sx={{ opacity: 0.6 }} />
                ) : (
                  <FolderOutlinedIcon sx={{ opacity: 0.6 }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={label}
                secondary={container ? (count === 0 ? "Empty" : `${count} ${count === 1 ? "share" : "shares"}`) : undefined}
                slotProps={{ primary: { noWrap: true } }}
              />
            </MenuItem>
          );
        });
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
  // Label in name (WCAG 2.5.3), so "tap Collected" works in Voice Access: the name is the visible
  // text, and the one-word phone label leads it with the rest as context ("Collected: In 2 collections").
  const buttonName = compact ? `${buttonLabel}: ${tooltip}` : undefined;

  return (
    <>
      {variant === "button" ? (
        <Button
          size={size}
          variant="outlined"
          startIcon={icon}
          aria-label={buttonName}
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
