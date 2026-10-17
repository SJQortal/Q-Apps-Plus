import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** One audio file of a share, as its `files` entry names it. */
export interface Track {
  name: string;
  service: string;
  identifier: string;
  filename: string;
  mimetype?: string;
  size?: number;
}

/** The share a playlist comes from. */
export interface PlayerShare {
  name: string;
  identifier: string;
  title: string;
}

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  tracks: Track[];
  share: PlayerShare | null;
  /** Indices into `tracks` in the order they play (shuffled or not). */
  order: number[];
  /** Where in `order` the player is. */
  position: number;
  /** What the user wants: playing or paused. */
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** The last track played to its end with nothing after it. */
  ended: boolean;
  /** Bumps when the same track should start over (Previous at the start, repeat one). */
  restart: number;
}

const initialState: PlayerState = {
  tracks: [],
  share: null,
  order: [],
  position: 0,
  playing: false,
  shuffle: false,
  repeat: "off",
  ended: false,
  restart: 0,
};

const inOrder = (n: number) => Array.from({ length: n }, (_, i) => i);

/** `first`, then the other indices below `n` in a random order (Fisher–Yates). */
export function shuffledOrder(n: number, first: number, random: () => number = Math.random): number[] {
  const rest = inOrder(n).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return n > 0 ? [first, ...rest] : [];
}

export const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    /** Play `tracks` from `start` (an index into `tracks`). The order is drawn in `prepare`, so the reducer stays pure. */
    playQueue: {
      reducer: (
        state,
        action: PayloadAction<{ tracks: Track[]; share: PlayerShare; start: number; shuffle: boolean; order: number[] }>
      ) => {
        const { tracks, share, start, shuffle, order } = action.payload;
        state.tracks = tracks;
        state.share = share;
        state.shuffle = shuffle;
        state.order = order;
        state.position = Math.max(0, order.indexOf(start));
        state.playing = tracks.length > 0;
        state.ended = false;
        state.restart += 1;
      },
      prepare: (payload: { tracks: Track[]; share: PlayerShare; start?: number; shuffle?: boolean }) => {
        const count = payload.tracks.length;
        const shuffle = Boolean(payload.shuffle);
        const start = shuffle && payload.start === undefined ? Math.floor(Math.random() * count) : (payload.start ?? 0);
        return {
          payload: {
            tracks: payload.tracks,
            share: payload.share,
            start,
            shuffle,
            order: shuffle ? shuffledOrder(count, start) : inOrder(count),
          },
        };
      },
    },
    /** Jump to a track of the current queue (an index into `tracks`). */
    playTrack: (state, action: PayloadAction<number>) => {
      const position = state.order.indexOf(action.payload);
      if (position === -1) return;
      state.position = position;
      state.playing = true;
      state.ended = false;
      state.restart += 1;
    },
    /** The next track; `auto` when the last one ended by itself (repeat one plays it again). */
    nextTrack: (state, action: PayloadAction<{ auto?: boolean } | undefined>) => {
      if (state.order.length === 0) return;
      if (action.payload?.auto && state.repeat === "one") {
        state.restart += 1;
        return;
      }
      if (state.position + 1 < state.order.length) {
        state.position += 1;
      } else if (state.repeat === "all") {
        state.position = 0;
      } else if (action.payload?.auto) {
        // The end of the playlist: stop on the last track.
        state.playing = false;
        state.ended = true;
        return;
      } else {
        return;
      }
      state.ended = false;
      state.restart += 1;
    },
    previousTrack: (state) => {
      if (state.order.length === 0) return;
      if (state.position > 0) state.position -= 1;
      else if (state.repeat === "all") state.position = state.order.length - 1;
      state.ended = false;
      state.restart += 1;
    },
    setPlaying: (state, action: PayloadAction<boolean>) => {
      if (state.tracks.length === 0) return;
      if (action.payload && state.ended) {
        // Play after the end starts the playlist over.
        state.position = 0;
        state.ended = false;
        state.restart += 1;
      }
      state.playing = action.payload;
    },
    /** Shuffle keeps the current track and draws the rest; turning it off returns to the share's order. */
    toggleShuffle: {
      reducer: (state, action: PayloadAction<{ order: number[] }>) => {
        if (state.order.length === 0) return;
        const current = state.order[state.position];
        state.shuffle = !state.shuffle;
        state.order = state.shuffle ? action.payload.order : inOrder(state.tracks.length);
        state.position = Math.max(0, state.order.indexOf(current));
      },
      prepare: (current: { count: number; track: number }) => ({
        payload: { order: shuffledOrder(current.count, current.track) },
      }),
    },
    cycleRepeat: (state) => {
      state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
    },
    closePlayer: () => initialState,
  },
});

export const { playQueue, playTrack, nextTrack, previousTrack, setPlaying, toggleShuffle, cycleRepeat, closePlayer } =
  playerSlice.actions;

/** The track playing now, if any. */
export function currentTrack(state: PlayerState): Track | null {
  const index = state.order[state.position];
  return index === undefined ? null : (state.tracks[index] ?? null);
}

/** The track after the current one, as the queue stands (for fetching it ahead). */
export function upcomingTrack(state: PlayerState): Track | null {
  if (state.order.length < 2) return null;
  if (state.repeat === "one") return null;
  const next = state.position + 1 < state.order.length ? state.position + 1 : state.repeat === "all" ? 0 : -1;
  return next === -1 ? null : (state.tracks[state.order[next]] ?? null);
}

export default playerSlice.reducer;
