import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Slider,
  Tooltip,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import MusicNoteOutlinedIcon from "@mui/icons-material/MusicNoteOutlined";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import QueueMusicOutlinedIcon from "@mui/icons-material/QueueMusicOutlined";
import RepeatOneRoundedIcon from "@mui/icons-material/RepeatOneRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import SkipNextRoundedIcon from "@mui/icons-material/SkipNextRounded";
import SkipPreviousRoundedIcon from "@mui/icons-material/SkipPreviousRounded";
import { headerFill } from "../../hub-theme";
import { useFileOnNode } from "../../hooks/useFileOnNode";
import { useLandscapePhone, usePhoneLayout } from "../../hooks/usePhoneLayout";
import {
  closePlayer,
  currentTrack,
  cycleRepeat,
  nextTrack,
  playTrack,
  previousTrack,
  setPlaying,
  toggleShuffle,
  upcomingTrack,
  type Track,
} from "../../state/features/playerSlice";
import type { RootState } from "../../state/store";
import { sharePath } from "../../utils/qortalLinks";
import { previewUrl } from "../common/FilePreview";
import { BottomSheet } from "../common/mobile/BottomSheet";
import { BOTTOM_NAV_HEIGHT, COMPACT_BOTTOM_NAV_HEIGHT } from "../layout/BottomNav/BottomNav";
import { isUnlockClip, playerAudio } from "./audioElement";
import { COMPACT_PLAYER_BAR_HEIGHT, PHONE_PLAYER_BAR_HEIGHT, PLAYER_BAR_HEIGHT } from "./playerLayout";

/** A track the node can't provide, or the browser can't play, is skipped after this long. */
export const SKIP_AFTER_MS = 2500;
/** Previous restarts the track when it has played longer than this. */
const RESTART_AFTER_S = 3;

const EMPTY_TRACK: Track = { name: "", service: "FILE", identifier: "", filename: "" };

/** The filename without its extension. */
export function trackTitle(track: Pick<Track, "filename">): string {
  const name = track.filename || "Untitled";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** 3:07, or 1:02:03 for an hour and more; "–:––" while unknown. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "–:––";
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const Bar = styled("section", { shouldForwardProp: (prop) => prop !== "bottom" && prop !== "height" })<{
  bottom: string;
  height: number;
}>(({ theme, bottom, height }) => ({
  position: "fixed",
  left: 0,
  right: 0,
  bottom,
  zIndex: theme.zIndex.appBar,
  height,
  paddingLeft: "env(safe-area-inset-left, 0px)",
  paddingRight: "env(safe-area-inset-right, 0px)",
  backgroundColor: headerFill(theme, "chromeStrong"),
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  borderTop: `1px solid ${theme.palette.divider}`,
}));

const Inner = styled("div")(({ theme }) => ({
  height: "100%",
  maxWidth: 1200,
  margin: "0 auto",
  display: "grid",
  alignItems: "center",
  gap: theme.spacing(1, 2),
  padding: theme.spacing(0, 2),
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr) auto",
  [theme.breakpoints.down("md")]: { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) auto" },
}));

