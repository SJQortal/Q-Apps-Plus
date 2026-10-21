import { beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { clearMine } from "../../state/features/collectionsSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetCollectionCaches } from "../../utils/collections";
import { resetInAppHistory } from "../../hooks/useSafeBack";
import { SaveToCollectionButton } from "../../components/common/SaveToCollection/SaveToCollectionButton";
import { resetMyCollectionsLoader } from "../../components/common/SaveToCollection/useMyCollections";
import { CollectionPage } from "./CollectionPage";
import { CollectionsPage } from "./CollectionsPage";

configure({ asyncUtilTimeout: 5_000 });

const NEW = "qshare_collection_new-one_nn1111";
const GONE = "qshare_collection_old-one_gg2222";
const row = (identifier: string, title: string) => ({
  name: "alice",
  service: "DOCUMENT",
  identifier,
  updated: 10,
  metadata: { title, description: "" },
});
const bodies: Record<string, unknown> = {
  // Made a moment ago, nothing in it yet: still a collection.
  [NEW]: { version: 1, title: "New one", description: "", items: [], created: 1, updated: 1 },
  [GONE]: { version: 1, title: "Old one", description: "", items: [], created: 1, updated: 2, deleted: true },
};

beforeEach(() => {
  resetInAppHistory();
  resetQdnSearchCache();
  resetCollectionCaches();
  resetMyCollectionsLoader();
  store.dispatch(clearMine());
  store.dispatch(addUser({ address: "Qalice", publicKey: "k", name: "alice", names: [{ name: "alice", owner: "Qalice" }] }));
  mockFetch("/names/", { error: 401 });
  mockFetch("/arbitrary/resources/search", [row(NEW, "New one"), row(GONE, "Old one")]);
  mockQortalAction("FETCH_QDN_RESOURCE", (params) => bodies[String(params.identifier)] ?? null);
});

describe("deleted collections", { timeout: 20_000 }, () => {
  it("leave your Collections list, while an empty new one stays", async () => {
    renderWithProviders(<CollectionsPage />, { initialEntries: ["/collections"] });
    expect(await screen.findByRole("button", { name: "Open New one" })).toBeInTheDocument();
    await waitFor(() => expect(qortalCallsFor("FETCH_QDN_RESOURCE").length).toBe(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Open Old one" })).not.toBeInTheDocument());
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("are no place to save a share", async () => {
    renderWithProviders(<SaveToCollectionButton share={{ name: "bob", identifier: "qshare_file_x_y1_metadata", title: "X" }} />);
    await waitFor(() => expect(qortalCallsFor("FETCH_QDN_RESOURCE").length).toBe(2), { timeout: 4000 });
    fireEvent.click(screen.getByRole("button", { name: "Add to collection" }));
    const rows = await screen.findAllByRole("menuitemcheckbox");
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual(["New one"]);
  });

  it("say so when opened by a link", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/collection/:name/:id" element={<CollectionPage />} />
      </Routes>,
      { initialEntries: [`/collection/alice/${GONE}`] }
    );
    expect(await screen.findByText("Old one was deleted")).toBeInTheDocument();
    expect(screen.getByText(/The shares that were in it are still on QDN/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
