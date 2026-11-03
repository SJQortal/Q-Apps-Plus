import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Box, IconButton, Skeleton, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
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
import { coverUrl, type CollectionCover, type CollectionFolder } from "../../../utils/collections";
import { formatBytes } from "../../../utils/formatBytes";
import { folderCountLabel } from "../FolderGrid";
import { ShareOwnerActions } from "./SpaceShell";
import { filmFrame, POINTER, REDUCED_MOTION, TOUCH } from "./cinemaTheme";
import type { SpaceShare } from "./useSpaceItems";

/** What a poster can do. Stable across renders, so a body landing redraws only its own poster. */
export interface PosterHandlers {
  play: (share: SpaceShare) => void;
  open: (share: SpaceShare) => void;
  move: (share: Video) => void;
  remove: (share: Video) => void;
  /** Owner only: choose or change the share's cover in this collection. */
  cover: (share: SpaceShare) => void;
}

/** A poster's second line: who and how big for a film, how many for a series, or what's wrong. */
export function posterNote(share: SpaceShare): string {
  if (share.deleted) return "Deleted by its publisher";
  if (share.unreadable) return "This share can't be read";
  if (share.unavailable) return "Not available right now";
  const count = share.videos.length;
  const bytes = share.videos.reduce((sum, file) => sum + (file.size ?? 0), 0);
  const size = bytes > 0 ? ` · ${formatBytes(bytes, 1)}` : "";
  if (count > 1) return `${count} episodes${size}`;
  if (count === 1) return `${share.user}${size}`;
  const files = share.files.length;
  return files > 0 ? `${files} ${files === 1 ? "file" : "files"}` : "";
}

/** The title card of a share with no picture: from an attribute, so it isn't read out twice. */
const artTitleSx = {
  content: "attr(data-title)",
  px: 2,
  color: "common.white",
  fontWeight: 700,
  fontSize: 17,
  lineHeight: 1.25,
  letterSpacing: "-0.01em",
  textAlign: "center",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
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
          // With a title the icon is a small mark in the corner, and the title is the card.
          "& svg": title ? { position: "absolute", top: 10, left: 10, fontSize: 20 } : { fontSize: 32 },
          ...(title ? { "&::after": artTitleSx } : {}),
        },
        filmFrame(seed) as never,
      ]}
    >
      {icon}
    </Box>
  );
}

/**
 * The picture the collection's owner chose, over the title card, which shows
 * until it loads or if the node can't serve it. A vertical poster stands whole
 * in the frame, on a dimmed blur of itself, so a row keeps one height.
 */
function ChosenStill({ url, portrait, placeholder }: { url: string; portrait: boolean; placeholder: ReactNode }) {
  const { src, onError } = useQdnImage(url);
  const fill = { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" } as const;
  return (
    <>
      {placeholder}
      {src && portrait ? (
        <Box
          component="img"
          src={src}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          sx={{ ...fill, objectFit: "cover", transform: "scale(1.2)", filter: "blur(18px) brightness(0.5)" }}
        />
      ) : null}
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={onError} style={{ ...fill, objectFit: portrait ? "contain" : "cover" }} />
      ) : null}
    </>
  );
}

/** A share's picture on a poster: the owner's chosen cover, else its own, else its title card. */
function PosterPicture({ share, chosen, portrait = false, placeholder }: { share: SpaceShare; chosen: string | null | undefined; portrait?: boolean; placeholder: ReactNode }) {
  if (chosen) return <ChosenStill url={chosen} portrait={portrait} placeholder={placeholder} />;
  return share.body ? <ShareCardArt share={share.body} fallback={placeholder} /> : <>{placeholder}</>;
}

/** The cover dialog's preview: the poster's picture alone, at 16:9. */
export function FilmCoverPreview({ share, src, cover, portrait }: { share: SpaceShare; src: string | null; cover: CollectionCover | null | undefined; portrait: boolean }) {
  const placeholder = <FilmPlaceholder seed={share.key} title={share.title} icon={<MovieOutlinedIcon />} />;
  return (
    <Box aria-hidden sx={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 1.5, overflow: "hidden", bgcolor: "background.paper" }}>
      <PosterPicture share={share} chosen={src ?? (cover ? coverUrl(cover) : null)} portrait={portrait} placeholder={placeholder} />
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
  /** The URL of the cover the collection's owner chose for it, if any. */
  chosen?: string | null;
  /** The chosen cover is a vertical poster. */
  portrait?: boolean;
  isOwner: boolean;
  canMove: boolean;
  handlers: PosterHandlers;
}

