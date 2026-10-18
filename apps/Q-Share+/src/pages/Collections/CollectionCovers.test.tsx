import { beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { clearMine } from "../../state/features/collectionsSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetCollectionCaches } from "../../utils/collections";
import { resetInAppHistory } from "../../hooks/useSafeBack";
import { resetOwnerAddresses } from "../../utils/recipientMarker";
import { CollectionPage } from "./CollectionPage";

// jsdom has no canvas: the cover is "made" from the picked file as it is.
vi.mock("../../utils/coverImage", () => ({
  makeCoverFile: vi.fn(async (file: File) => {
    if (file.name.endsWith(".txt")) throw new Error("not an image");
    return new File([file], "cover.webp", { type: "image/webp" });
  }),
}));

configure({ asyncUtilTimeout: 5_000 });

const ID = "qshare_collection_music_ab12cd";
const oldCover = { service: "THUMBNAIL", name: "alice", identifier: "qshare_cover_old00001" };
const stored = () => ({
  version: 1,
  title: "Music",
  description: "",
  items: [],
  created: 1,
  updated: 2,
  cover: oldCover,
  folders: [{ id: "live01", title: "Live", description: "", items: [], folders: [] }],
});

function renderPage(path = `/collection/alice/${ID}`) {
  return renderWithProviders(
    <Routes>
      <Route path="/collection/:name/:id" element={<CollectionPage />} />
      <Route path="/collection/:name/:id/folder/:folderId" element={<CollectionPage />} />
    </Routes>,
    { initialEntries: [path] }
  );
}

const image = () => new File([new Uint8Array([1, 2, 3, 4])], "photo.jpg", { type: "image/jpeg" });

describe("covers", { timeout: 20_000 }, () => {
  beforeEach(() => {
    resetInAppHistory();
    resetQdnSearchCache();
    resetCollectionCaches();
    resetOwnerAddresses();
    store.dispatch(clearMine());
    store.dispatch(addUser({ address: "Qabc", publicKey: "k", name: "alice", names: [{ name: "alice", owner: "Qabc" }] }));
    mockFetch("/names/", { error: 401 });
    mockQortalAction("FETCH_QDN_RESOURCE", stored());
    mockQortalAction("PUBLISH_QDN_RESOURCE", true);
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", true);
    URL.createObjectURL = vi.fn(() => "blob:cover-preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("shows the collection's cover, and publishes a new one with the collection in one request", async () => {
    const { container } = renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Music" })).toBeInTheDocument();
    expect(container.querySelector(`img[src="/arbitrary/THUMBNAIL/alice/${oldCover.identifier}?async=true"]`)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Edit collection" }));
    expect(dialog.getByRole("button", { name: "Change image for the cover" })).toBeInTheDocument();
    fireEvent.change(dialog.getByTestId("cover-input"), { target: { files: [image()] } });
    await waitFor(() => expect(document.querySelector('img[src="blob:cover-preview"]')).not.toBeNull());
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1));
    expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(0);
    const [thumb, doc] = (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(thumb).toMatchObject({ service: "THUMBNAIL", name: "alice", filename: "cover.webp", tag1: "qshare_cover_" });
    expect(thumb.identifier).toMatch(/^qshare_cover_[a-z0-9]{8}$/);
    expect(thumb.file.type).toBe("image/webp");
    const body = JSON.parse(atob(doc.data64));
    expect(body.cover).toEqual({ service: "THUMBNAIL", name: "alice", identifier: thumb.identifier });
    // The folders are untouched.
    expect(body.folders).toEqual(stored().folders);
  });

  it("removes a cover with a plain republish", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Edit collection" }));
    fireEvent.click(dialog.getByRole("button", { name: "Remove cover" }));
    expect(dialog.getByRole("button", { name: "Choose image for the cover" })).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
    const body = JSON.parse(atob(String(qortalCallsFor("PUBLISH_QDN_RESOURCE")[0].data64)));
    expect(body.cover).toBeUndefined();
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(0);
  });

  it("gives a folder its own cover", async () => {
    renderPage(`/collection/alice/${ID}/folder/live01`);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Edit folder" }));
    fireEvent.change(dialog.getByTestId("cover-input"), { target: { files: [new File(["x"], "notes.txt")] } });
    expect(await dialog.findByText(/Couldn't use that image/)).toBeInTheDocument();
    fireEvent.change(dialog.getByTestId("cover-input"), { target: { files: [image()] } });
    await waitFor(() => expect(dialog.getByRole("button", { name: "Change image for the cover" })).toBeInTheDocument());
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1));
    const [thumb, doc] = (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    const body = JSON.parse(atob(doc.data64));
    expect(body.folders[0].cover).toEqual({ service: "THUMBNAIL", name: "alice", identifier: thumb.identifier });
    // The collection's own cover stays.
    expect(body.cover).toEqual(oldCover);
  });

  it("says the collection is saved when only its new cover failed, and not saved when the collection did", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      throw { error: { unsuccessfulPublishes: [{ identifier: params.resources[0].identifier }] }, message: "x" };
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    let dialog = within(await screen.findByRole("dialog", { name: "Edit collection" }));
    fireEvent.change(dialog.getByRole("textbox", { name: /title/i }), { target: { value: "Music 2" } });
    fireEvent.change(dialog.getByTestId("cover-input"), { target: { files: [image()] } });
    await waitFor(() => expect(dialog.getByRole("button", { name: "Change image for the cover" })).toBeInTheDocument());
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit collection" })).not.toBeInTheDocument());
    expect(store.getState().notifications.alertTypes.alertInfo).toBe(
      "Saved, but the cover image wasn't published. Choose it again in Edit."
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Music 2" })).toBeInTheDocument();

    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params: any) => {
      throw { error: { unsuccessfulPublishes: [{ identifier: params.resources[1].identifier }] }, message: "x" };
    });
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    dialog = within(await screen.findByRole("dialog", { name: "Edit collection" }));
    fireEvent.change(dialog.getByTestId("cover-input"), { target: { files: [image()] } });
    await waitFor(() => expect(dialog.getByRole("button", { name: "Change image for the cover" })).toBeInTheDocument());
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    expect(await dialog.findByText("The collection was not saved.")).toBeInTheDocument();
  });
});
