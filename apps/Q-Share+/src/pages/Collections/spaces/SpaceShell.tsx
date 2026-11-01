import type { ReactNode } from "react";
import { Box, Button, IconButton, Skeleton, Tooltip, Typography, type SxProps, type Theme } from "@mui/material";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import RemoveCircleOutlinedIcon from "@mui/icons-material/RemoveCircleOutlined";
import { ListViewToggle, useListView } from "../../../components/common/ListViewToggle";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { shareKey, type Video } from "../../../state/features/fileSlice";
import { FileList } from "../../Home/FileList";
import { CollectionCover } from "../CollectionCover";
import { InfoCard, ItemRow, ItemRows } from "../Collections-styles";
import type { SpaceProps } from "./types";
import type { SpaceItems, SpaceShare } from "./useSpaceItems";

interface SpaceShellProps {
  space: SpaceProps["space"];
  /** The top of the page; SpaceHero is the plain one. It holds the page's h1. */
  hero: ReactNode;
  children?: ReactNode;
  sx?: SxProps<Theme>;
}

/** Every space's root: `data-space` to scope its styles, the hero, then the space's own layout. */
export function SpaceShell({ space, hero, children, sx }: SpaceShellProps) {
  return (
    <Box
      data-space={space}
      sx={[{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {hero}
      {children}
    </Box>
  );
}

/** A plain hero: the cover, the way here, the title, what it is, and its actions. */
export function SpaceHero({ cover, folder, breadcrumb, title, description, attribution, actions }: SpaceProps) {
  const phone = usePhoneLayout();
  return (
    <InfoCard aria-label={folder ? "About this folder" : "About this collection"}>
      <CollectionCover cover={cover} kind={folder ? "folder" : "collection"} size={phone ? 88 : 120} />
      <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
        {breadcrumb}
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
          {title}
        </Typography>
        {description ? (
          <Typography sx={{ mt: 0.5, color: "text.secondary", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {description}
          </Typography>
        ) : null}
        {attribution}
      </Box>
      {actions}
    </InfoCard>
  );
}

interface ShareOwnerActionsProps {
  share: SpaceShare;
  onMove: ((share: Video) => void) | undefined;
  onRemove: (share: Video) => void;
  sx?: SxProps<Theme>;
}

/** The owner's Move (when the collection has folders) and Remove for one share: 44 px, as the standard rows. */
export function ShareOwnerActions({ share, onMove, onRemove, sx }: ShareOwnerActionsProps) {
  const title = share.title || share.identifier;
  const buttonSx = [{ minWidth: 44, minHeight: 44 }, ...(Array.isArray(sx) ? sx : [sx])] as SxProps<Theme>;
  return (
    <>
      {onMove ? (
        <Tooltip title="Move to a folder">
          <IconButton aria-label={`Move ${title}`} onClick={() => onMove(share.row)} sx={buttonSx}>
            <DriveFileMoveOutlinedIcon />
          </IconButton>
        </Tooltip>
      ) : null}
      <Tooltip title="Remove from collection">
        <IconButton aria-label={`Remove ${title} from collection`} onClick={() => onRemove(share.row)} sx={buttonSx}>
          <RemoveCircleOutlinedIcon />
        </IconButton>
      </Tooltip>
    </>
  );
}

/** "Show more", for as long as there are more: each tap loads one more page of bodies. */
export function SpaceShowMore({ items }: { items: SpaceItems }) {
  if (!items.hasMore) return null;
  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Button variant="outlined" startIcon={<ExpandMoreRoundedIcon />} onClick={items.showMore} sx={{ minHeight: 44 }}>
        Show more ({items.total - items.shares.length})
      </Button>
    </Box>
  );
}

/**
 * The standard page's shares, with their toggle and owner buttons, and Show
 * more. For shares a space has no special place for.
 */
export function SpaceShareList({ shares, items, isOwner, onMove, onRemove }: {
  /** Defaults to everything shown so far. */
  shares?: SpaceShare[];
  items: SpaceItems;
  isOwner: boolean;
  onMove: SpaceProps["onMove"];
  onRemove: SpaceProps["onRemove"];
}) {
  const grid = useListView("collectionView") === "grid";
  const listed = shares ?? items.shares;
  if (listed.length === 0) return null;
  const files = listed.map((share) => share.row);
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: -1 }}>
        <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16 }}>
          Shares
        </Typography>
        <ListViewToggle setting="collectionView" />
      </Box>
      {isOwner && grid ? (
        <FileList files={files} layout="collectionView" onRemove={onRemove} onMove={onMove} />
      ) : isOwner ? (
        <ItemRows>
          {listed.map((share) => (
            <ItemRow key={shareKey(share.user, share.identifier)}>
              <FileList files={[share.row]} layout="collectionView" />
              <ShareOwnerActions share={share} onMove={onMove} onRemove={onRemove} />
            </ItemRow>
          ))}
        </ItemRows>
      ) : (
        <FileList files={files} layout="collectionView" />
      )}
      <SpaceShowMore items={items} />
    </>
  );
}

/** Placeholder while a space's code loads, about the shape of a hero and a few rows. */
export function SpaceSkeleton() {
  return (
    <Box aria-busy="true" aria-label="Loading collection" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Skeleton variant="rounded" sx={{ width: "100%", height: 160 }} />
      {[0, 1, 2].map((n) => (
        <Skeleton key={n} variant="rounded" sx={{ width: "100%", height: 64 }} />
      ))}
    </Box>
  );
}
