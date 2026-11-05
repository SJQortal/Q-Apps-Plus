import { beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { clearMine, upsertCollection } from "../../state/features/collectionsSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetCollectionCaches } from "../../utils/collections";
import { resetInAppHistory } from "../../hooks/useSafeBack";
import { recipientMarker, resetOwnerAddresses } from "../../utils/recipientMarker";
import { resetMyCollectionsLoader } from "../../components/common/SaveToCollection/useMyCollections";
import { CollectionPage } from "./CollectionPage";

configure({ asyncUtilTimeout: 5_000 });

const SOURCE = "qshare_collection_music_ab12cd";
const DJ_ADDRESS = "Q0000000000000000000DJBADDRESS01";
const source = () => ({
  version: 1,
  title: "Music",
  description: "Mixes",
  items: [{ name: "dj b", identifier: "qshare_file_song1_aaa1_metadata" }],
  folders: [{ id: "live01", title: "Live", description: "", items: [{ name: "dj b", identifier: "qshare_file_song2_aaa2_metadata" }], folders: [] }],
  cover: { service: "THUMBNAIL" as const, name: "dj b", identifier: "qshare_cover_music001" },
  created: 1,
  updated: 2,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage(path = `/collection/dj%20b/${SOURCE}`) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/collection/:name/:id" element={<CollectionPage />} />
      </Routes>
      <Where />
    </>,
    { initialEntries: [path] }
  );
}

beforeEach(() => {
  resetInAppHistory();
  resetQdnSearchCache();
  resetCollectionCaches();
  resetOwnerAddresses();
  resetMyCollectionsLoader();
  store.dispatch(clearMine());
  store.dispatch(addUser({ address: "Qalice", publicKey: "k", name: "alice", names: [{ name: "alice", owner: "Qalice" }] }));
  mockFetch("/names/", (url: URL) => (url.pathname.endsWith("dj%20b") ? { name: "dj b", owner: DJ_ADDRESS } : { error: 401 }));
  mockFetch("/arbitrary/resources/search", []);
  mockQortalAction("PUBLISH_QDN_RESOURCE", true);
  mockQortalAction("FETCH_QDN_RESOURCE", (params) =>
    params.identifier === SOURCE ? source() : { title: String(params.identifier), files: [] }
  );
});

describe("copying a collection", { timeout: 20_000 }, () => {
  it("copies someone's collection into yours, naming where it came from, and opens the copy", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Copy to my collections" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Copy to my collections" }));
    expect(dialog.getByRole("textbox", { name: /title/i })).toHaveValue("Music");
    expect(dialog.getByText(/with its 2 shares and 1 folder/)).toBeInTheDocument();
    fireEvent.change(dialog.getByRole("textbox", { name: /title/i }), { target: { value: "My music" } });
    fireEvent.click(dialog.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
    const publish = qortalCallsFor("PUBLISH_QDN_RESOURCE")[0];
    expect(publish).toMatchObject({ name: "alice", service: "DOCUMENT", tag1: "qshare_collection_", title: "My music" });
    expect(String(publish.identifier)).toMatch(/^qshare_collection_my-music_[a-z0-9]{6}$/);
    // The source's owner is named in the markers, so their Q-Share+ finds the copy.
    expect(String(publish.description)).toContain(recipientMarker(DJ_ADDRESS));
    const body = JSON.parse(atob(String(publish.data64)));
    expect(body).toMatchObject({ title: "My music", items: source().items, folders: source().folders, cover: source().cover });
    expect(body.copiedFrom).toEqual({ name: "dj b", identifier: SOURCE, title: "Music" });

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(`/collection/alice/${publish.identifier}`));
    const credit = await screen.findByText(/Copy of/);
    expect(within(credit).getByRole("button", { name: "“Music”" })).toBeInTheDocument();
    expect(within(credit).getByRole("button", { name: "dj b" })).toBeInTheDocument();
  });

  it("offers your copy instead of a second one, and nothing on your own collections", async () => {
    store.dispatch(
      upsertCollection({
        ...source(),
        name: "alice",
        identifier: "qshare_collection_my-music_zz99yy",
        title: "My music",
        copiedFrom: { name: "dj b", identifier: SOURCE, title: "Music" },
        fetchedAt: Date.now(),
      })
    );
    const { unmount } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Open your copy" }));
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/collection\/alice\/qshare_collection_my-music_[a-z0-9]{6}$/);
    unmount();

    // Once the copies are deleted (emptied), the collection can be copied again.
    for (const held of Object.values(store.getState().collections.byKey)) {
      if (held.name === "alice" && held.copiedFrom) store.dispatch(upsertCollection({ ...held, items: [], folders: [] }));
    }
    const again = renderPage();
    expect(await screen.findByRole("button", { name: "Copy to my collections" })).toBeInTheDocument();
    again.unmount();

    store.dispatch(addUser({ address: "Qdj", publicKey: "k", name: "dj b", names: [{ name: "dj b", owner: "Qdj" }] }));
    renderPage();
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy to my collections" })).not.toBeInTheDocument();
  });

  it("opens the copy you already have when Copy is tapped before your collections have loaded", async () => {
    const MINE = "qshare_collection_old-copy_qq11rr";
    mockFetch("/arbitrary/resources/search", (url: URL) =>
      url.searchParams.get("name") === "alice" && url.searchParams.get("identifier")?.startsWith("qshare_collection_")
        ? [{ name: "alice", service: "DOCUMENT", identifier: MINE, created: 1, updated: 2, metadata: { title: "Old copy" } }]
        : []
    );
    mockQortalAction("FETCH_QDN_RESOURCE", (params) =>
      params.identifier === SOURCE
        ? source()
        : params.identifier === MINE
          ? { ...source(), title: "Old copy", copiedFrom: { name: "dj b", identifier: SOURCE, title: "Music" } }
          : { title: String(params.identifier), files: [] }
    );
    renderPage();
    // Tapped at once: your collections load a moment after the page.
    fireEvent.click(await screen.findByRole("button", { name: "Copy to my collections" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(`/collection/alice/${MINE}`));
    expect(store.getState().notifications.alertTypes.alertInfo).toBe("You already have a copy of this collection.");
    expect(screen.queryByRole("dialog", { name: "Copy to my collections" })).not.toBeInTheDocument();
    expect(qortalCallsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(0);
  });
});
