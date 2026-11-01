import { useCallback, useEffect, useMemo, useRef } from "react";
import { Box, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import AlbumRoundedIcon from "@mui/icons-material/AlbumRounded";
import { usePhoneLayout } from "../../../hooks/usePhoneLayout";
import type { Track } from "../../../state/features/playerSlice";
import { CollectionCover } from "../CollectionCover";
import { folderCountLabel } from "../FolderGrid";
import { MusicHero, trackSummary } from "./musicHero";
import { collectionPath } from "../../../utils/collections";
import { playableTracks, trackKey, useMusicQueue } from "./musicQueue";
import { AlbumGroup, TrackTable, type TrackColumns } from "./musicTracks";
import { SpaceShell, SpaceShowMore } from "./SpaceShell";
import type { SpaceProps } from "./types";
import type { SpaceShare } from "./useSpaceItems";

const AlbumTile = styled("button")(({ theme }) => ({
  appearance: "none",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  padding: theme.spacing(1.25),
  textAlign: "left",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  border: 0,
  background: "transparent",
  borderRadius: theme.shape.borderRadius,
  transition: "background-color 150ms ease",
  "& .album-play": {
    opacity: 0,
    transform: "translateY(6px)",
    transition: "opacity 150ms ease, transform 150ms ease",
  },
  "&:hover, &:focus-visible": { backgroundColor: theme.palette.action.hover },
  "&:hover .album-play, &:focus-visible .album-play": { opacity: 1, transform: "none" },
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "& .album-play": { transition: "none", transform: "none" },
  },
}));

/** A folder's sleeve without a cover: one of the theme's colours, always the same one for the same name. */
function FolderSleeve({ title }: { title: string }) {
  const { palette } = useTheme();
  const colours = [palette.primary, palette.secondary, palette.info, palette.success];
  const hash = Array.from(title).reduce((sum, char) => (sum * 31 + (char.codePointAt(0) ?? 0)) % 9973, 0);
  const colour = colours[hash % colours.length];
  return (
    <Box
      aria-hidden
      sx={{
        aspectRatio: "1",
        borderRadius: 1.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(145deg, ${colour.main}, ${colour.dark})`,
        color: colour.contrastText,
      }}
    >
      <AlbumRoundedIcon sx={{ fontSize: 72, opacity: 0.85 }} />
    </Box>
  );
}

/** Folders as albums: a row to swipe on phones, a grid where there is room. */
function AlbumTiles({ subfolders, openFolder }: Pick<SpaceProps, "subfolders" | "openFolder">) {
  const phone = usePhoneLayout();
  const theme = useTheme();
  if (subfolders.length === 0) return null;
  return (
    <Box component="section" aria-label="Folders">
      <Typography component="h2" sx={{ fontWeight: 800, fontSize: 20, mb: 1 }}>
        Albums
      </Typography>
      <Box
        component="ul"
        sx={{
          listStyle: "none",
          m: 0,
          p: 0,
          ...(phone
            ? { display: "flex", gap: 0.5, mx: -2, px: 1, overflowX: "auto", scrollSnapType: "x proximity" }
            : { display: "grid", gap: 0.5, gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", mx: -1.25 }),
        }}
      >
        {subfolders.map((folder) => {
          const title = folder.title || "Untitled folder";
          return (
            <Box component="li" key={folder.id} sx={phone ? { flex: "0 0 148px", scrollSnapAlign: "start", minWidth: 0 } : { minWidth: 0 }}>
              <AlbumTile type="button" onClick={() => openFolder(folder.id)} aria-label={`Open folder ${title}`}>
                <Box sx={{ position: "relative", width: "100%", boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.3)}`, borderRadius: 1.5 }}>
                  {folder.cover ? <CollectionCover cover={folder.cover} kind="folder" /> : <FolderSleeve title={title} />}
                  <Box
                    className="album-play"
                    aria-hidden
                    sx={{
                      position: "absolute",
                      right: 8,
                      bottom: 8,
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      display: phone ? "none" : "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      boxShadow: 4,
                    }}
                  >
                    <PlayArrowRoundedIcon />
                  </Box>
                </Box>
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 700,
                    fontSize: 15,
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                    overflowWrap: "anywhere",
                  }}
                >
                  {title}
                </Typography>
                <Typography component="span" variant="body2" sx={{ color: "text.secondary" }}>
                  {folderCountLabel(folder)}
                </Typography>
              </AlbumTile>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

const roundPlay = (size: number) =>
  ({
    width: size,
    height: size,
    bgcolor: "primary.main",
    color: "primary.contrastText",
    transition: "transform 120ms ease, background-color 120ms ease",
    "&:hover": { bgcolor: "primary.dark", transform: "scale(1.05)" },
    "&.Mui-disabled": { bgcolor: "action.disabledBackground", color: "action.disabled" },
    "&:focus-visible": { outline: "2px solid", outlineColor: "text.primary", outlineOffset: 2 },
    "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover": { bgcolor: "primary.dark", transform: "none" } },
  }) as const;

/** Edit, New folder and Delete stay out of Play's way: quiet until pointed at. */
const quietActions = {
  "& .MuiButton-root": { bgcolor: "transparent", color: "text.secondary", borderColor: "transparent", boxShadow: "none" },
  "& .MuiButton-root:hover": { bgcolor: "action.hover", color: "text.primary" },
  "& .MuiButton-colorError:hover": { color: "error.main" },
} as const;

