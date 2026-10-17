import { useDispatch, useSelector } from "react-redux";
import { Box, Button, Typography } from "@mui/material";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PlaylistPlayOutlinedIcon from "@mui/icons-material/PlaylistPlayOutlined";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import { previewKind } from "../../components/common/FilePreview";
import { unlockAudio } from "../../components/player/audioElement";
import { trackTitle } from "../../components/player/AudioPlayer";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import {
  currentTrack,
  playQueue,
  playTrack,
  setPlaying,
  type PlayerShare,
  type PlayerState,
  type Track,
} from "../../state/features/playerSlice";
import type { RootState } from "../../state/store";
import { Card } from "./FileContent-styles";
import type { ShareFile } from "./FileRow";

/** A share plays as a playlist from this many audio files. */
export const PLAYLIST_MIN_TRACKS = 2;

/** The share's audio files the player can play, in the share's order. */
export function shareTracks(files: ShareFile[]): Track[] {
  return files
    .filter((file) => file?.identifier && previewKind(file) === "audio")
    .map((file) => ({
      name: file.name,
      service: file.service || "FILE",
      identifier: file.identifier,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
    }));
}

function isQueued(player: PlayerState, share: PlayerShare): boolean {
  return player.share?.name === share.name && player.share?.identifier === share.identifier;
}

/** Play, pause and the current track for one share's playlist. */
export function usePlaylistControls(share: PlayerShare, tracks: Track[]) {
  const dispatch = useDispatch();
  const player = useSelector((state: RootState) => state.player);
  const queued = isQueued(player, share);
  const current = queued ? currentTrack(player) : null;
  const start = (from: { index?: number; shuffle?: boolean }) => {
    // In the tap itself, so GO's WebView lets the tracks play once they are on the node.
    unlockAudio();
    dispatch(playQueue({ tracks, share, start: from.index, shuffle: from.shuffle }));
  };
  return {
    queued,
    playing: queued && player.playing,
    current,
    playAll: () => start({ index: 0 }),
    shuffleAll: () => start({ shuffle: true }),
    /** Start at this track, or pause and resume it when it is the one playing. */
    playOrToggle: (index: number) => {
      const track = tracks[index];
      if (queued && current?.identifier === track?.identifier) {
        if (!player.playing) unlockAudio();
        dispatch(setPlaying(!player.playing));
      } else if (queued && player.tracks.some((t) => t.identifier === track?.identifier)) {
        unlockAudio();
        dispatch(playTrack(player.tracks.findIndex((t) => t.identifier === track?.identifier)));
      } else {
        start({ index });
      }
    },
    toggle: () => {
      if (!player.playing) unlockAudio();
      dispatch(setPlaying(!player.playing));
    },
  };
}

/**
 * On a share with two or more audio files: Play all and Shuffle, which start
 * the app's player (it keeps playing on other pages), and what is playing.
 */
export function PlaylistCard({ share, tracks }: { share: PlayerShare; tracks: Track[] }) {
  const phone = usePhoneLayout();
  const controls = usePlaylistControls(share, tracks);
  return (
    <Card aria-label="Playlist">
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <Box sx={{ color: "primary.main", display: "flex" }} aria-hidden>
          {controls.playing ? <GraphicEqRoundedIcon /> : <PlaylistPlayOutlinedIcon />}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" sx={{ fontWeight: 700, fontSize: 16 }}>
            Playlist · {tracks.length} tracks
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {controls.current
              ? `${controls.playing ? "Playing" : "Paused"}: ${trackTitle(controls.current)}`
              : "Plays in order, and keeps playing while you browse."}
          </Typography>
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          gap: 1,
          flexDirection: phone ? "column" : "row",
          "& .MuiButton-root": { minHeight: phone ? 48 : 40 },
        }}
      >
        {controls.queued ? (
          <Button
            variant="contained"
            startIcon={controls.playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
            onClick={controls.toggle}
          >
            {controls.playing ? "Pause" : "Resume"}
          </Button>
        ) : (
          <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={controls.playAll}>
            Play all
          </Button>
        )}
        <Button variant="outlined" startIcon={<ShuffleRoundedIcon />} onClick={controls.shuffleAll}>
          Shuffle
        </Button>
      </Box>
    </Card>
  );
}
