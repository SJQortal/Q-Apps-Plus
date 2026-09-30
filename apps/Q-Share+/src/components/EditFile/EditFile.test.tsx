import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { addToHashMap, setEditFile } from "../../state/features/fileSlice";
import { FileListComponentLevel } from "../../pages/Home/FileListComponentLevel";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { EditFile } from "./EditFile";

// Quill works in jsdom but is slow to load; a textarea keeps the test quick.
vi.mock("../common/TextEditor/TextEditor", async () => {
  const React = await import("react");
  return {
    TextEditor: (props: { inlineContent: string; setInlineContent: (v: string) => void; placeholder?: string }) =>
      React.createElement("textarea", {
        "aria-label": "Description",
        placeholder: props.placeholder,
        value: props.inlineContent,
        onChange: (e: { target: { value: string } }) => props.setInlineContent(e.target.value),
      }),
  };
});

// Each test drives the whole Update dialog, which takes a few seconds on a busy machine.
const FLOW_TIMEOUT_MS = 20_000;

const share = {
  id: "qshare_file_report_abcdef_metadata",
  user: "alice",
  title: "Report",
  version: 1,
  commentsId: "qshare_file__cm_abcdef",
  htmlDescription: "<p>Figures</p>",
  fullDescription: "Figures",
  category: "6",
  subcategory: "",
  subcategory2: "",
  files: [
    {
      filename: "report.pdf",
      identifier: "qshare_file_report_zzzzzz",
      name: "alice",
      service: "FILE",
      mimetype: "application/pdf",
      size: 10,
    },
  ],
};

/** The share's JSON as QDN holds it: no id or user, which come from the search. */
function bodyOf(loaded: Record<string, unknown>): Record<string, unknown> {
  const body = { ...loaded };
  delete body.id;
  delete body.user;
  return body;
}

