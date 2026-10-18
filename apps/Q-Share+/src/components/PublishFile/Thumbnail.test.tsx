import { beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setEditFile } from "../../state/features/fileSlice";
import { resetPublishUnitFee } from "../../utils/publishBatches";
import { EditFile } from "../EditFile/EditFile";
import { PublishFile } from "./PublishFile";

// jsdom has no canvas: a "thumbnail" names what it was made from.
vi.mock("../../utils/thumbnailImage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/thumbnailImage")>();
  const made = async (blob: Blob) => new File([`thumb of ${(blob as File).name ?? "blob"} ${blob.size}`], "thumbnail.webp", { type: "image/webp" });
  return { ...actual, makeThumbnail: vi.fn(made), makeImageThumbnail: vi.fn(made) };
});
vi.mock("../common/TextEditor/TextEditor", async () => {
  const React = await import("react");
  return {
    TextEditor: (props: { inlineContent: string; setInlineContent: (v: string) => void }) =>
      React.createElement("textarea", {
        "aria-label": "Description",
        value: props.inlineContent,
        onChange: (e: { target: { value: string } }) => props.setInlineContent(e.target.value),
      }),
  };
});

configure({ asyncUtilTimeout: 5_000 });

const user = { address: "Qalice", publicKey: "pk", name: "alice", names: [{ name: "alice", owner: "Qalice" }] };
const photo = () => new File([new Uint8Array(500)], "photo.png", { type: "image/png" });
const sent = () => (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").at(-1) as any).resources;
const details = () => JSON.parse(atob(sent().find((r: any) => r.service === "DOCUMENT").data64));

async function fillAndPublish() {
  const before = qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length;
  fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "Holiday" } });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /^category/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Image" }));
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "<p>Pics</p>" } });
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(before + 1));
}

beforeEach(() => {
  store.dispatch(addUser(user));
  resetPublishUnitFee();
  mockFetch("/transactions/unitfee", "1000000");
  URL.createObjectURL = vi.fn(() => "blob:thumb");
  URL.revokeObjectURL = vi.fn();
  mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", true);
});

