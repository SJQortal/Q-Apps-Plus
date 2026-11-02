import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { unlockAudio } from "../../../components/player/audioElement";
import { currentTrack, playQueue, playTrack, setPlaying, syncQueue, trackKey, type PlayerShare, type PlayerState, type Track } from "../../../state/features/playerSlice";
import type { RootState } from "../../../state/store";
import type { SpaceShare } from "./useSpaceItems";

export { trackKey };

/** A share's tracks can be played unless it is gone. */
export const playableTracks = (share: SpaceShare): Track[] => (share.deleted || share.unreadable ? [] : share.audio);

/** Every playable track of these shares in order, each file once, and where each one is. */
export function buildQueue(shares: SpaceShare[]): { tracks: Track[]; indexOf: Map<string, number> } {
  const tracks: Track[] = [];
  const indexOf = new Map<string, number>();
  for (const share of shares) {
    for (const track of playableTracks(share)) {
      const key = trackKey(track);
      if (indexOf.has(key)) continue;
      indexOf.set(key, tracks.length);
      tracks.push({ ...track, from: { name: share.user, identifier: share.identifier, title: share.title } });
    }
  }
  return { tracks, indexOf };
}

/**
 * What the player is told it plays: this place's title, and the first share
 * with audio as the name and identifier, because the player's "Open share" and
 * the downloads list open those as a share page, which a collection isn't.
 * `path` sends "Open collection" back to this place.
 */
export function queueOwner(shares: SpaceShare[], title: string, path?: string): PlayerShare | null {
  const first = shares.find((share) => playableTracks(share).length > 0);
  return first ? { name: first.user, identifier: first.identifier, title, ...(path ? { path } : {}) } : null;
}

/** The player holds this place's queue: its path and title, from one of its shares (the first with audio can change as bodies land). */
export function isThisQueue(player: Pick<PlayerState, "share">, shares: SpaceShare[], title: string, path?: string): boolean {
  const held = player.share;
  if (!held || held.title !== title || held.path !== path) return false;
  return shares.some((share) => share.user === held.name && share.identifier === held.identifier);
}

/** Play, shuffle, pause and the current track for the shares on the page: PlaylistCard's controls, across shares. */
export function useMusicQueue(shares: SpaceShare[], title: string, path?: string) {
  const dispatch = useDispatch();
  const player = useSelector((state: RootState) => state.player);
  const { tracks, indexOf } = useMemo(() => buildQueue(shares), [shares]);
  const queued = isThisQueue(player, shares, title, path);
  const current = queued ? currentTrack(player) : null;

  // Bodies land and Show more adds shares after Play: the queue keeps up with the page.
  const held = queued ? player.tracks : null;
  const behind = useMemo(() => {
    if (!held) return false;
    const keys = new Set(held.map(trackKey));
    return tracks.some((track) => !keys.has(trackKey(track)));
  }, [held, tracks]);
  useEffect(() => {
    if (behind) dispatch(syncQueue(tracks));
  }, [behind, tracks, dispatch]);

  const start = (from: { index?: number; shuffle?: boolean }) => {
    const share = queueOwner(shares, title, path);
    if (!share) return;
    // In the tap itself, so GO's WebView lets the tracks play once they are on the node.
    unlockAudio();
    dispatch(playQueue({ tracks, share, start: from.index, shuffle: from.shuffle }));
  };
  const toggle = () => {
    if (!player.playing) unlockAudio();
    dispatch(setPlaying(!player.playing));
  };

  return {
    tracks,
    indexOf,
    queued,
    playing: queued && player.playing,
    /** This queue played to its end: the main button starts it again. */
    ended: queued && player.ended,
    currentKey: current ? trackKey(current) : null,
    playAll: () => start({ index: 0 }),
    shuffleAll: () => start({ shuffle: true }),
    toggle,
    /** Start at this track, or pause and resume it when it is the current one. */
    playOrToggle: (track: Track) => {
      const key = trackKey(track);
      if (queued && current && trackKey(current) === key) {
        toggle();
        return;
      }
      const inQueue = queued ? player.tracks.findIndex((held) => trackKey(held) === key) : -1;
      if (inQueue !== -1) {
        unlockAudio();
        dispatch(playTrack(inQueue));
      } else {
        start({ index: indexOf.get(key) ?? 0 });
      }
    },
  };
}
