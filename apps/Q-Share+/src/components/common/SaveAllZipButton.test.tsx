import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { SaveAllZipButton, ZIP_MAX_BYTES } from "./SaveAllZipButton";
import { buildZip } from "../../utils/zip";
import { store } from "../../state/store";
import { removeNotification } from "../../state/features/notificationsSlice";

const files = [
  { name: "alice", identifier: "qshare_file_a_1", filename: "notes.txt", size: 5 },
  { name: "alice", identifier: "qshare_file_a_2", filename: "more.txt", size: 6 },
];

describe("SaveAllZipButton", () => {
  it("renders only for two or more files under the size limit", () => {
    const { unmount } = renderWithProviders(<SaveAllZipButton files={[files[0]]} title="One" allReady />);
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    renderWithProviders(<SaveAllZipButton files={[{ ...files[0], size: ZIP_MAX_BYTES }, files[1]]} title="Big" allReady />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is disabled until every file is on the node", () => {
    renderWithProviders(<SaveAllZipButton files={files} title="Two" allReady={false} />);
    expect(screen.getByRole("button", { name: /save all as \.zip/i })).toBeDisabled();
  });

  it("reads each file from the node and hands one zip to SAVE_FILE", async () => {
    mockFetch("/arbitrary/FILE/alice/qshare_file_a_1", "hello");
    mockFetch("/arbitrary/FILE/alice/qshare_file_a_2", "world!");
    let saved: any = null;
    mockQortalAction("SAVE_FILE", (params: any) => {
      saved = params;
      return true;
    });
    renderWithProviders(<SaveAllZipButton files={files} title="Holiday photos: 2026" allReady />);
    fireEvent.click(screen.getByRole("button", { name: /save all as \.zip/i }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    expect(fetchCallsMatching("/arbitrary/FILE/alice/").length).toBe(2);
    expect(saved.filename).toBe("holiday-photos-2026.zip");
    expect(saved.mimeType).toBe("application/zip");
    const expected = buildZip([
      { name: "notes.txt", data: new TextEncoder().encode("hello") },
      { name: "more.txt", data: new TextEncoder().encode("world!") },
    ]);
    expect(saved.blob.size).toBe(expected.length);
    await waitFor(() => expect(screen.getByRole("button", { name: /save all as \.zip/i })).toBeEnabled());
  });

  it("stays quiet when Hub's save prompt is declined", async () => {
    store.dispatch(removeNotification());
    mockFetch("/arbitrary/FILE/alice/", "data");
    // Hub answers a decline (or its 60 s timeout) with a bare string.
    mockQortalAction("SAVE_FILE", () => Promise.reject("User declined to save file"));
    renderWithProviders(<SaveAllZipButton files={files} title="Two" allReady />);
    fireEvent.click(screen.getByRole("button", { name: /save all as \.zip/i }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: /save all as \.zip/i })).toBeEnabled());
    expect(store.getState().notifications.alertTypes.alertError).toBe("");
  });

  it("shows a node error even when the file's name reads like a decline", async () => {
    store.dispatch(removeNotification());
    mockFetch("/arbitrary/FILE/alice/", "data");
    vi.mocked(fetch).mockImplementationOnce(async () => new Response("", { status: 500 }));
    mockQortalAction("SAVE_FILE", true);
    const named = [{ ...files[0], filename: "cancelled.txt" }, files[1]];
    renderWithProviders(<SaveAllZipButton files={named} title="Two" allReady />);
    fireEvent.click(screen.getByRole("button", { name: /save all as \.zip/i }));
    await waitFor(() =>
      expect(store.getState().notifications.alertTypes.alertError).toBe("The node answered 500 for cancelled.txt")
    );
    expect(qortalCallsFor("SAVE_FILE").length).toBe(0);
    await waitFor(() => expect(screen.getByRole("button", { name: /save all as \.zip/i })).toBeEnabled());
  });

  it("shows the real reason when the zip cannot be saved", async () => {
    store.dispatch(removeNotification());
    mockFetch("/arbitrary/FILE/alice/", "data");
    mockQortalAction("SAVE_FILE", () => Promise.reject("Failed to save file"));
    renderWithProviders(<SaveAllZipButton files={files} title="Two" allReady />);
    fireEvent.click(screen.getByRole("button", { name: /save all as \.zip/i }));
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertError).toBe("Failed to save file"));
  });
});
