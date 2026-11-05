import { describe, expect, it } from "vitest";
import reducer, {
  closePlayer,
  currentTrack,
  cycleRepeat,
  nextTrack,
  playQueue,
  playTrack,
  previousTrack,
  setPlaying,
  shuffledOrder,
  toggleShuffle,
  upcomingTrack,
  type PlayerState,
} from "./playerSlice";

const tracks = ["a", "b", "c", "d"].map((id) => ({ name: "dj", service: "FILE", identifier: id, filename: `${id}.mp3` }));
const share = { name: "dj", identifier: "qshare_file_album_x_metadata", title: "Album" };
const start = (index = 0) => reducer(undefined, playQueue({ tracks, share, start: index }));
const ids = (state: PlayerState) => state.order.map((i) => tracks[i].identifier);

describe("player queue", () => {
  it("plays the share's tracks in order from the one picked", () => {
    const state = start(2);
    expect(state.playing).toBe(true);
    expect(currentTrack(state)?.identifier).toBe("c");
    expect(upcomingTrack(state)?.identifier).toBe("d");
    expect(ids(state)).toEqual(["a", "b", "c", "d"]);
  });

  it("stops after the last track, and Play then starts again from the first", () => {
    let state = start(3);
    expect(upcomingTrack(state)).toBeNull();
    state = reducer(state, nextTrack({}));
    expect(currentTrack(state)?.identifier).toBe("d");
    state = reducer(state, nextTrack({ auto: true }));
    expect(state).toMatchObject({ playing: false, ended: true });
    state = reducer(state, setPlaying(true));
    expect(currentTrack(state)?.identifier).toBe("a");
    expect(state.playing).toBe(true);
  });

  it("repeats all, or one track, and Previous goes back (or starts the first over)", () => {
    let state = reducer(start(3), cycleRepeat());
    expect(state.repeat).toBe("all");
    expect(upcomingTrack(state)?.identifier).toBe("a");
    state = reducer(state, nextTrack({ auto: true }));
    expect(currentTrack(state)?.identifier).toBe("a");
    state = reducer(state, previousTrack());
    expect(currentTrack(state)?.identifier).toBe("d");

    state = reducer(state, cycleRepeat());
    expect(state.repeat).toBe("one");
    const restart = state.restart;
    state = reducer(state, nextTrack({ auto: true }));
    expect(currentTrack(state)?.identifier).toBe("d");
    expect(state.restart).toBe(restart + 1);
    // Next pressed by hand still moves on.
    state = reducer(state, nextTrack({}));
    expect(currentTrack(state)?.identifier).toBe("d");
    expect(reducer(state, cycleRepeat()).repeat).toBe("off");

    const first = start(0);
    const again = reducer(first, previousTrack());
    expect(currentTrack(again)?.identifier).toBe("a");
    expect(again.restart).toBe(first.restart + 1);
  });

  it("shuffles around the current track and returns to the share's order", () => {
    const order = shuffledOrder(4, 2, () => 0);
    expect(order[0]).toBe(2);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);

    let state = reducer(start(1), toggleShuffle({ count: 4, track: 1 }));
    expect(state.shuffle).toBe(true);
    expect(state.position).toBe(0);
    expect(currentTrack(state)?.identifier).toBe("b");
    state = reducer(state, toggleShuffle({ count: 4, track: 1 }));
    expect(ids(state)).toEqual(["a", "b", "c", "d"]);
    expect(currentTrack(state)?.identifier).toBe("b");

    const shuffled = reducer(undefined, playQueue({ tracks, share, shuffle: true }));
    expect(shuffled.shuffle).toBe(true);
    expect(shuffled.position).toBe(0);
    expect([...shuffled.order].sort()).toEqual([0, 1, 2, 3]);
  });

  it("jumps to a track, and closes", () => {
    let state = reducer(reducer(start(0), setPlaying(false)), playTrack(3));
    expect(currentTrack(state)?.identifier).toBe("d");
    expect(state.playing).toBe(true);
    state = reducer(state, closePlayer());
    expect(currentTrack(state)).toBeNull();
    expect(state.tracks).toEqual([]);
  });
});
