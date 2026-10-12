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
      await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Files published"));
      expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(2);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    },
    FLOW_TIMEOUT_MS
  );
});
