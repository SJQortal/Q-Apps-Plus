import { useEffect, useRef } from "react";
import { Box, Button, Dialog, IconButton, LinearProgress, Tooltip, Typography, useMediaQuery } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import SkipNextRoundedIcon from "@mui/icons-material/SkipNextRounded";
import SkipPreviousRoundedIcon from "@mui/icons-material/SkipPreviousRounded";
import { CopyLinkButton } from "../../../components/common/CopyLinkButton";
import { PreviewPanel } from "../../../components/common/FilePreview";
import { useFileOnNode } from "../../../hooks/useFileOnNode";
import { useQdnImage } from "../../../hooks/useQdnImage";
import { formatBytes } from "../../../utils/formatBytes";
import { shareLink } from "../../../utils/qortalLinks";
import type { ShareFile } from "../../FileContent/FileRow";
import { filmFrame } from "./cinemaTheme";
import type { SpaceShare } from "./useSpaceItems";

/** One video the page can play: a file of a share. */
export interface CinemaEntry {
  share: SpaceShare;
  file: ShareFile;
}

export const entryKey = (entry: CinemaEntry) => `${entry.share.key}::${entry.file.identifier}`;

/** The videos of the shares shown so far, in order, each share's episodes together. */
export function cinemaQueue(shares: SpaceShare[]): CinemaEntry[] {
  return shares.flatMap((share) =>
    share.deleted || share.unreadable ? [] : share.videos.map((file) => ({ share, file }))
  );
}

/** A file's name as a person would say it: "episode-2-the-depot.webm" is "Episode 2 the depot". */
export function episodeName(filename: string): string {
  const words = filename.replace(/\.[^.]+$/, "").replace(/[-_.]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : filename;
}

const UP_NEXT_MAX = 6;

/** The first video of each of the next few shares after this one. */
export function upNext(queue: CinemaEntry[], index: number): CinemaEntry[] {
  const seen = new Set([queue[index]?.share.key]);
  const found: CinemaEntry[] = [];
  for (const entry of queue.slice(index + 1)) {
    if (seen.has(entry.share.key)) continue;
    seen.add(entry.share.key);
    found.push(entry);
    if (found.length === UP_NEXT_MAX) break;
  }
  return found;
}

/** One row of Up next: only a tap on it asks for the video, its picture is the poster's. */
function UpNextRow({ entry, onSelect }: { entry: CinemaEntry; onSelect: (key: string) => void }) {
  const { src, onError } = useQdnImage(entry.share.thumbnailUrl);
  return (
    <li>
      <Box
        component="button"
        type="button"
        aria-label={`Play ${entry.share.title}`}
        onClick={() => onSelect(entryKey(entry))}
        sx={(theme) => ({
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          width: "100%",
          p: 0.75,
          border: 0,
          borderRadius: 1,
          background: "transparent",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          "&:hover": { bgcolor: alpha(theme.palette.common.white, 0.08) },
          "&:focus-visible": { outline: "2px solid", outlineColor: "common.white", outlineOffset: -2 },
        })}
      >
        <Box aria-hidden sx={[{ position: "relative", flexShrink: 0, width: 104, aspectRatio: "16 / 9", borderRadius: 0.75, overflow: "hidden" }, filmFrame(entry.share.key) as never]}>
          {src ? (
            <img src={src} alt="" loading="lazy" decoding="async" onError={onError} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          ) : null}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="span"
            sx={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", overflowWrap: "anywhere", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}
          >
            {entry.share.title}
          </Typography>
          <Typography component="span" noWrap sx={{ display: "block", mt: 0.25, fontSize: 12.5, color: "text.secondary" }}>
            {entry.share.user}
          </Typography>
        </Box>
      </Box>
    </li>
  );
}

/** The download's bar, under the player's own words about it. Reads the same download entry. */
function FetchBar({ file, jsonId }: { file: ShareFile; jsonId: string }) {
  const { state, percent } = useFileOnNode(file, jsonId);
  if (state !== "fetching") return null;
  return <LinearProgress aria-hidden variant="determinate" value={percent} sx={{ position: "absolute", left: 0, right: 0, bottom: 0 }} />;
}

/**
 * The tap on Play already asked for the video, so it starts as soon as the
 * player appears (once the node has it). A browser may refuse: its controls are there.
 */
function useStartWhenReady() {
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let started = false;
    const start = () => {
      const video = el.querySelector("video");
      if (!video || started) return;
      started = true;
      void Promise.resolve(video.play()).catch(() => {});
    };
    start();
    const watcher = new MutationObserver(start);
    watcher.observe(el, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, []);
  return holder;
}

/** The video, or the wait for it, over a dim copy of the share's picture. */
function VideoStage({ share, file }: CinemaEntry) {
  const holder = useStartWhenReady();
  const backdrop = useQdnImage(share.thumbnailUrl);
  return (
    <Box
      ref={holder}
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "min(56vw, calc(var(--qshare-app-height, 100dvh) * 0.7))",
        overflow: "hidden",
        bgcolor: "common.black",
        // The picture runs to the edges here, however the app rounds a video elsewhere.
        "& video": { borderRadius: "0 !important" },
      }}
    >
      {backdrop.src ? (
        <img
          src={backdrop.src}
          alt=""
          onError={backdrop.onError}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, filter: "blur(24px)", transform: "scale(1.1)" }}
        />
      ) : null}
      <Box sx={{ position: "relative", display: "flex", justifyContent: "center", width: "100%", p: 0, "& > *": { maxWidth: "100%" } }}>
        <PreviewPanel file={file} kind="video" open jsonId={share.identifier} />
      </Box>
      <FetchBar file={file} jsonId={share.identifier} />
    </Box>
  );
}