/** The playlist's state and controls, and the engine that drives the one <audio> element. */
function usePlaylist() {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const player = useSelector((state: RootState) => state.player);
  const track = currentTrack(player);
  const upcoming = upcomingTrack(player);
  const jsonId = player.share?.identifier;
  const node = useFileOnNode(track ?? EMPTY_TRACK, jsonId);
  const nextNode = useFileOnNode(upcoming ?? EMPTY_TRACK, jsonId);
  const { ensure } = node;
  const ensureNext = nextNode.ensure;
  const [time, setTime] = useState({ current: 0, duration: Number.NaN });
  const [playError, setPlayError] = useState<{ key: string; text: string } | null>(null);
  // What the element holds, so a re-render doesn't reload it; the event handlers read the rest.
  const loaded = useRef<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const switching = useRef(false);
  const prefetched = useRef(new Set<string>());

  const key = track ? `${track.identifier}:${player.restart}` : null;
  const ready = Boolean(track) && node.state === "ready";

  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  // A new track (or the same one again): make sure the node has it, fetching it from peers when not.
  useEffect(() => {
    if (key) void ensure();
  }, [key, ensure]);

  // Once it is on the node: load it into the element, then play or pause as asked.
  useEffect(() => {
    if (!track || !key || !ready) return;
    const audio = playerAudio();
    if (loaded.current !== key) {
      loaded.current = key;
      switching.current = true;
      audio.src = previewUrl(track);
    }
    // What the user wants now: a render queued before their last tap can run this with an older value.
    if (store.getState().player.playing) {
      void audio.play().catch((error: { name?: string }) => {
        if (error?.name === "NotAllowedError") dispatch(setPlaying(false));
      });
    } else {
      audio.pause();
    }
  }, [track, key, ready, player.playing, dispatch, store]);

  // Nothing to play: stop and let go of the file.
  useEffect(() => {
    if (track) return;
    const audio = playerAudio();
    loaded.current = null;
    audio.pause();
    if (audio.getAttribute("src") && !isUnlockClip(audio)) {
      audio.removeAttribute("src");
      audio.load();
    }
  }, [track]);

  // While a track plays, the next one comes to the node, so it starts without a wait.
  useEffect(() => {
    if (!upcoming || !ready || !player.playing || prefetched.current.has(upcoming.identifier)) return;
    prefetched.current.add(upcoming.identifier);
    void ensureNext();
  }, [upcoming, ready, player.playing, ensureNext]);

  useEffect(() => {
    const audio = playerAudio();
    const onTime = () => setTime({ current: audio.currentTime, duration: audio.duration });
    const onEnded = () => dispatch(nextTrack({ auto: true }));
    const onPlay = () => {
      switching.current = false;
      if (isUnlockClip(audio)) return;
      dispatch(setPlaying(true));
      // One sound at a time: an inline player on the page stops.
      for (const media of document.querySelectorAll<HTMLMediaElement>("audio, video")) if (!media.paused) media.pause();
    };
    const onPause = () => {
      if (switching.current || audio.ended || isUnlockClip(audio)) return;
      dispatch(setPlaying(false));
    };
    const onError = () => {
      if (isUnlockClip(audio) || !audio.getAttribute("src") || !keyRef.current) return;
      setPlayError({ key: keyRef.current, text: "This file can't be played here." });
    };
    // Another player on the page started: this one makes way.
    const onOtherPlay = (event: Event) => {
      if (event.target !== audio && !audio.paused) audio.pause();
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    document.addEventListener("play", onOtherPlay, true);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      document.removeEventListener("play", onOtherPlay, true);
    };
  }, [dispatch]);

  const failure = node.state === "failed" ? node.statusText : playError && playError.key === key ? playError.text : null;

  // A track that can't be had or played is skipped while the playlist plays.
  useEffect(() => {
    if (!failure || !player.playing || !upcoming) return;
    const timer = window.setTimeout(() => dispatch(nextTrack({})), SKIP_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [failure, player.playing, upcoming, key, dispatch]);

  const toggle = useCallback(() => dispatch(setPlaying(!player.playing)), [dispatch, player.playing]);
  const previous = useCallback(() => {
    const audio = playerAudio();
    if (audio.currentTime > RESTART_AFTER_S && ready) {
      audio.currentTime = 0;
      return;
    }
    dispatch(previousTrack());
  }, [dispatch, ready]);
  const next = useCallback(() => dispatch(nextTrack({})), [dispatch]);
  const seek = useCallback(
    (seconds: number) => {
      if (!ready || !Number.isFinite(seconds)) return;
      playerAudio().currentTime = seconds;
      setTime((t) => ({ ...t, current: seconds }));
    },
    [ready]
  );

  // Lock-screen, headset and keyboard media keys.
  useEffect(() => {
    const session = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (!session || !track) return;
    try {
      if (typeof MediaMetadata === "function") {
        session.metadata = new MediaMetadata({
          title: trackTitle(track),
          artist: player.share?.name ?? "",
          album: player.share?.title ?? "",
        });
      }
      session.setActionHandler("play", () => dispatch(setPlaying(true)));
      session.setActionHandler("pause", () => dispatch(setPlaying(false)));
      session.setActionHandler("previoustrack", previous);
      session.setActionHandler("nexttrack", next);
    } catch {
      // Not every WebView has every action.
    }
  }, [track, player.share, dispatch, previous, next]);
  useEffect(() => {
    const session = typeof navigator !== "undefined" ? navigator.mediaSession : undefined;
    if (session) session.playbackState = track ? (player.playing ? "playing" : "paused") : "none";
  }, [track, player.playing]);

  let status: string | null = null;
  if (failure) status = upcoming && player.playing ? `${failure} Skipping…` : failure;
  else if (track && !ready) status = node.state === "fetching" ? node.statusText : "Checking your node…";

  return {
    player,
    track,
    ready,
    time,
    status,
    loading: Boolean(track) && !ready && !failure,
    toggle,
    previous,
    next,
    seek,
    shuffle: () => dispatch(toggleShuffle({ count: player.tracks.length, track: player.order[player.position] ?? 0 })),
    repeat: () => dispatch(cycleRepeat()),
    pick: (index: number) => dispatch(playTrack(index)),
    close: () => dispatch(closePlayer()),
  };
}

type Playlist = ReturnType<typeof usePlaylist>;

function PlayButton({ list, size = 48 }: { list: Playlist; size?: number }) {
  const label = list.player.playing ? "Pause" : "Play";
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={list.toggle}
        sx={{
          width: size,
          height: size,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          "&:hover": { bgcolor: "primary.dark" },
          position: "relative",
        }}
      >
        {list.player.playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        {list.loading && list.player.playing ? (
          <CircularProgress size={size} thickness={2} sx={{ position: "absolute", inset: 0, color: "inherit" }} aria-hidden />
        ) : null}
      </IconButton>
    </Tooltip>
  );
}

function ControlButton({
  label,
  onClick,
  children,
  active,
  disabled,
  popup,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** Opens a list: says so instead of pressed/not pressed. */
  popup?: boolean;
}) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          aria-pressed={popup ? undefined : active}
          aria-haspopup={popup ? "dialog" : undefined}
          onClick={onClick}
          disabled={disabled}
          sx={{ minWidth: 44, minHeight: 44, color: active ? "primary.main" : undefined }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function Controls({ list }: { list: Playlist }) {
  const { player } = list;
  const many = player.tracks.length > 1;
  const repeatLabel = player.repeat === "one" ? "Repeat this track" : player.repeat === "all" ? "Repeat all" : "Repeat off";
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
      <ControlButton label="Shuffle" onClick={list.shuffle} active={player.shuffle} disabled={!many}>
        <ShuffleRoundedIcon />
      </ControlButton>
      <ControlButton label="Previous" onClick={list.previous}>
        <SkipPreviousRoundedIcon />
      </ControlButton>
      <PlayButton list={list} />
      <ControlButton label="Next" onClick={list.next} disabled={!many}>
        <SkipNextRoundedIcon />
      </ControlButton>
      <ControlButton label={repeatLabel} onClick={list.repeat} active={player.repeat !== "off"}>
        {player.repeat === "one" ? <RepeatOneRoundedIcon /> : <RepeatRoundedIcon />}
      </ControlButton>
    </Box>
  );
}

function SeekBar({ list }: { list: Playlist }) {
  const { time } = list;
  const known = Number.isFinite(time.duration) && time.duration > 0;
  if (list.status) {
    return (
      <Typography variant="body2" color="text.secondary" role="status" noWrap sx={{ textAlign: "center" }}>
        {list.status}
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40, fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatTime(time.current)}
      </Typography>
      <Slider
        size="small"
        aria-label="Position in the track"
        value={known ? Math.min(time.current, time.duration) : 0}
        max={known ? time.duration : 1}
        step={1}
        disabled={!known}
        onChange={(_, value) => list.seek(Number(value))}
        getAriaValueText={(value) => `${formatTime(value)} of ${formatTime(time.duration)}`}
        sx={{ flex: 1 }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
        {formatTime(time.duration)}
      </Typography>
    </Box>
  );
}

function TrackList({ list, onPicked }: { list: Playlist; onPicked?: () => void }) {
  const { player, track } = list;
  return (
    <List dense aria-label="Tracks" sx={{ py: 0 }}>
      {player.tracks.map((item, index) => {
        const current = track?.identifier === item.identifier;
        return (
          <ListItem key={item.identifier} disablePadding>
            <ListItemButton
              selected={current}
              aria-current={current ? "true" : undefined}
              onClick={() => {
                list.pick(index);
                onPicked?.();
              }}
              sx={{ minHeight: 44, borderRadius: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: current ? "primary.main" : "text.secondary" }}>
                {current ? (
                  <GraphicEqRoundedIcon fontSize="small" />
                ) : (
                  <Typography component="span" variant="body2" sx={{ width: 20, textAlign: "right" }}>
                    {index + 1}
                  </Typography>
                )}
              </ListItemIcon>
              <ListItemText primary={trackTitle(item)} slotProps={{ primary: { noWrap: true, title: item.filename } }} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

function Titles({ list, onOpenShare }: { list: Playlist; onOpenShare: () => void }) {
  const { track, player } = list;
  const phone = usePhoneLayout();
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      <Box
        aria-hidden
        sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 1.5, bgcolor: "action.hover", color: "text.secondary", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <MusicNoteOutlinedIcon />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: 15 }} title={track?.filename}>
          {track ? trackTitle(track) : ""}
        </Typography>
        <Button
          variant="text"
          size="small"
          color="inherit"
          onClick={onOpenShare}
          sx={{ p: 0, minWidth: 0, minHeight: phone ? 44 : 0, maxWidth: "100%", justifyContent: "flex-start", color: "text.secondary", fontWeight: 400, textTransform: "none" }}
        >
          <Typography component="span" noWrap variant="body2" sx={{ display: "block" }}>
            {player.share?.title || "Share"} · {player.position + 1}/{player.tracks.length}
          </Typography>
        </Button>
      </Box>
    </Box>
  );
}

/**
 * The playlist player: a bar at the foot of the app (above the phone's
 * bottom bar) that keeps playing while the user moves between pages. A share
 * with two or more audio files starts it (pages/FileContent/PlaylistCard.tsx).
 * Each track is fetched onto the node before it plays, and the next one while
 * the current one plays (useFileOnNode, the downloads list's machine), since
 * the node can only stream a file it holds completely. On phones the bar is
 * compact and opens a sheet with the full controls and the track list.
 */
export function AudioPlayer() {
  const list = usePlaylist();
  const navigate = useNavigate();
  const phone = usePhoneLayout();
  const landscape = useLandscapePhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queueAnchor, setQueueAnchor] = useState<HTMLElement | null>(null);
  if (!list.track) return null;

  const share = list.player.share;
  const openShare = () => {
    if (share) navigate(sharePath(share.name, share.identifier));
    setSheetOpen(false);
    setQueueAnchor(null);
  };
  const navHeight = landscape ? COMPACT_BOTTOM_NAV_HEIGHT : BOTTOM_NAV_HEIGHT;
  const bottom = phone ? `calc(${navHeight}px + env(safe-area-inset-bottom, 0px))` : "env(safe-area-inset-bottom, 0px)";
  const { time } = list;
  const percent = Number.isFinite(time.duration) && time.duration > 0 ? (time.current / time.duration) * 100 : 0;

  if (phone) {
    return (
      <>
        <Bar bottom={bottom} height={landscape ? COMPACT_PLAYER_BAR_HEIGHT : PHONE_PLAYER_BAR_HEIGHT} aria-label="Player">
          <LinearProgress
            variant={list.loading ? "indeterminate" : "determinate"}
            value={percent}
            aria-hidden
            sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
          />
          <Box sx={{ height: "100%", display: "flex", alignItems: "center", gap: 0.5, px: 1 }}>
            <Box
              component="button"
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label={`Now playing: ${trackTitle(list.track)}. Open the player`}
              sx={{ appearance: "none", border: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer", flex: 1, minWidth: 0, minHeight: 44, display: "flex", alignItems: "center", gap: 1.5, p: 0.5, borderRadius: 1 }}
            >
              <Box aria-hidden sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 1.5, bgcolor: "action.hover", color: "text.secondary", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MusicNoteOutlinedIcon />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600, fontSize: 15 }}>
                  {trackTitle(list.track)}
                </Typography>
                <Typography noWrap variant="body2" color="text.secondary">
                  {list.status ?? `${share?.title || "Share"} · ${list.player.position + 1}/${list.player.tracks.length}`}
                </Typography>
              </Box>
            </Box>
            <PlayButton list={list} size={44} />
            <ControlButton label="Next" onClick={list.next} disabled={list.player.tracks.length < 2}>
              <SkipNextRoundedIcon />
            </ControlButton>
          </Box>
        </Bar>
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Now playing">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Titles list={list} onOpenShare={openShare} />
            <SeekBar list={list} />
            <Controls list={list} />
            <TrackList list={list} />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between", "& .MuiButton-root": { minHeight: 44 } }}>
              <Button onClick={openShare}>Open share</Button>
              <Button
                color="inherit"
                startIcon={<CloseRoundedIcon />}
                onClick={() => {
                  setSheetOpen(false);
                  list.close();
                }}
              >
                Close player
              </Button>
            </Box>
          </Box>
        </BottomSheet>
      </>
    );
  }

  return (
    <Bar bottom={bottom} height={PLAYER_BAR_HEIGHT} aria-label="Player">
      <Inner>
        <Titles list={list} onOpenShare={openShare} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, minWidth: 0 }}>
          <Controls list={list} />
          <SeekBar list={list} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <ControlButton label="Tracks" popup onClick={(e) => setQueueAnchor(e.currentTarget)}>
            <QueueMusicOutlinedIcon />
          </ControlButton>
          <ControlButton label="Close player" onClick={list.close}>
            <CloseRoundedIcon />
          </ControlButton>
        </Box>
      </Inner>
      <Popover
        open={Boolean(queueAnchor)}
        anchorEl={queueAnchor}
        onClose={() => setQueueAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 360, maxWidth: "calc(100vw - 32px)", maxHeight: "min(480px, 60vh)", p: 1 } } }}
      >
        <Typography sx={{ fontWeight: 700, px: 1, py: 0.5 }}>{share?.title || "Tracks"}</Typography>
        <TrackList list={list} onPicked={() => setQueueAnchor(null)} />
      </Popover>
    </Bar>
  );
}