describe("EditFile", () => {
  it("finishes the update when the share details landed but a new file did not", async () => {
    store.dispatch(addUser({ address: "Qalice", publicKey: "pk", name: "alice" }));
    store.dispatch(setEditFile(share));
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      const file = params.resources.find((r: any) => r.service === "FILE");
      throw { error: { unsuccessfulPublishes: [{ identifier: file.identifier }] }, message: "Some failed" };
    });
    const before = store.getState().file.listVersion;
    renderWithProviders(<EditFile />);

    expect(await screen.findByRole("dialog", { name: "Update share" })).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("share-file-input"), {
      target: { files: [new File(["more"], "appendix.txt", { type: "text/plain" })] },
    });
    expect(await screen.findByText("appendix.txt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);

    await waitFor(() => expect(store.getState().file.editFileProperties).toBeNull());
    expect(store.getState().file.listVersion).toBe(before + 1);
    expect((store.getState().file.hashMapFiles[share.id] as any)?.files?.length).toBe(2);
    expect(store.getState().notifications.alertTypes.alertInfo).toBe(
      "Share updated, but 1 new file is not on QDN yet. If it doesn't arrive, remove it in Edit and add it again."
    );
    // QDN could not be asked for the new version's time, so the stored copy
    // keeps the one it was loaded with: never the device clock.
    expect((store.getState().file.hashMapFiles[share.id] as any)?.updated).toBe((share as any).updated);
  }, FLOW_TIMEOUT_MS);

  it("checks an update against the node's time for the version on QDN, and stores the node's time after", async () => {
    // The node's clock is ten minutes behind the device's, and the stored
    // copy is ten seconds older than the version on QDN (an earlier update
    // this session, stamped by an older build with the device clock).
    const onQdn = Date.now() - 10 * 60_000;
    const stale = { ...share, created: onQdn - 86_400_000, updated: onQdn - 10_000 };
    store.dispatch(addUser({ address: "Qalice", publicKey: "pk", name: "alice" }));
    store.dispatch(setEditFile(stale));
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw "The request timed out";
    });
    let newest = onQdn;
    mockFetch("/arbitrary/resources/search", (url: URL) => [
      { name: "alice", service: "DOCUMENT", identifier: url.searchParams.get("identifier"), created: stale.created, updated: newest },
    ]);
    renderWithProviders(<EditFile />);

    fireEvent.change(await screen.findByRole("textbox", { name: /title/i }), { target: { value: "Report 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    // QDN still has the version from before this update, newer than the stored copy's time.
    expect(await screen.findByText("0 of 1 published")).toBeInTheDocument();
    expect(screen.getByText("Not on QDN yet", { selector: "p" })).toBeInTheDocument();
    expect(store.getState().file.editFileProperties).not.toBeNull();

    // The update lands, stamped by the node.
    newest = onQdn + 5_000;
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(store.getState().file.editFileProperties).toBeNull());
    await waitFor(() => expect((store.getState().file.hashMapFiles[share.id] as any)?.updated).toBe(newest));
    expect((store.getState().file.hashMapFiles[share.id] as any)?.title).toBe("Report 3");
  }, FLOW_TIMEOUT_MS);

  it("asks before publishing again after an unconfirmed update, also once Edit was closed and reopened", async () => {
    const guarded = { ...share, id: "qshare_file_report_guard1_metadata", updated: Date.now() - 60_000 };
    store.dispatch(addUser({ address: "Qalice", publicKey: "pk", name: "alice" }));
    store.dispatch(addToHashMap(guarded));
    store.dispatch(setEditFile(guarded));
    // Hub never answers, and QDN still has the version before this update.
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise(() => {}));
    mockFetch("/arbitrary/resources/search", (url: URL) => [
      { name: "alice", service: "DOCUMENT", identifier: url.searchParams.get("identifier"), updated: guarded.updated },
    ]);
    mockQortalAction("FETCH_QDN_RESOURCE", () => bodyOf(share));
    const nodeAsked = () =>
      qortalCallsFor("FETCH_QDN_RESOURCE").filter((call) => call.identifier === guarded.id).length;
    const before = store.getState().file.listVersion;
    renderWithProviders(<EditFile />);

    fireEvent.change(await screen.findByRole("textbox", { name: /title/i }), { target: { value: "Report 4" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    expect(await screen.findByText(/Publishing 1 resource/)).toBeInTheDocument();
    // The publishing dialog's X stops waiting; its Close then leaves the outcome open.
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(await screen.findByText("0 of 1 published")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    await waitFor(() =>
      expect(store.getState().notifications.alertTypes.alertInfo).toBe(
        "Your update may still be publishing in Hub. Check the share before you publish it again."
      )
    );
    // The node is asked for the share again (the copy stays until it answers), and lists refresh.
    await waitFor(() => expect(nodeAsked()).toBe(1));
    expect(store.getState().file.hashMapFiles[guarded.id]).toBeDefined();
    expect(store.getState().file.listVersion).toBe(before + 1);

    // The user closes Edit to check the share, then opens it again.
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Update share" })).not.toBeInTheDocument());
    act(() => {
      store.dispatch(setEditFile(guarded));
    });
    fireEvent.click(await screen.findByRole("button", { name: "Publish update" }));
    expect(await screen.findByRole("dialog", { name: "Publish again?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Publish again?" })).not.toBeInTheDocument());
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish anyway" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(2));
  }, FLOW_TIMEOUT_MS);

  it("keeps a profile row's Edit after an unconfirmed update, and shows the share the node has", async () => {
    resetQdnSearchCache();
    const id = "qshare_file_report_prof01_metadata";
    const created = Date.now() - 86_400_000;
    let updated = Date.now() - 60_000;
    store.dispatch(addUser({ address: "Qalice", publicKey: "pk", name: "alice" }));
    store.dispatch(setEditFile(null));
    // Hub never answers the update.
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise(() => {}));
    let nodeTitle = "Report";
    mockFetch("/arbitrary/resources/search", () => [
      { name: "alice", service: "DOCUMENT", identifier: id, created, updated, metadata: { title: nodeTitle } },
    ]);
    mockQortalAction("FETCH_QDN_RESOURCE", () => ({ ...bodyOf(share), title: nodeTitle }));
    const { container } = renderWithProviders(
      <>
        <Routes>
          <Route path="/channel/:name" element={<FileListComponentLevel />} />
        </Routes>
        <EditFile />
      </>,
      { initialEntries: ["/channel/alice"] }
    );

    fireEvent.click(await screen.findByRole("button", { name: "Edit share" }));
    fireEvent.change(await screen.findByRole("textbox", { name: /title/i }), { target: { value: "Report 5" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    expect(await screen.findByText(/Publishing 1 resource/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(await screen.findByText("0 of 1 published")).toBeInTheDocument();
    // Hub finishes the update after that check; the user closes the dialogs.
    nodeTitle = "Report 5";
    updated += 5_000;
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Update share" })).not.toBeInTheDocument());

    // The row was never left without its body: it shows the node's version, with Edit.
    expect(await screen.findByText("Report 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit share" })).toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(qortalCallsFor("FETCH_QDN_RESOURCE").length).toBe(2);
  }, FLOW_TIMEOUT_MS);

  it("after a timeout does not count the version it replaces, even one from a minute ago", async () => {
    // The share was updated a minute ago; this text-only update times out.
    const previous = Date.now() - 60_000;
    const recent = { ...share, created: previous - 86_400_000, updated: previous };
    store.dispatch(addUser({ address: "Qalice", publicKey: "pk", name: "alice" }));
    store.dispatch(setEditFile(recent));
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw "The request timed out";
    });
    let newest = previous;
    mockFetch("/arbitrary/resources/search", (url: URL) => [
      { name: "alice", service: "DOCUMENT", identifier: url.searchParams.get("identifier"), created: recent.created, updated: newest },
    ]);
    const before = store.getState().file.listVersion;
    renderWithProviders(<EditFile />);

    fireEvent.change(await screen.findByRole("textbox", { name: /title/i }), { target: { value: "Report 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    // Only the version it replaces is on QDN: the update is not there yet.
    expect(await screen.findByText("0 of 1 published")).toBeInTheDocument();
    expect(screen.getByText("Not on QDN yet", { selector: "p" })).toBeInTheDocument();
    expect(store.getState().file.editFileProperties).not.toBeNull();
    expect(store.getState().file.listVersion).toBe(before);

    // Once a newer version shows up, the update is done.
    newest = previous + 90_000;
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(store.getState().file.editFileProperties).toBeNull());
    expect(store.getState().file.listVersion).toBe(before + 1);
    expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Share updated");
  }, FLOW_TIMEOUT_MS);
});