function PosterView({ share, chosen, portrait, isOwner, canMove, handlers }: PosterProps) {
  if (!share.loaded && !share.unavailable) return SKELETON;

  const gone = share.deleted || share.unreadable;
  const playable = !gone && share.videos.length > 0;
  const series = playable && share.videos.length > 1;
  const note = posterNote(share);
  // A button's label replaces the words inside it, so it has to say them too.
  const spokenNote = note ? `. ${note}` : "";
  const placeholderIcon = gone ? <HideImageOutlinedIcon /> : playable ? <MovieOutlinedIcon /> : <InsertDriveFileOutlinedIcon />;
  const placeholder = <FilmPlaceholder seed={share.key} title={gone ? undefined : share.title} icon={placeholderIcon} dim={gone} />;

  const art = (
    <>
      {gone ? placeholder : <PosterPicture share={share} chosen={chosen} portrait={portrait} placeholder={placeholder} />}
      {gone ? null : (
        <Box
          aria-hidden
          className="poster-glass"
          sx={(theme) => ({
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 160ms ease",
            background: alpha(theme.palette.common.black, 0.42),
            [REDUCED_MOTION]: { transition: "none" },
          })}
        >
          <Box
            sx={{
              display: "flex",
              p: 1.25,
              borderRadius: "50%",
              bgcolor: "common.white",
              color: "common.black",
            }}
          >
            {playable ? <PlayArrowRoundedIcon sx={{ fontSize: 30 }} /> : <OpenInNewRoundedIcon />}
          </Box>
        </Box>
      )}
      {series ? (
        <Box
          aria-hidden
          sx={(theme) => ({
            position: "absolute",
            left: 8,
            bottom: 8,
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: 12.5,
            fontWeight: 700,
            color: "common.white",
            bgcolor: alpha(theme.palette.common.black, 0.76),
          })}
        >
          {share.videos.length} episodes
        </Box>
      ) : null}
      {playable ? (
        <Box
          aria-hidden
          sx={(theme) => ({
            display: "none",
            position: "absolute",
            right: 8,
            bottom: 8,
            p: 0.5,
            borderRadius: "50%",
            color: "common.white",
            bgcolor: alpha(theme.palette.common.black, 0.76),
            [TOUCH]: { display: "flex" },
          })}
        >
          <PlayArrowRoundedIcon sx={{ fontSize: 20 }} />
        </Box>
      ) : null}
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
                "&::before, &::after": { content: '""', position: "absolute", height: 4, borderRadius: "4px 4px 0 0" },
                "&::before": { top: -4, left: 8, right: 8, bgcolor: alpha(theme.palette.common.white, 0.36) },
                "&::after": { top: -8, left: 16, right: 16, bgcolor: alpha(theme.palette.common.white, 0.18) },
              }
            : {}),
          [POINTER]: {
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
            aria-label={playable ? `Play ${share.title}` : `Open ${share.title}${spokenNote}`}
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
            {gone ? null : (
              <Tooltip title={chosen ? "Change cover" : "Add a cover"}>
                <IconButton
                  aria-label={`${chosen ? "Change the cover of" : "Add a cover to"} ${share.title || share.identifier}`}
                  onClick={() => handlers.cover(share)}
                  sx={{ minWidth: 44, minHeight: 44 }}
                >
                  <AddPhotoAlternateOutlinedIcon />
                </IconButton>
              </Tooltip>
            )}
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
              "aria-label": `More about ${share.title}${spokenNote}`,
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
    a.chosen === b.chosen &&
    a.portrait === b.portrait &&
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
          minHeight: 100,
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
          [POINTER]: {
            "&:hover": { transform: "scale(1.03)", borderColor: alpha(theme.palette.common.white, 0.5) },
          },
          "&:focus-visible": { outline: "2px solid", outlineColor: "common.white", outlineOffset: 2 },
          [REDUCED_MOTION]: { transition: "none", "&:hover": { transform: "none" } },
        })}
      >
        <Box sx={{ position: "absolute", inset: 0, "& svg": { mb: 4 } }}>
          <FilmPlaceholder seed={folder.id} icon={<FolderOutlinedIcon />} />
        </Box>
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
            pt: 3.5,
            pb: 1,
            background: `linear-gradient(to top, ${alpha(theme.palette.common.black, 0.88)} calc(100% - 28px), transparent)`,
          })}
        >
          <Typography
            component="span"
            sx={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
              overflowWrap: "anywhere",
              fontWeight: 700,
              fontSize: 15,
              lineHeight: 1.25,
            }}
          >
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

