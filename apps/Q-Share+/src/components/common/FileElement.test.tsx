import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { removeDownload, setAddToDownloads, updateDownloads } from "../../state/features/globalSlice";
import { removeNotification } from "../../state/features/notificationsSlice";
import FileElement from "./FileElement";

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

  it("stays quiet when the save prompt is declined", async () => {
    markReady();
    mockQortalAction("SAVE_FILE", () => Promise.reject("User declined to save file"));
    renderWithProviders(<FileElement fileInfo={file} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save notes.txt" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save notes.txt" })).toBeEnabled());
    expect(errorToast()).toBe("");
  });

  it("shows Hub's reason when the save fails", async () => {
    markReady();
    mockQortalAction("SAVE_FILE", () => Promise.reject("Failed to save file"));
    renderWithProviders(<FileElement fileInfo={file} jsonId="qshare_file_notes" />);
    fireEvent.click(screen.getByRole("button", { name: "Save notes.txt" }));
    await waitFor(() => expect(errorToast()).toBe("Failed to save file"));
  });
});
