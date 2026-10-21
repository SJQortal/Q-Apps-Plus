import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { removeDownload, setAddToDownloads, updateDownloads } from "../../state/features/globalSlice";
import { removeNotification } from "../../state/features/notificationsSlice";
import FileElement, { keepsNameByLocation, streamsByLocation } from "./FileElement";

const file = { name: "alice", service: "FILE", identifier: "qshare_file_notes_1", filename: "notes.txt", mimetype: "text/plain" };

/** Put the file in the downloads list as READY, as the poller would. */
function markReady() {
  store.dispatch(setAddToDownloads({ name: file.name, service: file.service, identifier: file.identifier, properties: file }));
  store.dispatch(updateDownloads({ name: file.name, service: file.service, identifier: file.identifier, status: { status: "READY" } }));
}

const errorToast = () => store.getState().notifications.alertTypes.alertError;

const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36";
const desktop = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 qortal-hub/3.0.3 Chrome/128.0 Electron/32.3.1";
const runIn = (userAgent: string) => vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);

describe("FileElement save", () => {
  beforeEach(() => {
    store.dispatch(removeDownload(file.identifier));
    store.dispatch(removeNotification());
    // Big enough to stream on desktop (see streamsByLocation).
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "notes.txt", mimeType: "text/plain", size: 200 * 1024 * 1024 });
    mockFetch("/arbitrary/FILE/alice/qshare_file_notes_1", "hello");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lets Hub stream the file from the node instead of reading it here", async () => {
    markReady();
    mockQortalAction("SAVE_FILE", true);
    renderWithProviders(<FileElement fileInfo={file} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save notes.txt" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    expect(qortalCallsFor("SAVE_FILE")[0]).toEqual({
      action: "SAVE_FILE",
      filename: "notes.txt",
      mimeType: "text/plain",
      location: { service: "FILE", name: "alice", identifier: "qshare_file_notes_1" },
    });
    expect(fetchCallsMatching("/arbitrary/FILE/").length).toBe(0);
  });

  it("falls back to a blob for a Hub that asks for one", async () => {
    markReady();
    // Hubs before `location` support answer "Missing fields: blob".
    mockQortalAction("SAVE_FILE", (params: any) => (params.blob ? true : Promise.reject("Missing fields: blob")));
    renderWithProviders(<FileElement fileInfo={file} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save notes.txt" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(2));
    const [, second] = qortalCallsFor("SAVE_FILE") as any[];
    expect(second.blob.size).toBe(5);
    expect(second.filename).toBe("notes.txt");
    expect(fetchCallsMatching("/arbitrary/FILE/alice/qshare_file_notes_1").length).toBe(1);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save notes.txt" })).toBeEnabled());
    expect(errorToast()).toBe("");
  });

  it("stays quiet when the save prompt is declined", async () => {
    markReady();
    mockQortalAction("SAVE_FILE", () => Promise.reject("User declined to save file"));
    renderWithProviders(<FileElement fileInfo={file} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save notes.txt" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save notes.txt" })).toBeEnabled());
    expect(errorToast()).toBe("");
    // No second prompt and no whole-file read after a decline.
    expect(qortalCallsFor("SAVE_FILE").length).toBe(1);
    expect(fetchCallsMatching("/arbitrary/FILE/").length).toBe(0);
  });

  it("shows Hub's reason when the save fails", async () => {
    markReady();
    mockQortalAction("SAVE_FILE", () => Promise.reject("Failed to save file"));
    renderWithProviders(<FileElement fileInfo={file} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save notes.txt" }));
    await waitFor(() => expect(errorToast()).toBe("Failed to save file"));
    expect(qortalCallsFor("SAVE_FILE").length).toBe(1);
  });

  it("reads a file here when GO would save it by location with no name", async () => {
    // GO keeps only A-Z, a-z, 0-9, space, _ and - of a name it saves by location,
    // so "Отчёт.pdf" would become a hidden, nameless ".pdf". A blob keeps the name.
    runIn(android);
    markReady();
    const report = { ...file, filename: "Отчёт.pdf", mimetype: "application/pdf" };
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "Отчёт.pdf", mimeType: "application/pdf", size: 5 });
    mockQortalAction("SAVE_FILE", true);
    store.dispatch(updateDownloads({ identifier: file.identifier, properties: report }));
    renderWithProviders(<FileElement fileInfo={report} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save Отчёт.pdf" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    const [call] = qortalCallsFor("SAVE_FILE") as any[];
    expect(call.location).toBeUndefined();
    expect(call.filename).toBe("Отчёт.pdf");
    expect(call.blob.size).toBe(5);
    expect(fetchCallsMatching("/arbitrary/FILE/alice/qshare_file_notes_1").length).toBe(1);
    expect(errorToast()).toBe("");
  });

  it("lets desktop Hub stream a big file whose name has no Latin letters, as its Save As keeps the name", async () => {
    runIn(desktop);
    markReady();
    const report = { ...file, filename: "Отчёт.mp4", mimetype: "video/mp4" };
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "Отчёт.mp4", mimeType: "video/mp4", size: 200 * 1024 * 1024 });
    mockQortalAction("SAVE_FILE", true);
    store.dispatch(updateDownloads({ identifier: file.identifier, properties: report }));
    renderWithProviders(<FileElement fileInfo={report} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save Отчёт.mp4" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    const [call] = qortalCallsFor("SAVE_FILE") as any[];
    expect(call.filename).toBe("Отчёт.mp4");
    expect(call.location).toEqual({ service: "FILE", name: "alice", identifier: "qshare_file_notes_1" });
    expect(call.blob).toBeUndefined();
    expect(fetchCallsMatching("/arbitrary/FILE/").length).toBe(0);
  });

  it("hands a small file to desktop Hub as a blob, so it saves in one step", async () => {
    markReady();
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "notes.txt", mimeType: "text/plain", size: 5 });
    mockQortalAction("SAVE_FILE", true);
    renderWithProviders(<FileElement fileInfo={file} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save notes.txt" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    const [call] = qortalCallsFor("SAVE_FILE") as any[];
    expect(call.location).toBeUndefined();
    expect(call.blob?.size).toBe(5);
  });

  it("streams in GO whatever the size, and on desktop from 100 MB", () => {
    expect(streamsByLocation(5, android)).toBe(true);
    expect(streamsByLocation(5, desktop)).toBe(false);
    expect(streamsByLocation(100 * 1024 * 1024, desktop)).toBe(true);
    expect(streamsByLocation(undefined, desktop)).toBe(true);
  });

  it("saves by location only when GO would keep part of the name", () => {
    expect(keepsNameByLocation("notes.txt")).toBe(true);
    expect(keepsNameByLocation("résumé.pdf")).toBe(true);
    expect(keepsNameByLocation("Отчёт 2024.pdf")).toBe(true);
    expect(keepsNameByLocation("qshare_file_notes_1")).toBe(true);
    expect(keepsNameByLocation("Отчёт.pdf")).toBe(false);
    expect(keepsNameByLocation("日本語の資料.pdf")).toBe(false);
    expect(keepsNameByLocation("规划.docx")).toBe(false);
    expect(keepsNameByLocation("تقرير.pdf")).toBe(false);
  });

  it("reads the node's file details with the name encoded for a name q-apps.js breaks", async () => {
    const vallot = { ...file, name: "Vallot-/8/", identifier: "qshare_file_qortal-corei-settingsjson-fail_yaGJk4", filename: "stored.pdf" };
    store.dispatch(removeDownload(vallot.identifier));
    store.dispatch(setAddToDownloads({ name: vallot.name, service: "FILE", identifier: vallot.identifier, properties: vallot }));
    store.dispatch(updateDownloads({ identifier: vallot.identifier, status: { status: "READY" } }));
    mockFetch("/arbitrary/resource/properties/", { filename: "guide.pdf", mimeType: "application/pdf", size: 200 * 1024 * 1024 });
    mockQortalAction("SAVE_FILE", true);
    renderWithProviders(<FileElement fileInfo={vallot} jsonId="qshare_file_qortal-corei-settingsjson-fail_WGvzlh_metadata" />);
    fireEvent.click(screen.getByRole("button", { name: "Save stored.pdf" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    expect(fetchCallsMatching("/arbitrary/resource/")).toEqual([
      "/arbitrary/resource/properties/FILE/Vallot-%2F8%2F/qshare_file_qortal-corei-settingsjson-fail_yaGJk4",
    ]);
    expect(qortalCallsFor("GET_QDN_RESOURCE_PROPERTIES")).toEqual([]);
    // Hub encodes the location itself.
    expect(qortalCallsFor("SAVE_FILE")[0]).toMatchObject({
      filename: "guide.pdf",
      mimeType: "application/pdf",
      location: { service: "FILE", name: "Vallot-/8/", identifier: vallot.identifier },
    });
    store.dispatch(removeDownload(vallot.identifier));
  });

  it("never sends Hub an empty filename", async () => {
    markReady();
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", {});
    mockQortalAction("SAVE_FILE", true);
    const unnamed = { ...file, filename: undefined };
    store.dispatch(updateDownloads({ identifier: file.identifier, properties: unnamed }));
    renderWithProviders(<FileElement fileInfo={unnamed} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save file" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    expect(qortalCallsFor("SAVE_FILE")[0].filename).toBe("qshare_file_notes_1");
  });
});
