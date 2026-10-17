import { beforeEach, describe, expect, it } from "vitest";
import { act, configure, fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { FileContent, FILE_PAGE } from "./FileContent";
import { FETCH_ALL_AT_ONCE } from "./useFetchAll";
import DownloadWrapper from "../../wrappers/DownloadWrapper";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addToHashMap } from "../../state/features/fileSlice";
import { clearFinishedDownloads, removeDownload, updateDownloads } from "../../state/features/globalSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";

// A share of 120 rows renders slowly on a busy machine.
configure({ asyncUtilTimeout: 5_000 });

const NAME = "dj";
const ID = "qshare_file_big-album_abcdef_metadata";
const files = Array.from({ length: 120 }, (_, i) => ({
  filename: `track${String(i + 1).padStart(3, "0")}.zip`,
  identifier: `qshare_file_big-album_t${i}`,
  name: NAME,
  service: "FILE",
  mimetype: "application/zip",
  size: 1000,
}));

function renderBigShare() {
  store.dispatch(
    addToHashMap({ id: ID, user: NAME, title: "Big album", version: 1, commentsId: "c", category: "3", files, created: 1 })
  );
  return renderWithProviders(
    <DownloadWrapper>
      <Routes>
        <Route path="/share/:name/:id" element={<FileContent />} />
      </Routes>
    </DownloadWrapper>,
    { initialEntries: [`/share/${NAME}/${ID}`] }
  );
}

const started = () => qortalCallsFor("GET_QDN_RESOURCE_PROPERTIES").map((c) => c.identifier);

describe("a share with many files", { timeout: 20_000 }, () => {
  beforeEach(() => {
    resetQdnSearchCache();
    mockFetch(/service=BLOG_COMMENT/, []);
    mockQortalAction("GET_LIST_ITEMS", []);
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", {});
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "DOWNLOADING", percentLoaded: 10 });
  });

  it("lists the files 50 at a time", async () => {
    renderBigShare();
    expect(await screen.findByText("120 files")).toBeInTheDocument();
    expect(screen.getByText("track050.zip")).toBeInTheDocument();
    expect(screen.queryByText("track051.zip")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Download / }).length).toBe(FILE_PAGE);

    fireEvent.click(screen.getByRole("button", { name: "Show 50 more of 70" }));
    expect(screen.getByText("track100.zip")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 20 more of 20" }));
    expect(screen.getByText("track120.zip")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Show \d+ more/ })).not.toBeInTheDocument();
  });

  it("fetches all files a few at a time, starting the next as each one is ready", async () => {
    renderBigShare();
    fireEvent.click(await screen.findByRole("button", { name: "Fetch all files" }));

    await waitFor(() => expect(started().length).toBe(FETCH_ALL_AT_ONCE));
    expect(started()).toEqual(files.slice(0, FETCH_ALL_AT_ONCE).map((f) => f.identifier));
    expect(screen.getByRole("button", { name: "Fetching… 0 of 120 ready" })).toBeDisabled();

    // Two finish: two more start, and no more than that.
    act(() => {
      for (const f of files.slice(0, 2)) {
        store.dispatch(updateDownloads({ name: NAME, service: "FILE", identifier: f.identifier, status: { status: "READY" } }));
      }
    });
    await waitFor(() => expect(started().length).toBe(FETCH_ALL_AT_ONCE + 2));
    expect(started().slice(-2)).toEqual([files[6].identifier, files[7].identifier]);
    expect(screen.getByRole("button", { name: "Fetching… 2 of 120 ready" })).toBeInTheDocument();

    // One the network doesn't have frees its place too.
    act(() => {
      store.dispatch(
        updateDownloads({ name: NAME, service: "FILE", identifier: files[2].identifier, status: { status: "NOT_PUBLISHED" } })
      );
    });
    await waitFor(() => expect(started().length).toBe(FETCH_ALL_AT_ONCE + 3));
    expect(new Set(started()).size).toBe(started().length);

    // One waiting for peers that lack chunks keeps its place: its poller goes on.
    act(() => {
      store.dispatch(
        updateDownloads({ name: NAME, service: "FILE", identifier: files[3].identifier, status: { status: "MISSING_DATA", percentLoaded: 40 } })
      );
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(started().length).toBe(FETCH_ALL_AT_ONCE + 3);
    act(() => {
      for (const f of files) store.dispatch(removeDownload(f.identifier));
    });
  });

  it("comes back to Fetch all files when finished downloads are cleared", async () => {
    const few = files.slice(0, 8).map((f) => ({ ...f, identifier: f.identifier + "_few" }));
    store.dispatch(
      addToHashMap({ id: ID + "2", user: NAME, title: "Small album", version: 1, commentsId: "c", category: "3", files: few, created: 1 })
    );
    renderWithProviders(
      <DownloadWrapper>
        <Routes>
          <Route path="/share/:name/:id" element={<FileContent />} />
        </Routes>
      </DownloadWrapper>,
      { initialEntries: [`/share/${NAME}/${ID}2`] }
    );
    fireEvent.click(await screen.findByRole("button", { name: "Fetch all files" }));
    act(() => {
      for (const f of few.slice(0, 6)) {
        store.dispatch(updateDownloads({ name: NAME, service: "FILE", identifier: f.identifier, status: { status: "READY" } }));
      }
    });
    await waitFor(() => expect(started().filter((id) => id.endsWith("_few"))).toHaveLength(8));
    act(() => {
      for (const f of few.slice(6)) {
        store.dispatch(updateDownloads({ name: NAME, service: "FILE", identifier: f.identifier, status: { status: "READY" } }));
      }
    });
    expect(screen.getByRole("button", { name: "All files ready" })).toBeDisabled();
    // The downloads list's Clear finished: those files are no longer fetched, and the button says so.
    act(() => {
      store.dispatch(clearFinishedDownloads());
    });
    expect(screen.getByRole("button", { name: "Fetch all files" })).toBeEnabled();
  });
});
