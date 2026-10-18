import { beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setEditFile } from "../../state/features/fileSlice";
import { resetPublishUnitFee } from "../../utils/publishBatches";
import { EditFile } from "../EditFile/EditFile";
import { ImageTooBigError } from "../../utils/coverImage";
import { makeImageThumbnail, makeThumbnail } from "../../utils/thumbnailImage";
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

async function fill() {
  fireEvent.change(screen.getByRole("textbox", { name: /title/i }), { target: { value: "Holiday" } });
  fireEvent.mouseDown(screen.getByRole("combobox", { name: /^category/i }));
  fireEvent.click(await screen.findByRole("option", { name: "Image" }));
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "<p>Pics</p>" } });
}

async function fillAndPublish() {
  const before = qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length;
  await fill();
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(before + 1));
}

beforeEach(() => {
  vi.mocked(makeThumbnail).mockClear();
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

  it("publishes once on a double tap, with the thumbnail that was being made", async () => {
    let finish!: (file: File) => void;
    vi.mocked(makeThumbnail).mockImplementationOnce(() => new Promise<File>((resolve) => (finish = resolve)));
    renderWithProviders(<PublishFile />);
    fireEvent.click(screen.getByRole("button", { name: "Share files" }));
    await screen.findByRole("dialog", { name: "Share files" });
    fireEvent.change(screen.getByTestId("share-file-input"), { target: { files: [photo()] } });
    expect(await screen.findByText("Making one from photo.png…")).toBeInTheDocument();
    await fill();
    const before = qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length;
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled());
    finish(new File(["slow thumb"], "thumbnail.webp", { type: "image/webp" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(before + 1));
    await new Promise((r) => setTimeout(r, 50));
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(before + 1);
    // The thumbnail being made was waited for, not made a second time.
    expect(makeThumbnail).toHaveBeenCalledTimes(1);
    expect(await sent().find((r: any) => r.service === "THUMBNAIL").file.text()).toBe("slow thumb");
  });

  it("leaves out a thumbnail that couldn't be made, as the form says", async () => {
    vi.mocked(makeThumbnail).mockRejectedValueOnce(new Error("No frame in time"));
    renderWithProviders(<PublishFile />);
    fireEvent.click(screen.getByRole("button", { name: "Share files" }));
    await screen.findByRole("dialog", { name: "Share files" });
    fireEvent.change(screen.getByTestId("share-file-input"), { target: { files: [photo()] } });
    expect(await screen.findByText("None: the category icon shows.")).toBeInTheDocument();
    expect(await screen.findByText("2 publishes, 0.02 QORT in fees")).toBeInTheDocument();
    await fillAndPublish();
    expect(sent().map((r: any) => r.service)).toEqual(["FILE", "DOCUMENT"]);
    expect(makeThumbnail).toHaveBeenCalledTimes(1);
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
    // While a picked image is made into one, the picker says so (read out as a status).
    let finish!: (file: File) => void;
    vi.mocked(makeImageThumbnail).mockImplementationOnce(() => new Promise<File>((resolve) => (finish = resolve)));
    fireEvent.change(screen.getByTestId("thumbnail-input"), {
      target: { files: [new File([new Uint8Array(3)], "slow.jpg", { type: "image/jpeg" })] },
    });
    const picker = within(screen.getByRole("group", { name: "Thumbnail" }));
    expect(await picker.findByRole("status")).toHaveTextContent("Making a thumbnail…");
    finish(new File(["thumb of cover.jpg 7"], "thumbnail.webp", { type: "image/webp" }));
    expect(await picker.findByRole("status")).toHaveTextContent("Your image.");
    // A photo too big to decode on a phone says so, and the choice stays.
    vi.mocked(makeImageThumbnail).mockRejectedValueOnce(new ImageTooBigError());
    fireEvent.change(screen.getByTestId("thumbnail-input"), {
      target: { files: [new File([new Uint8Array(9)], "huge.jpg", { type: "image/jpeg" })] },
    });
    expect(await screen.findByText(/too big to make a thumbnail from on this device/)).toBeInTheDocument();
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
    mockFetch("/arbitrary/resource/status/", { status: "READY" });
    mockFetch("/arbitrary/FILE/", "jpeg bytes");
    renderWithProviders(<EditFile />);
    fireEvent.click(await screen.findByRole("button", { name: "Use beach.jpg" }));
    expect(await screen.findByText("Made from beach.jpg.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(2));
    expect(sent().map((r: any) => r.service)).toEqual(["THUMBNAIL", "DOCUMENT"]);
    expect(details().thumbnail.identifier).toMatch(/^qshare_thumb_holiday_/);
  });

  it("keeps the same thumbnail when only its image landed, and sends just the rest", async () => {
    let call = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      call += 1;
      if (call > 1) return true;
      const failed = params.resources.filter((r: any) => r.service !== "FILE").map((r: any) => ({ identifier: r.identifier }));
      throw { error: { unsuccessfulPublishes: failed }, message: "x" };
    });
    renderWithProviders(<PublishFile />);
    fireEvent.click(screen.getByRole("button", { name: "Share files" }));
    await screen.findByRole("dialog", { name: "Share files" });
    fireEvent.change(screen.getByTestId("share-file-input"), { target: { files: [photo()] } });
    expect(await screen.findByText("Made from photo.png.")).toBeInTheDocument();
    await fillAndPublish();
    const first = sent();
    fireEvent.click(await screen.findByText("1 of 3 published").then(() => screen.getAllByRole("button", { name: "Close" }).at(-1)!));
    // photo.png is on QDN now, so it is no longer a new file to make one from: the picture stays.
    expect(await screen.findByText("Made from photo.png.")).toBeInTheDocument();
    expect(await screen.findByText(/2 publishes/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(2));
    expect(sent().map((r: any) => r.service)).toEqual(["THUMBNAIL", "DOCUMENT"]);
    expect(await sent()[0].file.text()).toBe(await first[1].file.text());
    expect(details().files[0].identifier).toBe(first[0].identifier);
  });

  it("says so when the share landed and its thumbnail didn't", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      const thumb = params.resources.find((r: any) => r.service === "THUMBNAIL");
      throw { error: { unsuccessfulPublishes: [{ identifier: thumb.identifier }] }, message: "x" };
    });
    renderWithProviders(<PublishFile />);
    fireEvent.click(screen.getByRole("button", { name: "Share files" }));
    await screen.findByRole("dialog", { name: "Share files" });
    fireEvent.change(screen.getByTestId("share-file-input"), { target: { files: [photo()] } });
    expect(await screen.findByText("Made from photo.png.")).toBeInTheDocument();
    await fillAndPublish();
    fireEvent.click(await screen.findByText("2 of 3 published").then(() => screen.getAllByRole("button", { name: "Close" }).at(-1)!));
    await waitFor(() =>
      expect(store.getState().notifications.alertTypes.alertInfo).toBe(
        "Share published, but its thumbnail is not on QDN. Choose it again in Edit."
      )
    );
  });

  it("reads a share's image for a thumbnail only once the node has it, and never a big one", async () => {
    store.dispatch(
      setEditFile({
        id: "qshare_file_holiday_jkl012_metadata",
        user: "alice",
        title: "Holiday",
        version: 1,
        commentsId: "qshare_file__cm_jkl012",
        htmlDescription: "<p>Pics</p>",
        fullDescription: "Pics",
        category: "5",
        files: [
          { filename: "panorama.tif", identifier: "qshare_file_holiday_big", name: "alice", service: "FILE", mimetype: "image/tiff", size: 90_000_000 },
          { filename: "beach.jpg", identifier: "qshare_file_holiday_far", name: "alice", service: "FILE", mimetype: "image/jpeg", size: 9 },
        ],
      })
    );
    mockFetch("/arbitrary/resources/search", []);
    mockFetch("/arbitrary/resource/status/", { status: "PUBLISHED" });
    renderWithProviders(<EditFile />);
    // The 90 MB image isn't offered.
    fireEvent.click(await screen.findByRole("button", { name: "Use beach.jpg" }));
    expect(screen.queryByRole("button", { name: "Use panorama.tif" })).not.toBeInTheDocument();
    expect(await screen.findByText("Your node doesn't have beach.jpg yet. Open the share and fetch it, or choose an image.")).toBeInTheDocument();
    expect(fetchCallsMatching("/arbitrary/FILE/")).toEqual([]);
  });

  it("says so when an update landed and its new thumbnail didn't", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      const thumb = params.resources.find((r: any) => r.service === "THUMBNAIL");
      throw { error: { unsuccessfulPublishes: [{ identifier: thumb.identifier }] }, message: "x" };
    });
    store.dispatch(
      setEditFile({
        id: "qshare_file_holiday_ghi789_metadata",
        user: "alice",
        title: "Holiday",
        version: 1,
        commentsId: "qshare_file__cm_ghi789",
        htmlDescription: "<p>Pics</p>",
        fullDescription: "Pics",
        category: "5",
        files: [{ filename: "beach.jpg", identifier: "qshare_file_holiday_f9", name: "alice", service: "FILE", mimetype: "image/jpeg", size: 9 }],
      })
    );
    mockFetch("/arbitrary/resources/search", []);
    mockFetch("/arbitrary/resource/status/", { status: "READY" });
    mockFetch("/arbitrary/FILE/", "jpeg bytes");
    renderWithProviders(<EditFile />);
    fireEvent.click(await screen.findByRole("button", { name: "Use beach.jpg" }));
    expect(await screen.findByText("Made from beach.jpg.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish update" }));
    fireEvent.click(await screen.findByText("1 of 2 published").then(() => screen.getAllByRole("button", { name: "Close" }).at(-1)!));
    await waitFor(() =>
      expect(store.getState().notifications.alertTypes.alertInfo).toBe(
        "Share updated, but its new thumbnail is not on QDN. Choose it again in Edit."
      )
    );
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
