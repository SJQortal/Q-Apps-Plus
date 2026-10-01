import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { OPEN_PUBLISH_EVENT } from "../../constants/events";
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

function signIn() {
  store.dispatch(addUser(user));
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Share files" }));
  return screen.findByRole("dialog", { name: "Share files" });
}

function addFile(file: File) {
  const input = screen.getByTestId("share-file-input");
  fireEvent.change(input, { target: { files: [file] } });
}

async function chooseCategory(name: string) {
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /^category/i }));
  fireEvent.click(await screen.findByRole("option", { name }));
}

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("PublishFile", { timeout: 15_000 }, () => {
  it("publishes one FILE and one DOCUMENT in the original format and bumps the list version", async () => {
    signIn();
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => true);
    const before = store.getState().file.listVersion;
    renderWithProviders(<PublishFile />);

    await openDialog();
    const pdf = new File(["%PDF-1.4 hello"], "report.pdf", { type: "application/pdf" });
    addFile(pdf);
    expect(await screen.findByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText(/1 file · /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove report.pdf" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "Quarterly report" } });
    await chooseCategory("Document");
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: '<ol><li data-list="bullet">Figures</li></ol><p>See attached</p>' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1));
    expect(globalThis.qortalRequestWithTimeout).toHaveBeenCalledTimes(1);
    const request = qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    expect(request.resources.map((r: any) => r.service)).toEqual(["FILE", "DOCUMENT"]);

    const [fileRes, docRes] = request.resources;
    expect(fileRes).toMatchObject({
      action: "PUBLISH_QDN_RESOURCE",
      name: "alice",
      service: "FILE",
      file: pdf,
      title: "Quarterly report",
      description: "**cat:6**Figures See attached",
      filename: "report.pdf",
      tag1: "qshare_file_",
    });
    expect(fileRes.identifier).toMatch(/^qshare_file_quarterly-report_[A-Za-z0-9]{6}$/);
    expect(docRes).toMatchObject({
      action: "PUBLISH_QDN_RESOURCE",
      name: "alice",
      service: "DOCUMENT",
      title: "Quarterly report",
      description: "**cat:6**Figures See attached",
      tag1: "qshare_file_",
      filename: "video_metadata.json",
    });
    expect(docRes.identifier).toMatch(/^qshare_file_quarterly-report_[A-Za-z0-9]{6}_metadata$/);
    const stored = JSON.parse(atob(docRes.data64));
    expect(stored).toMatchObject({
      title: "Quarterly report",
      version: 1,
      fullDescription: "Figures See attached",
      htmlDescription: "<ul><li>Figures</li></ul><p>See attached</p>",
      category: "6",
      subcategory: "",
      subcategory2: "",
    });
    expect(stored.commentsId).toBe(`qshare_file__cm_${docRes.identifier.slice(-15, -9)}`);
    expect(stored.files).toEqual([
      { filename: "report.pdf", identifier: fileRes.identifier, name: "alice", service: "FILE", mimetype: "application/pdf", size: pdf.size },
    ]);

    await waitFor(() => expect(store.getState().file.listVersion).toBe(before + 1));
    expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Files published");
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog", { name: "Share files" }));
  });

  it("shows what is missing inline and does not publish", async () => {
    signIn();
    renderWithProviders(<PublishFile />);
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Add at least one file.");
    expect(alert).toHaveTextContent("Enter a title.");
    expect(alert).toHaveTextContent("Choose a category.");
    expect(alert).toHaveTextContent("Enter a description.");
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(0);
  });

  it("keeps the draft when the dialog is closed and reopened, and skips duplicate files", async () => {
    signIn();
    renderWithProviders(<PublishFile />);
    await openDialog();
    const file = new File(["abc"], "notes.txt", { type: "text/plain" });
    addFile(file);
    expect(await screen.findByText("notes.txt")).toBeInTheDocument();
    addFile(new File(["abc"], "notes.txt", { type: "text/plain" }));
    expect(await screen.findByText("notes.txt is already in the list.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Remove /i }).length).toBe(1);
    fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "Draft title" } });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog", { name: "Share files" }));

    await openDialog();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /title/i })).toHaveValue("Draft title");
  });

  it("opens when the shell dispatches OPEN_PUBLISH_EVENT", async () => {
    signIn();
    renderWithProviders(<PublishFile />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    window.dispatchEvent(new CustomEvent(OPEN_PUBLISH_EVENT));
    expect(await screen.findByRole("dialog", { name: "Share files" })).toBeInTheDocument();
  });

  it("renders an icon-only trigger on phones", () => {
    signIn();
    window.matchMedia = ((query: string) => ({
      matches: query.includes("599.95"),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    })) as typeof window.matchMedia;
    renderWithProviders(<PublishFile />);
    const trigger = screen.getByRole("button", { name: "Share files" });
    expect(trigger).not.toHaveTextContent("Share");
  });
});
