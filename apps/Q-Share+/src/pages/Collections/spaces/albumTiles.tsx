import { memo, useState, type MouseEvent } from "react";
import { useInView } from "react-intersection-observer";
import { Box, IconButton, Skeleton, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import { PHONE_MEDIA } from "../../../hooks/usePhoneLayout";
import { useQdnImage } from "../../../hooks/useQdnImage";
import { fileKind, fileKindIconElement } from "../../../utils/fileKind";
import { formatBytes } from "../../../utils/formatBytes";
import { otherShareNote, type AlbumPhoto } from "./albumModel";
import { useAlbumPicture } from "./albumPicture";
import type { SpaceShare } from "./useSpaceItems";

/** Opens the owner's menu for a share. */
export type OpenAlbumMenu = (anchor: HTMLElement, shareKey: string) => void;

/**
 * Rows the same height that fill the width: each tile grows by its picture's
 * shape, and the spacer keeps the last row from stretching.
 */
export const JustifiedRows = styled("ul")(({ theme }) => ({
  "--album-row": "240px",
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  gap: theme.spacing(0.5),
  "&::after": { content: '""', flexGrow: 10000 },
  "&[data-few]": { "--album-row": "420px" },
  [`@media ${PHONE_MEDIA}`]: {
    "--album-row": "120px",
    "&[data-few]": { "--album-row": "240px" },
  },
}));

const TileRoot = styled("li")({
  position: "relative",
  minWidth: 0,
  "&:hover, &:focus-within": { zIndex: 1 },
  "&:hover .album-menu, &:focus-within .album-menu": { opacity: 1 },
  "&:hover .album-caption, &:focus-within .album-caption": { opacity: 1 },
  "&:hover img": { transform: "scale(1.03)" },
  "@media (hover: none)": {
    "& .album-menu, & .album-caption": { opacity: 1 },
  },
  [`@media ${PHONE_MEDIA}`]: {
    "& .album-menu, & .album-caption": { opacity: 1 },
  },
});

const TileButton = styled("button")(({ theme }) => ({
  appearance: "none",
  display: "block",
  position: "relative",
  width: "100%",
  height: "100%",
  padding: 0,
  border: 0,
  font: "inherit",
  color: theme.palette.text.primary,
  textAlign: "left",
  cursor: "zoom-in",
  overflow: "hidden",
  borderRadius: Number(theme.shape.borderRadius) / 2,
  backgroundColor: theme.palette.action.hover,
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
}));

const TileImage = styled("img")({
  position: "absolute",
  inset: 0,
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
  transition: "opacity 240ms ease, transform 400ms ease",
  "@media (prefers-reduced-motion: reduce)": { transition: "none", transform: "none !important" },
});

const Placeholder = styled("span")(({ theme }) => ({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  gap: 2,
  padding: theme.spacing(1),
  overflow: "hidden",
  backgroundImage: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.08)}, transparent 70%)`,
}));

const Caption = styled("span")(({ theme }) => ({
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  padding: theme.spacing(2.5, 1, 0.75),
  fontSize: 13,
  lineHeight: 1.3,
  fontWeight: 600,
  color: theme.palette.common.white,
  // Solid enough behind the words that a white picture still reads 4.5:1.
  backgroundImage: `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.74)} 70%, ${alpha(theme.palette.common.black, 0)})`,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  opacity: 0,
  transition: "opacity 160ms ease",
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

const MenuSpot = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: 2,
  right: 2,
  width: 44,
  height: 44,
  opacity: 0,
  color: theme.palette.common.white,
  // Drawn as a dot inside the 44 px target, so it stays small on the picture.
  background: `radial-gradient(circle, ${alpha(theme.palette.common.black, 0.62)} 15px, transparent 16px)`,
  transition: "opacity 160ms ease",
  "&:hover": { background: `radial-gradient(circle, ${alpha(theme.palette.common.black, 0.8)} 15px, transparent 16px)` },
  '&[aria-expanded="true"], &:focus-visible': { opacity: 1 },
  "&:focus-visible": { outline: `2px solid ${theme.palette.common.white}`, outlineOffset: -4 },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

const PlainMenuButton = styled(IconButton)({ width: 44, height: 44, flexShrink: 0 });

const RATIO_MIN = 0.6;
const RATIO_MAX = 2.2;
// A picture's shape once seen, so coming back to a page doesn't move its rows.
const ratios = new Map<string, number>();

interface TileShape {
  ratio: number;
}

const tileStyle = ({ ratio }: TileShape) => ({
  flexGrow: ratio,
  flexShrink: 1,
  flexBasis: `calc(var(--album-row) * ${ratio})`,
  aspectRatio: String(ratio),
});

interface PhotoTileProps {
  photo: AlbumPhoto;
  /** A picture with no heading above it says which share it is from. */
  captioned: boolean;
  /** Opened in the lightbox already, so on the node. */
  revealed: boolean;
  /** Owner only: this tile carries the share's Move and Remove. */
  menu: boolean;
  onOpen: (key: string) => void;
  onMenu: OpenAlbumMenu;
}

/** One picture: only what the node has, and otherwise a soft tile that loads it on a tap. */
export const PhotoTile = memo(
  function PhotoTile({ photo, captioned, revealed, menu, onOpen, onMenu }: PhotoTileProps) {
    const { file, share } = photo;
    const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
    const { src, onError } = useAlbumPicture(photo, inView, revealed);
    const [ratio, setRatio] = useState(() => ratios.get(file.identifier) ?? 1);
    const [shownSrc, setShownSrc] = useState<string | null>(null);
    const name = file.filename || "Photo";
    const title = share.title || share.identifier;
    const shown = src !== null && shownSrc === src;
    return (
      <TileRoot ref={ref} style={tileStyle({ ratio })}>
        <TileButton type="button" onClick={() => onOpen(photo.key)} aria-label={`Open ${name}, from ${title}`}>
          {src ? null : (
            <Placeholder>
              <ImageOutlinedIcon sx={{ color: "text.secondary", fontSize: 22, mb: "auto" }} />
              <Typography
                component="span"
                sx={{ fontSize: 13, lineHeight: 1.3, fontWeight: 600, overflow: "hidden", wordBreak: "break-word", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
              >
                {captioned ? title : name}
              </Typography>
              <Typography component="span" noWrap sx={{ fontSize: 12, color: "text.secondary" }}>
                Tap to load{file.size ? ` · ${formatBytes(file.size, 1)}` : ""}
              </Typography>
            </Placeholder>
          )}
          {src ? (
            <TileImage
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              onError={onError}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                setShownSrc(src);
                if (naturalWidth > 0 && naturalHeight > 0) {
                  const next = Math.min(RATIO_MAX, Math.max(RATIO_MIN, naturalWidth / naturalHeight));
                  ratios.set(file.identifier, next);
                  setRatio(next);
                }
              }}
              style={{ opacity: shown ? 1 : 0 }}
            />
          ) : null}
          {captioned && shown ? <Caption className="album-caption">{title}</Caption> : null}
        </TileButton>
        {menu ? <TileMenuButton overlay share={share} onMenu={onMenu} /> : null}
      </TileRoot>
    );
  },
  (a, b) =>
    a.photo.key === b.photo.key &&
    a.photo.file === b.photo.file &&
    a.photo.thumbnailUrl === b.photo.thumbnailUrl &&
    a.photo.share.title === b.photo.share.title &&
    a.captioned === b.captioned &&
    a.revealed === b.revealed &&
    a.menu === b.menu &&
    a.onOpen === b.onOpen &&
    a.onMenu === b.onMenu
);

function TileMenuButton({ share, onMenu, overlay }: { share: SpaceShare; onMenu: OpenAlbumMenu; overlay?: boolean }) {
  const Spot = overlay ? MenuSpot : PlainMenuButton;
  const open = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onMenu(event.currentTarget, share.key);
  };
  return (
    <Spot
      className={overlay ? "album-menu" : undefined}
      aria-label={`Options for ${share.title || share.identifier}`}
      aria-haspopup="menu"
      onClick={open}
    >
      <MoreVertRoundedIcon fontSize="small" />
    </Spot>
  );
}

/** A share whose body is still on its way, about the size of a picture. */
export function PendingTile() {
  return (
    <TileRoot aria-hidden style={tileStyle({ ratio: 1 })}>
      <Skeleton variant="rounded" sx={{ width: "100%", height: "100%" }} />
    </TileRoot>
  );
}

const OtherRoot = styled("li")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

const OtherButton = styled("button")(({ theme }) => ({
  appearance: "none",
  flex: 1,
  minWidth: 0,
  minHeight: 64,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(0.75),
  border: 0,
  background: "transparent",
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
  borderRadius: theme.shape.borderRadius,
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

interface OtherTileProps {
  share: SpaceShare;
  menu: boolean;
  onOpenShare: (key: string) => void;
  onMenu: OpenAlbumMenu;
}

/** A share with no picture to show, deleted ones too: small, captioned, and it opens the share. */
export const OtherTile = memo(
  function OtherTile({ share, menu, onOpenShare, onMenu }: OtherTileProps) {
    const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });
    const { src, onError } = useQdnImage(inView ? share.thumbnailUrl : null);
    const first = share.files[0];
    const title = share.title || share.identifier;
    const note = otherShareNote(share);
    return (
      <OtherRoot ref={ref}>
        <OtherButton type="button" onClick={() => onOpenShare(share.key)} aria-label={`Open ${title}. ${note}`}>
          <Box
            aria-hidden
            sx={{
              position: "relative",
              flexShrink: 0,
              width: 52,
              height: 52,
              overflow: "hidden",
              borderRadius: 0.5,
              bgcolor: "action.hover",
              color: "text.secondary",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {fileKindIconElement(first ? fileKind(first.mimetype, first.filename) : "other")}
            {src ? <TileImage src={src} alt="" loading="lazy" decoding="async" onError={onError} /> : null}
          </Box>
          <Box component="span" sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
            <Typography
              component="span"
              sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", wordBreak: "break-word", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
            >
              {title}
            </Typography>
            <Typography component="span" noWrap sx={{ fontSize: 13, color: "text.secondary" }}>
              {note}
            </Typography>
          </Box>
        </OtherButton>
        {menu ? <TileMenuButton share={share} onMenu={onMenu} /> : null}
      </OtherRoot>
    );
  },
  (a, b) =>
    a.share.key === b.share.key &&
    a.share.title === b.share.title &&
    a.share.thumbnailUrl === b.share.thumbnailUrl &&
    a.share.files === b.share.files &&
    a.share.deleted === b.share.deleted &&
    a.share.unreadable === b.share.unreadable &&
    a.share.unavailable === b.share.unavailable &&
    a.menu === b.menu &&
    a.onOpenShare === b.onOpenShare &&
    a.onMenu === b.onMenu
);
