import { useQdnImage } from "../../hooks/useQdnImage";
import { Box, type SxProps, type Theme } from "@mui/material";
import CollectionsBookmarkOutlinedIcon from "@mui/icons-material/CollectionsBookmarkOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { coverUrl, type CollectionCover as Cover } from "../../utils/collections";

interface CollectionCoverProps {
  cover?: Pick<Cover, "name" | "identifier"> | null;
  /** A local image not published yet (the dialogs' preview). */
  src?: string | null;
  kind?: "collection" | "folder";
  /** Width and height in px; omit to fill the parent's width as a square. */
  size?: number;
  sx?: SxProps<Theme>;
}

/**
 * A collection's or folder's cover: a square image, loaded only when it
 * scrolls into view, or the collection or folder icon when there is none or
 * the node can't serve it. Decorative: the title beside it names it.
 */
export function CollectionCover({ cover, src, kind = "collection", size, sx }: CollectionCoverProps) {
  const image = useQdnImage(src ?? (cover ? coverUrl(cover) : null));
  const Icon = kind === "folder" ? FolderOutlinedIcon : CollectionsBookmarkOutlinedIcon;
  return (
    <Box
      aria-hidden
      sx={[
        {
          position: "relative",
          flexShrink: 0,
          width: size ?? "100%",
          height: size ?? "auto",
          aspectRatio: "1 / 1",
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: "action.hover",
          color: "text.secondary",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {image.src ? (
        <img
          src={image.src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={image.onError}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Icon sx={{ fontSize: size ? Math.max(20, Math.round(size * 0.42)) : 48 }} />
      )}
    </Box>
  );
}