describe("share thumbnails", { timeout: 20_000 }, () => {
  it("makes one from the first image, counts it, and publishes it before the details", async () => {
    renderWithProviders(<PublishFile />);
    fireEvent.click(screen.getByRole("button", { name: "Share files" }));
    await screen.findByRole("dialog", { name: "Share files" });
    fireEvent.change(screen.getByTestId("share-file-input"), { target: { files: [photo()] } });
    const picker = within(await screen.findByRole("group", { name: "Thumbnail" }));
    expect(await picker.findByText("Made from photo.png.")).toBeInTheDocument();
    expect(await screen.findByText("3 publishes, 0.03 QORT in fees")).toBeInTheDocument();

    await fillAndPublish();
    expect(sent().map((r: any) => r.service)).toEqual(["FILE", "THUMBNAIL", "DOCUMENT"]);
    const thumb = sent()[1];
    expect(thumb).toMatchObject({ name: "alice", tag1: "qshare_thumb_", filename: "thumbnail.webp" });
    expect(await thumb.file.text()).toBe("thumb of photo.png 500");
    expect(details().thumbnail).toEqual({ service: "THUMBNAIL", name: "alice", identifier: thumb.identifier });
  });

  it("publishes none once removed, and a chosen image instead of the automatic one", async () => {
    const { unmount } = renderWithProviders(<PublishFile />);
    fireEvent.click(screen.getByRole("button", { name: "Share files" }));
    await screen.findByRole("dialog", { name: "Share files" });
    fireEvent.change(screen.getByTestId("share-file-input"), { target: { files: [photo()] } });
    fireEvent.click(await screen.findByRole("button", { name: "Remove thumbnail" }));
    expect(screen.getByText("None: the category icon shows.")).toBeInTheDocument();
    expect(await screen.findByText("2 publishes, 0.02 QORT in fees")).toBeInTheDocument();
    await fillAndPublish();
    expect(sent().map((r: any) => r.service)).toEqual(["FILE", "DOCUMENT"]);
    expect(details().thumbnail).toBeUndefined();
    unmount();

    renderWithProviders(<PublishFile />);
    fireEvent.click(screen.getByRole("button", { name: "Share files" }));
    await screen.findByRole("dialog", { name: "Share files" });
    fireEvent.change(screen.getByTestId("share-file-input"), {
      target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });
    // Nothing to make one from: the category icon, until an image is chosen.
    expect(await screen.findByText("None: the category icon shows.")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("thumbnail-input"), {
      target: { files: [new File([new Uint8Array(7)], "cover.jpg", { type: "image/jpeg" })] },
    });
    expect(await screen.findByText("Your image.")).toBeInTheDocument();
    await fillAndPublish();
    const thumb = sent().find((r: any) => r.service === "THUMBNAIL");
    expect(await thumb.file.text()).toBe("thumb of cover.jpg 7");
  });

  it("keeps a share's thumbnail on an update, and makes one from an image already on QDN", async () => {
    const share = {
      id: "qshare_file_holiday_abc123_metadata",
      user: "alice",
      title: "Holiday",
      version: 1,
      commentsId: "qshare_file__cm_abc123",
      htmlDescription: "<p>Pics</p>",
      fullDescription: "Pics",
      category: "5",
      files: [{ filename: "beach.jpg", identifier: "qshare_file_holiday_f1", name: "alice", service: "FILE", mimetype: "image/jpeg", size: 9 }],
      thumbnail: { service: "THUMBNAIL", name: "alice", identifier: "qshare_thumb_holiday_old111" },
    };
    store.dispatch(setEditFile(share));
    mockFetch("/arbitrary/resources/search", []);
    const { unmount } = renderWithProviders(<EditFile />);
    expect(await screen.findByText("The share's thumbnail.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1));
    expect(sent().map((r: any) => r.service)).toEqual(["DOCUMENT"]);
    expect(details().thumbnail).toEqual(share.thumbnail);
    unmount();

    // An old share without one: "Use beach.jpg" reads the image from the node.
    store.dispatch(setEditFile({ ...share, thumbnail: undefined, id: "qshare_file_holiday_def456_metadata" }));
    mockFetch("/arbitrary/FILE/", "jpeg bytes");
    renderWithProviders(<EditFile />);
    fireEvent.click(await screen.findByRole("button", { name: "Use beach.jpg" }));
    expect(await screen.findByText("Made from beach.jpg.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(2));
    expect(sent().map((r: any) => r.service)).toEqual(["THUMBNAIL", "DOCUMENT"]);
    expect(details().thumbnail.identifier).toMatch(/^qshare_thumb_holiday_/);
  });

  it("keeps a thumbnail that landed when the share details didn't, and doesn't send it again", async () => {
    let call = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      call += 1;
      if (call > 1) return true;
      const doc = params.resources.find((r: any) => r.service === "DOCUMENT");
      throw { error: { unsuccessfulPublishes: [{ identifier: doc.identifier }] }, message: "x" };
    });
    renderWithProviders(<PublishFile />);
    fireEvent.click(screen.getByRole("button", { name: "Share files" }));
    await screen.findByRole("dialog", { name: "Share files" });
    fireEvent.change(screen.getByTestId("share-file-input"), { target: { files: [photo()] } });
    expect(await screen.findByText("Made from photo.png.")).toBeInTheDocument();
    await fillAndPublish();
    const first = sent();
    fireEvent.click(await screen.findByText("2 of 3 published").then(() => screen.getAllByRole("button", { name: "Close" }).at(-1)!));
    expect(await screen.findByText("The share's thumbnail.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(2));
    expect(sent().map((r: any) => r.service)).toEqual(["DOCUMENT"]);
    expect(details().thumbnail.identifier).toBe(first[1].identifier);
    expect(details().files[0].identifier).toBe(first[0].identifier);
  });
});
