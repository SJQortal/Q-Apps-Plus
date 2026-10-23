import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, configure, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { closePlayer, playQueue } from "../../state/features/playerSlice";
import { removeDownload, updateDownloads } from "../../state/features/globalSlice";
import { AudioPlayer, SKIP_AFTER_MS, STUCK_SKIP_MS, formatTime, trackTitle } from "./AudioPlayer";
import { playerAudio, resetPlayerAudio, unlockAudio } from "./audioElement";
import DownloadWrapper from "../../wrappers/DownloadWrapper";

configure({ asyncUtilTimeout: 5_000 });

const tracks = ["one", "two", "three"].map((n) => ({
  name: "dj b",
  service: "FILE",
  identifier: `qshare_file_album_${n}`,
  filename: `${n}.mp3`,
  mimetype: "audio/mpeg",
}));
const share = { name: "dj b", identifier: "qshare_file_album_x_metadata", title: "Album" };

// jsdom has no media playback: play and pause only record what happened.
const play = vi.fn(function (this: HTMLMediaElement) {
  Object.defineProperty(this, "paused", { configurable: true, value: false });
  this.dispatchEvent(new Event("play"));
  return Promise.resolve();
});
const pause = vi.fn(function (this: HTMLMediaElement) {
  Object.defineProperty(this, "paused", { configurable: true, value: true });
  this.dispatchEvent(new Event("pause"));
});

/** The node says READY for these identifiers, DOWNLOADING for the rest, NOT_PUBLISHED for `missing`. */
function mockNode(ready: string[], missing: string[] = []) {
  mockQortalAction("GET_QDN_RESOURCE_STATUS", (params) => {
    const id = String(params.identifier);
    if (missing.includes(id)) return { status: "NOT_PUBLISHED" };
    return ready.includes(id) ? { status: "READY" } : { status: "DOWNLOADING", percentLoaded: 10 };
  });
}

const src = () => playerAudio().getAttribute("src");

beforeEach(() => {
  resetPlayerAudio();
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, writable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, writable: true, value: pause });
  Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, writable: true, value: vi.fn() });
  mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", {});
});

afterEach(() => {
  act(() => {
    store.dispatch(closePlayer());
    for (const track of tracks) store.dispatch(removeDownload(track.identifier));
  });
  vi.useRealTimers();
});

