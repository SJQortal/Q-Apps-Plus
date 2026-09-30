import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { removeDownload, setAddToDownloads, updateDownloads } from "../../state/features/globalSlice";
import { removeNotification } from "../../state/features/notificationsSlice";
import { DownloadTaskManager } from "./DownloadTaskManager";

const file = { name: "alice", service: "FILE", identifier: "qshare_file_notes_1", filename: "notes.txt", mimetype: "text/plain", jsonId: "qshare_file_notes" };

function addDownload(status: Record<string, unknown>) {
  store.dispatch(setAddToDownloads({ name: file.name, service: file.service, identifier: file.identifier, properties: file }));
  store.dispatch(updateDownloads({ name: file.name, service: file.service, identifier: file.identifier, status }));
}

describe("DownloadTaskManager", () => {
  beforeEach(() => {
    store.dispatch(removeDownload(file.identifier));
    store.dispatch(removeNotification());
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "notes.txt", mimeType: "text/plain", size: 5 });
    mockFetch("/arbitrary/FILE/alice/qshare_file_notes_1", "hello");
  });

  it("stays quiet when Hub's save prompt is declined", async () => {
    addDownload({ status: "READY" });
    mockQortalAction("SAVE_FILE", () => Promise.reject("User declined to save file"));
    renderWithProviders(<DownloadTaskManager />);
    fireEvent.click(screen.getByRole("button", { name: /^downloads/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Save notes.txt" }));
    await waitFor(() => expect(qortalCallsFor("SAVE_FILE").length).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save notes.txt" })).toBeEnabled());
    expect(store.getState().notifications.alertTypes.alertError).toBe("");
  });

  it("puts a finished row's actions beside its text, with no progress bar", async () => {
    addDownload({ status: "READY" });
    renderWithProviders(<DownloadTaskManager />);
    fireEvent.click(screen.getByRole("button", { name: /^downloads/i }));
    const row = await screen.findByRole("button", { name: "notes.txt: Ready to save" });
    expect(within(row).queryByRole("progressbar")).toBeNull();
    // Not MUI's secondaryAction, whose fixed padding let Save cover the bar.
    expect(document.querySelector(".MuiListItemSecondaryAction-root")).toBeNull();
    const item = row.closest("li") as HTMLElement;
    expect(within(item).getByRole("button", { name: "Save notes.txt" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Remove notes.txt from the list" })).toBeInTheDocument();
  });

  it("shows progress, and no actions, while a file is arriving", async () => {
    addDownload({ status: "DOWNLOADING", percentLoaded: 40 });
    renderWithProviders(<DownloadTaskManager />);
    fireEvent.click(screen.getByRole("button", { name: /^downloads/i }));
    const row = await screen.findByRole("button", { name: "notes.txt: Fetching from peers… 40%" });
    expect(within(row).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    expect(screen.queryByRole("button", { name: "Save notes.txt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove notes.txt from the list" })).toBeNull();
  });
});