/** What the Play button covers, while that is less than the whole place. */
function queueNote(trackCount: number, items: SpaceProps["items"]): string | null {
  const tracks = `${trackCount} ${trackCount === 1 ? "track" : "tracks"}`;
  if (items.pending > 0) {
    const shares = `${items.pending} ${items.pending === 1 ? "share" : "shares"}`;
    return trackCount > 0 ? `Still loading ${shares}. Play starts with the ${tracks} found so far.` : `Looking for tracks in ${shares}.`;
  }
  if (items.shares.length > 0 && trackCount === 0) return items.hasMore ? "No tracks yet. Show more to look further." : "No tracks in these shares.";
  if (items.hasMore && trackCount > 0) return `Play covers the ${tracks} shown here. Show more adds the rest.`;
  return null;
}

/**
 * The music space: a hero in the cover's colours, Play and Shuffle through the
 * app's player, and a real track table grouped by share. Folders are its
 * albums. A file is only ever asked for by a tap on Play or Download.
 */
export default function MusicSpace(props: SpaceProps) {
  const { items, title, isOwner, onMove, onRemove, subfolders, openFolder, openShare, openProfile, folder, cover, breadcrumb, description, attribution, actions, emptyState } = props;
  const theme = useTheme();
  const phone = usePhoneLayout();
  const wide = useMediaQuery(theme.breakpoints.up("md"));
  const queue = useMusicQueue(items.shares, title, collectionPath(props.collection.name, props.collection.identifier, folder?.id));

  // Rows keep one set of callbacks, so a body landing only redraws its own album.
  const latest = useRef({ playOrToggle: queue.playOrToggle, openShare, openProfile });
  useEffect(() => {
    latest.current = { playOrToggle: queue.playOrToggle, openShare, openProfile };
  });
  const onPlay = useCallback((track: Track) => latest.current.playOrToggle(track), []);
  const onOpenShare = useCallback((share: SpaceShare) => latest.current.openShare(share), []);
  const onOpenProfile = useCallback((name: string) => latest.current.openProfile(name), []);

  const columns = useMemo<TrackColumns>(() => ({ phone, wide }), [phone, wide]);
  const { tracks, indexOf, queued, playing, currentKey } = queue;

  const thumbnails = useMemo(
    () => Array.from(new Set(items.shares.flatMap((share) => (share.thumbnailUrl && !share.deleted ? [share.thumbnailUrl] : [])))),
    [items.shares]
  );
  const bytes = tracks.reduce((sum, track) => sum + (track.size ?? 0), 0);
  const partial = items.pending > 0 || items.hasMore;
  const summary = tracks.length > 0 ? trackSummary(tracks.length, bytes, partial) : null;
  const note = queueNote(tracks.length, items);
  const showPlay = tracks.length > 0 || items.pending > 0;

  const mainLabel = queued ? (playing ? "Pause" : "Resume") : "Play all";
  const onMain = queued ? queue.toggle : queue.playAll;
  const mainIcon = playing ? <PauseRoundedIcon sx={{ fontSize: 32 }} /> : <PlayArrowRoundedIcon sx={{ fontSize: 32 }} />;
  const mainButton = (size: number) => (
    <Tooltip title={mainLabel}>
      <span style={{ display: "inline-flex" }}>
        <IconButton aria-label={mainLabel} onClick={onMain} disabled={tracks.length === 0} sx={roundPlay(size)}>
          {mainIcon}
        </IconButton>
      </span>
    </Tooltip>
  );

  const hasControls = showPlay || Boolean(actions);

  return (
    <SpaceShell
      space={props.space}
      sx={{ isolation: "isolate" }}
      hero={<MusicHero folder={folder} breadcrumb={breadcrumb} title={title} description={description} attribution={attribution} cover={cover} thumbnails={thumbnails} summary={summary} />}
    >
      {hasControls ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
          {/* Play stays on the left: on a phone the Share button floats at the right. */}
          {showPlay ? mainButton(56) : null}
          {showPlay && tracks.length > 1 ? (
            <Tooltip title="Shuffle">
              <IconButton aria-label="Shuffle" onClick={queue.shuffleAll} sx={{ width: 48, height: 48, color: "text.secondary", "&:hover": { color: "text.primary" } }}>
                <ShuffleRoundedIcon />
              </IconButton>
            </Tooltip>
          ) : null}
          {actions ? <Box sx={{ ml: { sm: phone ? 0 : "auto" }, minWidth: 0, width: phone ? "100%" : { xs: "100%", sm: "auto" }, ...quietActions, ...(phone ? { mx: -1, "& .MuiButton-root": { ...quietActions["& .MuiButton-root"], px: 1, minWidth: 0 } } : null) }}>{actions}</Box> : null}
        </Box>
      ) : null}
      {note ? (
        <Typography role="status" variant="body2" sx={{ color: "text.secondary" }}>
          {note}
        </Typography>
      ) : null}

      <AlbumTiles subfolders={subfolders} openFolder={openFolder} />
      {emptyState}

      {items.shares.length > 0 ? (
        <TrackTable columns={columns}>
          {items.shares.map((share) => {
            const own = playableTracks(share);
            const numbers = own.map((track) => indexOf.get(trackKey(track)) ?? 0);
            const holdsCurrent = currentKey !== null && own.some((track) => trackKey(track) === currentKey);
            return (
              <AlbumGroup
                key={share.key}
                share={share}
                numbers={numbers}
                columns={columns}
                currentKey={holdsCurrent ? currentKey : null}
                playing={holdsCurrent && playing}
                isOwner={isOwner}
                onMove={onMove}
                onRemove={onRemove}
                onPlay={onPlay}
                onOpenShare={onOpenShare}
                onOpenProfile={onOpenProfile}
              />
            );
          })}
        </TrackTable>
      ) : null}
      <SpaceShowMore items={items} />

    </SpaceShell>
  );
}
