import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, configure, screen, waitFor } from "@testing-library/react";
import { mockAllIsIntersecting } from "react-intersection-observer/test-utils";
import { Route, Routes } from "react-router-dom";
import { FileContent } from "./FileContent";
import { renderWithProviders } from "../../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction } from "../../test/setup";
import { store } from "../../state/store";
import { addToHashMap } from "../../state/features/fileSlice";
import { updateDownloads } from "../../state/features/globalSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetAudioCovers } from "../../hooks/useAudioCover";
import * as audioCover from "../../utils/audioCover";

configure({ asyncUtilTimeout: 5_000 });

const track = (n: number, album = "a") => ({
  filename: `0${n} Song.mp3`,
  identifier: `qshare_file_album_${album}${n}`,
  name: "dj",
  service: "FILE",
  mimetype: "audio/mpeg",
  size: 1000,
});

function renderShare(id: string, extra: object = {}, album = "a") {
  store.dispatch(addToHashMap({ id, user: "dj", title: "Album", version: 1, commentsId: "c", category: "3", files: [track(1, album), track(2, album)], created: 1, ...extra }));
  return renderWithProviders(
    <Routes>
      <Route path="/share/:name/:id" element={<FileContent />} />
    </Routes>,
    { initialEntries: [`/share/dj/${id}`] }
  );
}

const srcs = (container: HTMLElement) => [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));

beforeEach(() => {
  resetQdnSearchCache();
  resetAudioCovers();
  vi.restoreAllMocks();
  mockFetch(/service=BLOG_COMMENT/, []);
  mockQortalAction("GET_LIST_ITEMS", []);
  URL.createObjectURL = vi.fn(() => "blob:art");
});

describe("cover art on a share page", { timeout: 20_000 }, () => {
  it("shows the art inside tracks the node holds, in the rows and at the top", async () => {
    mockFetch("/arbitrary/resource/status", { status: "READY" });
    const read = vi.spyOn(audioCover, "readEmbeddedCover").mockResolvedValue({ bytes: new Uint8Array([0xff, 0xd8, 0xff]), type: "image/jpeg" });
    const { container } = renderShare("qshare_file_album_a1_metadata");
    await screen.findByText("01 Song.mp3");
    mockAllIsIntersecting(true);
    await waitFor(() => expect(srcs(container).filter((s) => s === "blob:art").length).toBe(3));
    // One read per track, however many places show it.
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("reads nothing from a track the node doesn't hold, and shows the share's thumbnail there", async () => {
    mockFetch("/arbitrary/resource/status", { status: "PUBLISHED" });
    const read = vi.spyOn(audioCover, "readEmbeddedCover");
    const thumbnail = { service: "THUMBNAIL", name: "dj", identifier: "qshare_thumb_album_t1" };
    const { container } = renderShare("qshare_file_album_a2_metadata", { thumbnail }, "b");
    await screen.findByText("01 Song.mp3");
    mockAllIsIntersecting(true);
    const url = "/arbitrary/THUMBNAIL/dj/qshare_thumb_album_t1?async=true";
    await waitFor(() => expect(srcs(container).filter((s) => s === url).length).toBe(3));
    await waitFor(() => expect(fetchCallsMatching("/arbitrary/resource/status/FILE/dj/").length).toBe(2));
    expect(read).not.toHaveBeenCalled();
    expect(fetchCallsMatching("/arbitrary/FILE/")).toEqual([]);
  });

  it("shows a track's art as soon as its fetch finishes", async () => {
    mockFetch("/arbitrary/resource/status", { status: "PUBLISHED" });
    vi.spyOn(audioCover, "readEmbeddedCover").mockResolvedValue({ bytes: new Uint8Array([0xff, 0xd8, 0xff]), type: "image/jpeg" });
    const { container } = renderShare("qshare_file_album_a3_metadata", {}, "c");
    await screen.findByText("01 Song.mp3");
    mockAllIsIntersecting(true);
    await waitFor(() => expect(fetchCallsMatching("/arbitrary/resource/status/FILE/dj/qshare_file_album_c1").length).toBe(1));
    expect(srcs(container)).not.toContain("blob:art");
    act(() => {
      store.dispatch(updateDownloads({ name: "dj", service: "FILE", identifier: "qshare_file_album_c1", status: { status: "READY" } }));
    });
    await waitFor(() => expect(srcs(container)).toContain("blob:art"));
  });
});
