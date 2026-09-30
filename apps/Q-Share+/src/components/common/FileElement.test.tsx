import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { removeDownload, setAddToDownloads, updateDownloads } from "../../state/features/globalSlice";
import { removeNotification } from "../../state/features/notificationsSlice";
import FileElement, { keepsNameByLocation } from "./FileElement";

const file = { name: "alice", service: "FILE", identifier: "qshare_file_notes_1", filename: "notes.txt", mimetype: "text/plain" };

/** Put the file in the downloads list as READY, as the poller would. */
function markReady() {
  store.dispatch(setAddToDownloads({ name: file.name, service: file.service, identifier: file.identifier, properties: file }));
  store.dispatch(updateDownloads({ name: file.name, service: file.service, identifier: file.identifier, status: { status: "READY" } }));
}

const errorToast = () => store.getState().notifications.alertTypes.alertError;

describe("FileElement save", () => {
  beforeEach(() => {
    store.dispatch(removeDownload(file.identifier));
    store.dispatch(removeNotification());
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "notes.txt", mimeType: "text/plain", size: 5 });
    mockFetch("/arbitrary/FILE/alice/qshare_file_notes_1", "hello");
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