describe("AudioPlayer", () => {
  it("names tracks and times", () => {
    expect(trackTitle({ filename: "01 - Intro.flac" })).toBe("01 - Intro");
    expect(trackTitle({ filename: ".hidden" })).toBe(".hidden");
    expect(formatTime(187.9)).toBe("3:07");
    expect(formatTime(3723)).toBe("1:02:03");
    expect(formatTime(Number.NaN)).toBe("–:––");
  });

  it("shows nothing until a playlist starts", () => {
    renderWithProviders(<AudioPlayer />);
    expect(screen.queryByRole("region", { name: "Player" })).not.toBeInTheDocument();
  });

  it("plays a track once the node has it, fetches the next ahead, and moves on at the end", async () => {
    mockNode([tracks[0].identifier, tracks[1].identifier]);
    renderWithProviders(<AudioPlayer />);
    act(() => {
      store.dispatch(playQueue({ tracks, share, start: 0 }));
    });

    expect(await screen.findByRole("region", { name: "Player" })).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("Album · 1/3")).toBeInTheDocument();
    await waitFor(() => expect(src()).toBe("/arbitrary/FILE/dj%20b/qshare_file_album_one"));
    expect(play).toHaveBeenCalled();
    // The next track is asked for while this one plays.
    await waitFor(() =>
      expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS").map((c) => c.identifier)).toContain(tracks[1].identifier)
    );

    act(() => {
      playerAudio().dispatchEvent(new Event("ended"));
    });
    await waitFor(() => expect(src()).toBe("/arbitrary/FILE/dj%20b/qshare_file_album_two"));
    expect(screen.getByText("two")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(store.getState().player.playing).toBe(false);
    expect(pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(store.getState().player.playing).toBe(true);
  });

  it("after a track played, waits for the next one the node is still fetching instead of loading it", async () => {
    // Track one is on the node; two and three are not.
    mockNode([tracks[0].identifier]);
    renderWithProviders(
      <DownloadWrapper>
        <AudioPlayer />
      </DownloadWrapper>
    );
    act(() => {
      store.dispatch(playQueue({ tracks, share, start: 0 }));
    });
    await waitFor(() => expect(src()).toBe("/arbitrary/FILE/dj%20b/qshare_file_album_one"));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText(/Fetching from peers/)).toBeInTheDocument();
    expect(src()).toBe("/arbitrary/FILE/dj%20b/qshare_file_album_one");
    // Once the node has it, it loads and plays.
    mockNode([tracks[0].identifier, tracks[1].identifier]);
    act(() => {
      store.dispatch(updateDownloads({ name: "dj b", service: "FILE", identifier: tracks[1].identifier, status: { status: "READY" } }));
    });
    await waitFor(() => expect(src()).toBe("/arbitrary/FILE/dj%20b/qshare_file_album_two"));
  });

  it("waits for a track the node is still fetching, saying so", async () => {
    mockNode([]);
    renderWithProviders(
      <DownloadWrapper>
        <AudioPlayer />
      </DownloadWrapper>
    );
    act(() => {
      store.dispatch(playQueue({ tracks, share, start: 0 }));
    });
    expect(await screen.findByText(/Fetching from peers/)).toBeInTheDocument();
    expect(src() ?? "").not.toContain("qshare_file_album_one");
    // Through the downloads list's machine: the node is asked to fetch it.
    expect(qortalCallsFor("GET_QDN_RESOURCE_PROPERTIES").map((c) => c.identifier)).toContain(tracks[0].identifier);
  });

  it("skips a track the network doesn't have", async () => {
    mockNode([tracks[1].identifier], [tracks[0].identifier]);
    renderWithProviders(<AudioPlayer />);
    act(() => {
      store.dispatch(playQueue({ tracks, share, start: 0 }));
    });
    expect(await screen.findByText("Not found on the network Skipping…")).toBeInTheDocument();
    await waitFor(() => expect(src()).toBe("/arbitrary/FILE/dj%20b/qshare_file_album_two"), {
      timeout: SKIP_AFTER_MS + 3000,
    });
  });

  it("skips a track whose fetch hasn't moved for a minute, saying so", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // Track one never gets past 10%; track two is on the node.
    mockNode([tracks[1].identifier]);
    renderWithProviders(<AudioPlayer />);
    act(() => {
      store.dispatch(playQueue({ tracks, share, start: 0 }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(src() ?? "").not.toContain("qshare_file_album_one");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STUCK_SKIP_MS - 1000);
    });
    expect(store.getState().player.position).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(store.getState().player.position).toBe(1);
    expect(store.getState().notifications.alertTypes.alertInfo).toMatch(/^Skipped “one”/);
  });

  it("makes way when another player on the page starts", async () => {
    mockNode(tracks.map((t) => t.identifier));
    renderWithProviders(
      <>
        <AudioPlayer />
        <audio data-testid="inline" />
      </>
    );
    act(() => {
      store.dispatch(playQueue({ tracks, share, start: 0 }));
    });
    await waitFor(() => expect(store.getState().player.playing).toBe(true));
    await waitFor(() => expect(playerAudio().paused).toBe(false));
    act(() => {
      screen.getByTestId("inline").dispatchEvent(new Event("play"));
    });
    expect(playerAudio().paused).toBe(true);
    expect(store.getState().player.playing).toBe(false);
  });

  it("stops and lets go of the file when the playlist closes", async () => {
    mockNode(tracks.map((t) => t.identifier));
    renderWithProviders(<AudioPlayer />);
    act(() => {
      store.dispatch(playQueue({ tracks, share, start: 0 }));
    });
    await waitFor(() => expect(src()).toBe("/arbitrary/FILE/dj%20b/qshare_file_album_one"));
    act(() => {
      store.dispatch(closePlayer());
    });
    expect(src()).toBeNull();
    expect(playerAudio().paused).toBe(true);
    expect(screen.queryByRole("region", { name: "Player" })).not.toBeInTheDocument();
  });

  it("unlocks the element once, during a tap", () => {
    unlockAudio();
    unlockAudio();
    expect(play).toHaveBeenCalledTimes(1);
    expect(src()).toMatch(/^data:audio\/wav/);
  });
});
