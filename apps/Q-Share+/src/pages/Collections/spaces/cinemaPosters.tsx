import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, IconButton, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import HideImageOutlinedIcon from "@mui/icons-material/HideImageOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import MovieOutlinedIcon from "@mui/icons-material/MovieOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { ShareCardArt } from "../../../components/common/ShareArt";
import { PHONE_MEDIA, usePhoneLayout } from "../../../hooks/usePhoneLayout";
import { useQdnImage } from "../../../hooks/useQdnImage";
import type { Video } from "../../../state/features/fileSlice";
import { coverUrl, type CollectionFolder } from "../../../utils/collections";
import { formatBytes } from "../../../utils/formatBytes";
import { folderCountLabel } from "../FolderGrid";
import { ShareOwnerActions } from "./SpaceShell";
import { filmFrame, REDUCED_MOTION } from "./cinemaTheme";
import type { SpaceShare } from "./useSpaceItems";

/** What a poster can do. Stable across renders, so a body landing redraws only its own poster. */
export interface PosterHandlers {
  play: (share: SpaceShare) => void;
  open: (share: SpaceShare) => void;
  move: (share: Video) => void;
  remove: (share: Video) => void;
}

/** "2 videos · 1.4 GB", or "" with nothing to say. */
export function videosLabel(share: Pick<SpaceShare, "videos">): string {
  const count = share.videos.length;
  if (count === 0) return "";
  const bytes = share.videos.reduce((sum, file) => sum + (file.size ?? 0), 0);
  const videos = `${count} ${count === 1 ? "video" : "videos"}`;
  return bytes > 0 ? `${videos} · ${formatBytes(bytes, 1)}` : videos;
}

function posterNote(share: SpaceShare): string {
  if (share.deleted) return "Deleted by its publisher";
  if (share.unreadable) return "This share can't be read";
  if (share.unavailable) return "Not available right now";
  const videos = videosLabel(share);
  if (videos) return videos;
  const count = share.files.length;
  return count > 0 ? `${count} ${count === 1 ? "file" : "files"}` : "";
}

/** The title drawn on the art itself: from an attribute, so it isn't read out twice. */
const artTitleSx = {
  content: "attr(data-title)",
  position: "absolute",
  left: 12,
  right: 12,
  bottom: 14,
  color: "common.white",
  fontWeight: 700,
  fontSize: 14,
  lineHeight: 1.25,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  overflowWrap: "anywhere",
} as const;

function FilmPlaceholder({ seed, title, icon, dim }: { seed: string; title?: string; icon: ReactNode; dim?: boolean }) {
  return (
    <Box
      aria-hidden
      data-title={title}
      sx={[
        {
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
          opacity: dim ? 0.55 : 1,
          "& svg": { fontSize: 36, mb: title ? 3 : 0 },
          ...(title ? { "&::after": artTitleSx } : {}),
        },
        filmFrame(seed) as never,
      ]}
    >
      {icon}
    </Box>
  );
}

const SKELETON = (
  <li aria-hidden>
    <Skeleton variant="rounded" sx={{ width: "100%", height: "auto", aspectRatio: "16 / 9" }} />
    <Skeleton variant="text" sx={{ mt: 1, width: "75%" }} />
    <Skeleton variant="text" sx={{ width: "45%" }} />
  </li>
);

interface PosterProps {
  share: SpaceShare;
  isOwner: boolean;
  canMove: boolean;
  handlers: PosterHandlers;
}

