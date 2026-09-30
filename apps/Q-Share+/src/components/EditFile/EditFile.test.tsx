import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setEditFile } from "../../state/features/fileSlice";
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

describe("EditFile", () => {
  it("finishes the update when the share details landed but a new file did not", async () => {
    store.dispatch(addUser({ address: "Qalice", publicKey: "pk", name: "alice" }));
    store.dispatch(setEditFile(share));
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      const file = params.resources.find((r: any) => r.service === "FILE");
      throw { error: { unsuccessfulPublishes: [{ identifier: file.identifier }] }, message: "Some failed" };
    });
    const before = store.getState().file.listVersion;
    const startedAt = Date.now();
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
    // The stored copy carries the new version's time, for the next update's check.
    expect((store.getState().file.hashMapFiles[share.id] as any)?.updated).toBeGreaterThanOrEqual(startedAt);
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
