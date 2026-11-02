import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import {
  Box,
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
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
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
import { containsItem, findFolder, hasItemIn, toggleItemIn, type Container } from "../../../utils/collectionFolders";
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
 * one: each collection is listed with its folders below it, folded until
 * opened with its arrow (or the Right key), except where the share already
 * sits in a folder, so a tick is never hidden. Opens a bottom
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
  // Places opened or closed against their default (folded, or open when the share is below them).
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(() => new Set());
  const flip = (placeKey: string) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(placeKey)) next.delete(placeKey);
      else next.add(placeKey);
      return next;
    });
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
        return collection ? containsItem(collection, item) : false;
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
    setFlipped(new Set());
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
        const collectionTitle = row.title || collection?.title || row.identifier;
        const out: ReactNode[] = [];
        // The collection itself, then its folders in tree order, indented, each under an open parent only.
        const visit = (container: Container | null, id: string | null, title: string, depth: number) => {
          const placeKey = `${key}/${id ?? ""}`;
          const folders = container?.folders ?? [];
          const below = folders.some((folder) => containsItem(folder, item));
          const expanded = folders.length > 0 && below !== flipped.has(placeKey);
          const checked = container ? hasItemIn(container, null, item) : false;
          const count = container?.items.length ?? 0;
          const label = id === null ? title : title || "Untitled folder";
          const counts = container
            ? [
                count === 0 ? "Empty" : `${count} ${count === 1 ? "share" : "shares"}`,
                ...(folders.length > 0 && !expanded ? [`${folders.length} ${folders.length === 1 ? "folder" : "folders"}`] : []),
              ].join(" · ")
            : undefined;
          const onKeyDown = (event: KeyboardEvent) => {
            if (folders.length === 0) return;
            if ((event.key === "ArrowRight" && !expanded) || (event.key === "ArrowLeft" && expanded)) {
              event.preventDefault();
              event.stopPropagation();
              flip(placeKey);
            }
          };
          out.push(
            <MenuItem
              key={placeKey}
              role="menuitemcheckbox"
              aria-checked={checked}
              aria-expanded={folders.length > 0 ? expanded : undefined}
              aria-label={id === null ? label : `${label}, in ${collectionTitle}`}
              onClick={() => toggle(row, id)}
              onKeyDown={onKeyDown}
              sx={{ minHeight: 48, pl: 2 + Math.min(depth, 4) * 2, pr: folders.length > 0 ? 0.5 : undefined }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {checked ? (
                  <CheckIcon color="primary" />
                ) : id === null ? (
                  <BookmarkBorderOutlinedIcon sx={{ opacity: 0.6 }} />
                ) : (
                  <FolderOutlinedIcon sx={{ opacity: 0.6 }} />
                )}
              </ListItemIcon>
              <ListItemText primary={label} secondary={counts} slotProps={{ primary: { noWrap: true } }} />
              {folders.length > 0 ? (
                // Opens or folds the folders without adding the share; keyboards use Right and Left.
                <Box
                  component="span"
                  aria-hidden
                  // A plain hover hint: a tooltip would open outside the menu.
                  title={expanded ? "Hide folders" : "Show folders"}
                  data-testid={`folders-${placeKey}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    flip(placeKey);
                  }}
                  sx={{
                    flexShrink: 0,
                    ml: 1,
                    width: 44,
                    height: 44,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    color: "text.secondary",
                    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
                  }}
                >
                  <ChevronRightRoundedIcon
                    sx={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 150ms", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}
                  />
                </Box>
              ) : null}
            </MenuItem>
          );
          if (expanded) for (const folder of folders) visit(folder, folder.id, folder.title, depth + 1);
        };
        visit(collection ?? null, null, collectionTitle, 0);
        return out;
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
          slotProps={{ list: { "aria-label": LABEL, dense: false }, paper: {
              // A landmark of its own: the menu opens outside the page's main region.
              role: "region",
              "aria-label": LABEL,
              sx: { minWidth: 240, maxWidth: 320 },
            }, }}
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