function PosterView({ share, isOwner, canMove, handlers }: PosterProps) {
  if (!share.loaded && !share.unavailable) return SKELETON;

  const gone = share.deleted || share.unreadable;
  const playable = !gone && share.videos.length > 0;
  const series = playable && share.videos.length > 1;
  const note = posterNote(share);
  const placeholderIcon = gone ? <HideImageOutlinedIcon /> : playable ? <MovieOutlinedIcon /> : <InsertDriveFileOutlinedIcon />;
  const placeholder = <FilmPlaceholder seed={share.key} title={gone ? undefined : share.title} icon={placeholderIcon} dim={gone} />;

  const art = (
    <>
      {share.body && !gone ? <ShareCardArt share={share.body} fallback={placeholder} /> : placeholder}
      {gone ? null : (
        <Box
          aria-hidden
          className="poster-glass"
          data-title={share.title}
          sx={(theme) => ({
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 160ms ease",
            background: `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.9)}, ${alpha(theme.palette.common.black, 0.2)} 70%)`,
            "&::after": artTitleSx,
            [REDUCED_MOTION]: { transition: "none" },
          })}
        >
          <Box
            sx={{
              display: "flex",
              p: 1,
              mb: 3,
              borderRadius: "50%",
              bgcolor: "common.white",
              color: "common.black",
            }}
          >
            {playable ? <PlayArrowRoundedIcon /> : <OpenInNewRoundedIcon />}
          </Box>
        </Box>
      )}
    </>
  );

  const artSx = {
    position: "relative",
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    p: 0,
    border: 0,
    borderRadius: 1.5,
    overflow: "hidden",
    bgcolor: "background.paper",
    color: "inherit",
  } as const;

  return (
    <Box component="li" sx={{ minWidth: 0 }}>
      <Box
        className="poster-frame"
        sx={(theme) => ({
          position: "relative",
          borderRadius: 1.5,
          transition: "transform 200ms ease, box-shadow 200ms ease",
          // A share with several videos reads as a small stack of them.
          ...(series
            ? {
                boxShadow: `0 -4px 0 -2px ${alpha(theme.palette.common.white, 0.34)}, 0 -8px 0 -4px ${alpha(theme.palette.common.white, 0.16)}`,
              }
            : {}),
          "@media (hover: hover)": {
            "&:hover, &:focus-within": {
              transform: "scale(1.04)",
              zIndex: 2,
              boxShadow: `0 14px 34px ${alpha(theme.palette.common.black, 0.7)}`,
            },
            "&:hover .poster-glass, & button:focus-visible .poster-glass": { opacity: 1 },
            "& .poster-owner": { opacity: gone ? 1 : 0, transition: "opacity 160ms ease" },
            "&:hover .poster-owner, &:focus-within .poster-owner": { opacity: 1 },
          },
          [REDUCED_MOTION]: {
            transition: "none",
            "&:hover, &:focus-within": { transform: "none" },
          },
        })}
      >
        {gone ? (
          <Box sx={artSx}>{art}</Box>
        ) : (
          <Box
            component="button"
            type="button"
            aria-label={playable ? `Play ${share.title}` : `Open ${share.title}`}
            onClick={() => (playable ? handlers.play(share) : handlers.open(share))}
            sx={{
              ...artSx,
              cursor: "pointer",
              font: "inherit",
              "&:focus-visible": { outline: "2px solid", outlineColor: "common.white", outlineOffset: 2 },
            }}
          >
            {art}
          </Box>
        )}
        {isOwner ? (
          <Box
            className="poster-owner"
            sx={(theme) => ({
              position: "absolute",
              top: 6,
              right: 6,
              display: "flex",
              borderRadius: 999,
              bgcolor: alpha(theme.palette.common.black, 0.68),
              "& .MuiIconButton-root": { color: "common.white" },
            })}
          >
            <ShareOwnerActions share={share} onMove={canMove ? handlers.move : undefined} onRemove={handlers.remove} />
          </Box>
        ) : null}
      </Box>
      <Box
        {...(gone
          ? {}
          : {
              component: "button" as const,
              type: "button" as const,
              "aria-label": `More about ${share.title}`,
              onClick: () => handlers.open(share),
            })}
        sx={{
          display: "block",
          width: "100%",
          p: 0,
          pt: 1,
          border: 0,
          background: "transparent",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
          borderRadius: 0.5,
          minHeight: 44,
          ...(gone
            ? {}
            : {
                cursor: "pointer",
                "&:hover .poster-title": { textDecoration: "underline" },
                "&:focus-visible": { outline: "2px solid", outlineColor: "common.white", outlineOffset: 2 },
              }),
        }}
      >
        <Typography
          component="span"
          className="poster-title"
          sx={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
            overflowWrap: "anywhere",
            fontWeight: 650,
            fontSize: 15,
            lineHeight: 1.3,
            color: gone ? "text.secondary" : "text.primary",
          }}
        >
          {share.title}
        </Typography>
        <Typography component="span" noWrap sx={{ display: "block", mt: 0.25, fontSize: 13, color: "text.secondary" }}>
          {note}
        </Typography>
      </Box>
    </Box>
  );
}

// `shares` is rebuilt whenever any body lands: compare what this poster shows.
export const Poster = memo(
  PosterView,
  (a, b) =>
    a.share.key === b.share.key &&
    a.share.body === b.share.body &&
    a.share.row === b.share.row &&
    a.share.unavailable === b.share.unavailable &&
    a.isOwner === b.isOwner &&
    a.canMove === b.canMove &&
    a.handlers === b.handlers
);