interface CinemaPlayerProps {
  queue: CinemaEntry[];
  current: string;
  onSelect: (key: string) => void;
  onClose: () => void;
  onOpenShare: (share: SpaceShare) => void;
  onOpenProfile: (name: string) => void;
  /** Loads the next page of shares, when there are more. */
  onShowMore: (() => void) | undefined;
}

/**
 * The full-screen player. Nothing touches the node until it opens; from there
 * PreviewPanel checks the node and fetches through the download machine, with
 * its own progress and Try again. Next and Previous never fetch by themselves:
 * each is a tap.
 */
export function CinemaPlayer({ queue, current, onSelect, onClose, onOpenShare, onOpenProfile, onShowMore }: CinemaPlayerProps) {
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const index = queue.findIndex((entry) => entryKey(entry) === current);
  const entry = index >= 0 ? queue[index] : null;

  if (!entry) return null;
  const { share, file } = entry;
  const previous = index > 0 ? queue[index - 1] : null;
  const next = index < queue.length - 1 ? queue[index + 1] : null;
  const episodes = share.videos.length > 1 ? share.videos : null;
  const following = upNext(queue, index);
  const sidePanel = episodes !== null || following.length > 0;

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      aria-labelledby="cinema-player-title"
      transitionDuration={still ? 0 : 200}
      sx={{ "& .MuiDialog-paper": { bgcolor: "common.black", color: "common.white", backgroundImage: "none" } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <Box
          component="header"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
            px: 0.5,
            pt: "env(safe-area-inset-top, 0px)",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Tooltip title="Close">
            <IconButton aria-label="Close player" onClick={onClose} sx={{ width: 44, height: 44 }}>
              <CloseRoundedIcon />
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1, minWidth: 0, py: 0.5 }}>
            <Typography id="cinema-player-title" component="h2" noWrap sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
              {share.title}
            </Typography>
            <Typography noWrap sx={{ fontSize: 12.5, color: "text.secondary" }}>
              Video {index + 1} of {queue.length}
            </Typography>
          </Box>
          <Tooltip title={previous ? "Previous video" : ""}>
            <span>
              <IconButton
                aria-label="Previous video"
                disabled={!previous}
                onClick={() => previous && onSelect(entryKey(previous))}
                sx={{ width: 44, height: 44 }}
              >
                <SkipPreviousRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={next ? "Next video" : ""}>
            <span>
              <IconButton
                aria-label="Next video"
                disabled={!next}
                onClick={() => next && onSelect(entryKey(next))}
                sx={{ width: 44, height: 44 }}
              >
                <SkipNextRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
          <CopyLinkButton link={shareLink(share.user, share.identifier)} tooltipTitle="Copy link" sx={{ width: 44, height: 44 }} />
          <Tooltip title="More info">
            <IconButton aria-label="More info" onClick={() => onOpenShare(share)} sx={{ width: 44, height: 44 }}>
              <InfoOutlinedIcon />
            </IconButton>
          </Tooltip>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "grid",
            alignContent: "start",
            gridTemplateColumns: sidePanel ? { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 340px" } : "minmax(0, 1fr)",
            gridAutoRows: { md: "minmax(100%, auto)" },
            pb: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <VideoStage key={entryKey(entry)} share={share} file={file} />
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: { xs: 18, md: 22 }, letterSpacing: "-0.01em", overflowWrap: "anywhere" }}>
                {episodes ? episodeName(file.filename) : share.title}
              </Typography>
              <Typography sx={{ fontSize: 13.5, color: "text.secondary", overflowWrap: "anywhere" }}>
                {episodes ? share.title : file.filename}
                {file.size ? ` · ${formatBytes(file.size, 1)}` : ""}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mt: 1 }}>
                <Button variant="outlined" onClick={() => onOpenProfile(share.user)} sx={{ minHeight: 44, maxWidth: "100%" }}>
                  <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    By {share.user}
                  </Box>
                </Button>
                {!next && onShowMore ? (
                  <Button variant="outlined" startIcon={<ExpandMoreRoundedIcon />} onClick={onShowMore} sx={{ minHeight: 44 }}>
                    Load more videos
                  </Button>
                ) : null}
              </Box>
            </Box>
          </Box>

          {sidePanel ? (
            <Box
              sx={(theme) => ({
                minWidth: 0,
                p: 1,
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                bgcolor: alpha(theme.palette.common.white, 0.05),
                borderLeft: { md: 1 },
                borderTop: { xs: 1, md: 0 },
                borderColor: { xs: "divider", md: "divider" },
              })}
            >
              {episodes ? (
                <Box component="section" aria-labelledby="cinema-episodes" sx={{ minWidth: 0 }}>
                  <Typography id="cinema-episodes" component="h3" sx={{ px: 1, py: 1, fontWeight: 700, fontSize: 15 }}>
                    Episodes · {episodes.length}
                  </Typography>
                  <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
                    {episodes.map((episode, n) => {
                      const here = episode.identifier === file.identifier;
                      return (
                        <li key={episode.identifier}>
                          <Button
                            fullWidth
                            aria-current={here ? "true" : undefined}
                            onClick={() => onSelect(entryKey({ share, file: episode }))}
                            startIcon={here ? <PlayArrowRoundedIcon /> : <Box component="span" sx={{ width: 20, textAlign: "center" }}>{n + 1}</Box>}
                            sx={(theme) => ({
                              minHeight: 44,
                              justifyContent: "flex-start",
                              textAlign: "left",
                              fontWeight: here ? 700 : 500,
                              color: here ? "text.primary" : "text.secondary",
                              bgcolor: here ? alpha(theme.palette.common.white, 0.14) : undefined,
                              overflowWrap: "anywhere",
                              "& .MuiButton-startIcon > span": { fontSize: 13.5, lineHeight: "20px" },
                            })}
                          >
                            <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                              {episodeName(episode.filename)}
                            </Box>
                            {episode.size ? (
                              <Box component="span" sx={{ flexShrink: 0, pl: 1, fontSize: 12.5, fontWeight: 400, color: "text.secondary" }}>
                                {formatBytes(episode.size, 1)}
                              </Box>
                            ) : null}
                          </Button>
                        </li>
                      );
                    })}
                  </Box>
                </Box>
              ) : null}
              {following.length > 0 ? (
                <Box component="section" aria-labelledby="cinema-up-next" sx={{ minWidth: 0 }}>
                  <Typography id="cinema-up-next" component="h3" sx={{ px: 1, py: 1, fontWeight: 700, fontSize: 15 }}>
                    Up next
                  </Typography>
                  <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.25 }}>
                    {following.map((upcoming) => (
                      <UpNextRow key={entryKey(upcoming)} entry={upcoming} onSelect={onSelect} />
                    ))}
                  </Box>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </Box>
      </Box>
    </Dialog>
  );
}
