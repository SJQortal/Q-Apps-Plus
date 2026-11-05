import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { PublishFile } from "./PublishFile";

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

const user = { address: "Qalice", publicKey: "pk", name: "alice", names: [{ name: "alice", owner: "Qalice" }] };
// Each test drives the whole Share dialog (MUI Select, two dialogs), which
// takes a few seconds on a busy machine.
const FLOW_TIMEOUT_MS = 20_000;
/** Waits in the 25-file flow, which renders a long list on every step. */
const SLOW = { timeout: 8_000 };

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Share files" }));
  return screen.findByRole("dialog", { name: "Share files" });
}

/** Fill in a one-file share and press Publish. */
async function fillAndPublish() {
  await openDialog();
  fireEvent.change(screen.getByTestId("share-file-input"), {
    target: { files: [new File(["%PDF-1.4"], "report.pdf", { type: "application/pdf" })] },
  });
  expect(await screen.findByText("report.pdf")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "Quarterly report" } });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /^category/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Document" }));
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "<p>See attached</p>" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
}

/** The publishing dialog's own Close (the share dialog behind it is hidden from the a11y tree). */
function closePublishing() {
  fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
}

/** Hub publishes the batch but fails the resource with this service. */
function failInHub(service: "DOCUMENT" | "FILE") {
  mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
    const failed = params.resources.find((r: any) => r.service === service);
    throw { error: { unsuccessfulPublishes: [{ identifier: failed.identifier }] }, message: "Some failed" };
  });
}

describe("PublishFile after a partial publish", () => {
  it(
    "keeps the draft when only the file landed",
    async () => {
      store.dispatch(addUser(user));
      failInHub("DOCUMENT");
      const before = store.getState().file.listVersion;
      renderWithProviders(<PublishFile />);

      // No share exists yet, so the draft stays for another try.
      await fillAndPublish();
      expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
      closePublishing();
      await waitFor(() => expect(screen.queryByText("1 of 2 published")).not.toBeInTheDocument());
      expect(screen.getByRole("dialog", { name: "Share files" })).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Quarterly report");
      expect(store.getState().file.listVersion).toBe(before);
      // The file is on QDN: it stays in the draft and isn't sent again.
      expect(screen.getByText(/already on QDN/)).toBeInTheDocument();
      expect(store.getState().notifications.alertTypes.alertInfo).toBe(
        "The file is on QDN and stays in the draft: publishing again sends only the share details."
      );
      const first = (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
      mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => true);
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(2));
      const second = (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[1] as any).resources;
      expect(second.map((r: any) => r.service)).toEqual(["DOCUMENT"]);
      const stored = JSON.parse(atob(second[0].data64));
      expect(stored.files.map((f: any) => f.identifier)).toEqual([first[0].identifier]);
      expect(stored.files[0]).toMatchObject({ filename: "report.pdf", name: "alice", service: "FILE", mimetype: "application/pdf" });
    },
    FLOW_TIMEOUT_MS
  );

  it(
    "after a big publish paused part-way, publishing again sends only the files not on QDN",
    async () => {
      store.dispatch(addUser(user));
      mockFetch("/transactions/unconfirmed", []);
      let call = 0;
      mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
        call += 1;
        if (call === 2) throw { error: "User declined request", message: "User declined request" };
        return true;
      });
      renderWithProviders(<PublishFile />);
      await openDialog();
      const tracks = Array.from({ length: 25 }, (_, i) => new File(["x"], `track${i + 1}.mp3`, { type: "audio/mpeg" }));
      fireEvent.change(screen.getByTestId("share-file-input"), { target: { files: tracks } });
      expect(await screen.findByText("track25.mp3", undefined, SLOW)).toBeInTheDocument();
      fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "Album" } });
      fireEvent.mouseDown(screen.getByRole("combobox", { name: /^category/i }));
      fireEvent.click(await screen.findByRole("option", { name: "Audio" }, SLOW));
      fireEvent.change(screen.getByLabelText("Description"), { target: { value: "<p>Songs</p>" } });
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));

      fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }, SLOW));
      expect(await screen.findByText("Publish paused", undefined, SLOW)).toBeInTheDocument();
      closePublishing();
      await waitFor(() => expect(screen.queryByText("Publish paused")).not.toBeInTheDocument(), SLOW);
      expect(screen.getAllByText(/already on QDN/).length).toBe(20);
      expect(store.getState().notifications.alertTypes.alertInfo).toBe(
        "20 of 25 files are on QDN and stay in the draft: publishing again sends only the rest."
      );
      const firstBatch = (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;

      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(3), SLOW);
      const last = (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").at(-1) as any).resources;
      expect(last.map((r: any) => r.filename)).toEqual([
        "track21.mp3",
        "track22.mp3",
        "track23.mp3",
        "track24.mp3",
        "track25.mp3",
        "video_metadata.json",
      ]);
      const stored = JSON.parse(atob(last.at(-1).data64));
      expect(stored.files.length).toBe(25);
      expect(stored.files.slice(0, 20).map((f: any) => f.identifier)).toEqual(firstBatch.map((r: any) => r.identifier));
    },
    FLOW_TIMEOUT_MS
  );

  it(
    "finishes when the share details landed, since publishing the draft again would duplicate the share",
    async () => {
      store.dispatch(addUser(user));
      failInHub("FILE");
      const before = store.getState().file.listVersion;
      renderWithProviders(<PublishFile />);

      await fillAndPublish();
      expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
      // The share already links to the file, so Retry is the way to complete it.
      expect(screen.getByText(/already links to this file\. Retry publishes it/)).toBeInTheDocument();
      closePublishing();
      await waitForElementToBeRemoved(() => screen.queryByRole("dialog", { name: "Share files" }));
      expect(store.getState().file.listVersion).toBe(before + 1);
      expect(store.getState().notifications.alertTypes.alertInfo).toBe(
        "Share published, but 1 file is not on QDN yet. If it doesn't arrive, remove it in Edit and add it again."
      );
      await openDialog();
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("");
    },
    FLOW_TIMEOUT_MS
  );

  it(
    "asks before publishing again when the last publish may still be finishing in Hub",
    async () => {
      store.dispatch(addUser(user));
      mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
        throw "The request timed out";
      });
      // Nothing on QDN yet: Hub may still be publishing it.
      mockFetch("/arbitrary/resources/search", []);
      renderWithProviders(<PublishFile />);

      await fillAndPublish();
      expect(await screen.findByText("0 of 2 published")).toBeInTheDocument();
      closePublishing();
      await waitFor(() => expect(screen.queryByText("0 of 2 published")).not.toBeInTheDocument());
      expect(store.getState().notifications.alertTypes.alertInfo).toMatch(/may still be publishing in Hub/);
      expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Quarterly report");

      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      expect(await screen.findByRole("dialog", { name: "Publish again?" })).toBeInTheDocument();
      expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1);
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Publish again?" })).not.toBeInTheDocument());
      expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1);

      mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => true);
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
      fireEvent.click(await screen.findByRole("button", { name: "Publish anyway" }));
      await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(2));
      expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Files published");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    },
    FLOW_TIMEOUT_MS
  );
});