/** A folder as a wide tile: its cover, or a strip of film, with its name on a scrim. */
function FolderTile({ folder, onOpen }: { folder: CollectionFolder; onOpen: (id: string) => void }) {
  const { src, onError } = useQdnImage(folder.cover ? coverUrl(folder.cover) : null);
  const title = folder.title || "Untitled folder";
  return (
    <Box component="li" sx={{ minWidth: 0 }}>
      <Box
        component="button"
        type="button"
        aria-label={`Open folder ${title}`}
        onClick={() => onOpen(folder.id)}
        sx={(theme) => ({
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "100%",
          aspectRatio: "16 / 9",
          minHeight: 92,
          p: 0,
          border: 1,
          borderColor: "divider",
          borderRadius: 1.5,
          overflow: "hidden",
          cursor: "pointer",
          font: "inherit",
          color: "common.white",
          textAlign: "left",
          bgcolor: "background.paper",
          transition: "transform 200ms ease, border-color 200ms ease",
          "@media (hover: hover)": {
            "&:hover": { transform: "scale(1.03)", borderColor: alpha(theme.palette.common.white, 0.5) },
          },
          "&:focus-visible": { outline: "2px solid", outlineColor: "common.white", outlineOffset: 2 },
          [REDUCED_MOTION]: { transition: "none", "&:hover": { transform: "none" } },
        })}
      >
        <FilmPlaceholder seed={folder.id} icon={<FolderOutlinedIcon />} />
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onError={onError}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <Box
          sx={(theme) => ({
            position: "relative",
            px: 1.5,
            pt: 3,
            pb: 1,
            background: `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.9)} 70%, transparent)`,
          })}
        >
          <Typography component="span" noWrap sx={{ display: "block", fontWeight: 700, fontSize: 15 }}>
            {title}
          </Typography>
          <Typography component="span" noWrap sx={{ display: "block", fontSize: 13, color: "text.secondary" }}>
            {folderCountLabel(folder)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** Rails with more than this go to a wrapping grid: nobody swipes past 300 posters. */
export const RAIL_MAX = 12;

const GUTTER = { xs: 2, md: 4 };

/** Posters in one row to swipe, with arrows where there's a mouse. */
function Rail({ label, busy, children }: { label: string; busy: boolean; children: ReactNode }) {
  const phone = usePhoneLayout();
  const list = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = list.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((now) => (now.left === left && now.right === right ? now : { left, right }));
  }, []);

  useEffect(() => {
    const el = list.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [measure]);
  // Posters come and go as bodies land.
  useEffect(measure, [measure, children]);

  const scroll = (direction: 1 | -1) => {
    const el = list.current;
    if (!el) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: still ? "auto" : "smooth" });
  };

  const arrow = (direction: 1 | -1) => (
    <IconButton
      aria-label={`Scroll ${label} ${direction > 0 ? "right" : "left"}`}
      onClick={() => scroll(direction)}
      sx={(theme) => ({
        position: "absolute",
        zIndex: 3,
        top: "calc(50% - 44px)",
        [direction > 0 ? "right" : "left"]: 8,
        width: 44,
        height: 44,
        color: "common.white",
        bgcolor: alpha(theme.palette.common.black, 0.76),
        "&:hover": { bgcolor: theme.palette.common.black },
      })}
    >
      {direction > 0 ? <ChevronRightRoundedIcon /> : <ChevronLeftRoundedIcon />}
    </IconButton>
  );

  return (
    <Box sx={{ position: "relative", mx: { xs: -GUTTER.xs, md: -GUTTER.md } }}>
      {!phone && edges.left ? arrow(-1) : null}
      <Box
        component="ul"
        ref={list}
        aria-label={label}
        aria-busy={busy || undefined}
        onScroll={measure}
        sx={{
          listStyle: "none",
          m: 0,
          px: GUTTER,
          pt: 1.5,
          pb: 1.5,
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "280px",
          gap: 2,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x proximity",
          scrollPaddingInline: { xs: 16, md: 32 },
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          "& > li": { scrollSnapAlign: "start" },
          [`@media ${PHONE_MEDIA}`]: { gridAutoColumns: "min(68vw, 250px)", gap: 1.5 },
        }}
      >
        {children}
      </Box>
      {!phone && edges.right ? arrow(1) : null}
    </Box>
  );
}

/** Posters wrapping over the width: two columns on a phone. */
function PosterGrid({ label, busy, children }: { label: string; busy: boolean; children: ReactNode }) {
  return (
    <Box
      component="ul"
      aria-label={label}
      aria-busy={busy || undefined}
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
        pt: 1,
        display: "grid",
        gap: 2,
        gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
        "@media (max-width:599.95px)": { gap: 1.5, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      {children}
    </Box>
  );
}

/** One titled row or grid of the stage. */
export function CinemaSection({ id, title, count, rail, busy = false, children }: {
  id: string;
  title: string;
  count?: number;
  rail: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  const Layout = rail ? Rail : PosterGrid;
  return (
    <Box component="section" aria-labelledby={id} sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: rail ? 0 : 0.5 }}>
        <Typography id={id} component="h2" sx={{ fontWeight: 800, fontSize: { xs: 18, md: 21 }, letterSpacing: "-0.01em" }}>
          {title}
        </Typography>
        {count ? (
          <Typography component="span" sx={{ fontSize: 14, color: "text.secondary" }}>
            {count}
          </Typography>
        ) : null}
      </Box>
      <Layout label={title} busy={busy}>
        {children}
      </Layout>
    </Box>
  );
}

/** The folders of this place, as a section of wide tiles. */
export function CinemaFolders({ folders, onOpen }: { folders: CollectionFolder[]; onOpen: (id: string) => void }) {
  if (folders.length === 0) return null;
  return (
    <CinemaSection id="cinema-folders" title="Folders" count={folders.length} rail={folders.length <= RAIL_MAX}>
      {folders.map((folder) => (
        <FolderTile key={folder.id} folder={folder} onOpen={onOpen} />
      ))}
    </CinemaSection>
  );
}
