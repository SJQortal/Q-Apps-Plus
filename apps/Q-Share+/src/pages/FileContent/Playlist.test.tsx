import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, configure, fireEvent, screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { FileContent } from "./FileContent";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction } from "../../test/setup";
import { store } from "../../state/store";
import { addToHashMap } from "../../state/features/fileSlice";
import { closePlayer, currentTrack } from "../../state/features/playerSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetPlayerAudio } from "../../components/player/audioElement";
import { shareTracks } from "./PlaylistCard";

configure({ asyncUtilTimeout: 5_000 });

const NAME = "dj";
const file = (filename: string, mimetype: string) => ({
  filename,
  identifier: `qshare_file_album_${filename.replace(/\W/g, "")}`,
  name: NAME,
  service: "FILE",
  mimetype,
  size: 1000,
});
const album = [
  file("01 Intro.mp3", "audio/mpeg"),
  file("booklet.pdf", "application/pdf"),
  file("02 Song.flac", "audio/flac"),
  file("03 Outro.m4a", "audio/mp4"),
  file("demo.wma", "audio/x-ms-wma"),
];

function renderShare(id: string, files: typeof album) {
  store.dispatch(addToHashMap({ id, user: NAME, title: "Album", version: 1, commentsId: "c", category: "3", files, created: 1 }));
  return renderWithProviders(
    <Routes>
      <Route path="/share/:name/:id" element={<FileContent />} />
    </Routes>,
    { initialEntries: [`/share/${NAME}/${id}`] }
  );
}

beforeEach(() => {
  resetQdnSearchCache();
  resetPlayerAudio();
  mockFetch(/service=BLOG_COMMENT/, []);
  mockQortalAction("GET_LIST_ITEMS", []);
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, writable: true, value: vi.fn(() => Promise.resolve()) });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, writable: true, value: vi.fn() });
});

afterEach(() => {
  act(() => {
    store.dispatch(closePlayer());
  });
});

describe("a share with several audio files", () => {
  it("keeps the playable audio files, in the share's order", () => {
    expect(shareTracks(album).map((t) => t.filename)).toEqual(["01 Intro.mp3", "02 Song.flac", "03 Outro.m4a"]);
  });

  it("plays as a playlist from Play all, or from any track's Play", async () => {
    renderShare("qshare_file_album_aaaaaa_metadata", album);
    const card = within(await screen.findByRole("region", { name: "Playlist" }));
    expect(card.getByText("Playlist · 3 tracks")).toBeInTheDocument();
    // Audio rows play through the playlist instead of an inline player.
    expect(screen.queryByRole("button", { name: /^Play audio/ })).not.toBeInTheDocument();

    fireEvent.click(card.getByRole("button", { name: "Play all" }));
    const player = store.getState().player;
    expect(player.tracks.map((t) => t.filename)).toEqual(["01 Intro.mp3", "02 Song.flac", "03 Outro.m4a"]);
    expect(player.share).toEqual({ name: NAME, identifier: "qshare_file_album_aaaaaa_metadata", title: "Album" });
    expect(currentTrack(player)?.filename).toBe("01 Intro.mp3");
    expect(player.playing).toBe(true);
    expect(card.getByText("Playing: 01 Intro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause 01 Intro.mp3" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Play 03 Outro.m4a" }));
    expect(currentTrack(store.getState().player)?.filename).toBe("03 Outro.m4a");
    fireEvent.click(screen.getByRole("button", { name: "Pause 03 Outro.m4a" }));
    expect(store.getState().player.playing).toBe(false);
    expect(card.getByRole("button", { name: "Resume" })).toBeInTheDocument();

    fireEvent.click(card.getByRole("button", { name: "Shuffle" }));
    expect(store.getState().player.shuffle).toBe(true);
    expect([...store.getState().player.order].sort()).toEqual([0, 1, 2]);
  });

  it("keeps the inline player for a share with one audio file", async () => {
    renderShare("qshare_file_single_bbbbbb_metadata", [file("only.mp3", "audio/mpeg"), file("notes.pdf", "application/pdf")]);
    expect(await screen.findByRole("button", { name: "Play audio only.mp3" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Playlist" })).not.toBeInTheDocument();
  });
});