/** The widths of a row: posters, or the smaller tiles of folders. */
const RAIL_SIZES = {
  poster: { column: "280px", phone: "min(68vw, 250px)", arrowTop: 68 },
  tile: { column: "220px", phone: "min(52vw, 190px)", arrowTop: 50 },
};

/** Posters in one row to swipe, with arrows where there's a mouse. */
function Rail({ label, busy, size, children }: { label: string; busy: boolean; size: keyof typeof RAIL_SIZES; children: ReactNode }) {
  const { column, phone: phoneColumn, arrowTop } = RAIL_SIZES[size];
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

  // The row dims away under its arrow, so the arrow doesn't sit on a poster's picture.
  const arrow = (direction: 1 | -1) => (
    <>
      <Box
        aria-hidden
        sx={(theme) => ({
          position: "absolute",
          zIndex: 3,
          top: 0,
          bottom: 0,
          [direction > 0 ? "right" : "left"]: 0,
          width: 96,
          pointerEvents: "none",
          background: `linear-gradient(${direction > 0 ? "to left" : "to right"}, ${theme.palette.background.default}, transparent)`,
        })}
      />
      <IconButton
        aria-label={`Scroll ${label} ${direction > 0 ? "right" : "left"}`}
        onClick={() => scroll(direction)}
        sx={(theme) => ({
          position: "absolute",
          zIndex: 3,
          top: arrowTop,
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
    </>
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
          gridAutoColumns: column,
          gap: 2,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x proximity",
          scrollPaddingInline: { xs: 16, md: 32 },
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          "& > li": { scrollSnapAlign: "start" },
          [`@media ${PHONE_MEDIA}`]: { gridAutoColumns: phoneColumn, gap: 1.5 },
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

/** A row of one or two posters, sized to them, so two such rows can share a line. */
function ShortRow({ label, busy, children }: { label: string; busy: boolean; children: ReactNode }) {
  return (
    <Box
      component="ul"
      aria-label={label}
      aria-busy={busy || undefined}
      sx={{ listStyle: "none", m: 0, p: 0, pt: 1.5, pb: 1.5, display: "grid", gridAutoFlow: "column", gridAutoColumns: "280px", gap: 2 }}
    >
      {children}
    </Box>
  );
}

/** One titled row or grid of the stage. */
export function CinemaSection({ id, title, count, layout, busy = false, children }: {
  id: string;
  title: string;
  count?: number;
  layout: "rail" | "tiles" | "grid" | "short";
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={layout === "short" ? { minWidth: 0, maxWidth: "100%", flex: "0 1 auto" } : { minWidth: 0, flex: "1 1 100%" }}
    >
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: layout === "grid" ? 0.5 : 0 }}>
        <Typography id={id} component="h2" sx={{ fontWeight: 800, fontSize: { xs: 18, md: 21 }, letterSpacing: "-0.01em" }}>
          {title}
        </Typography>
        {count ? (
          <Typography component="span" sx={{ fontSize: 14, color: "text.secondary" }}>
            {count}
          </Typography>
        ) : null}
      </Box>
      {layout === "grid" ? (
        <PosterGrid label={title} busy={busy}>
          {children}
        </PosterGrid>
      ) : layout === "short" ? (
        <ShortRow label={title} busy={busy}>
          {children}
        </ShortRow>
      ) : (
        <Rail label={title} busy={busy} size={layout === "tiles" ? "tile" : "poster"}>
          {children}
        </Rail>
      )}
    </Box>
  );
}

/** The folders of this place, as a section of small wide tiles. */
export function CinemaFolders({ folders, onOpen }: { folders: CollectionFolder[]; onOpen: (id: string) => void }) {
  if (folders.length === 0) return null;
  return (
    <CinemaSection id="cinema-folders" title="Folders" count={folders.length} layout={folders.length <= RAIL_MAX ? "tiles" : "grid"}>
      {folders.map((folder) => (
        <FolderTile key={folder.id} folder={folder} onOpen={onOpen} />
      ))}
    </CinemaSection>
  );
}
