import { beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { clearMine } from "../../state/features/collectionsSlice";
import { collectionKey } from "../../utils/collections";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetCollectionCaches } from "../../utils/collections";
import { addToHashMap } from "../../state/features/fileSlice";
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

const DOCS = "qshare_collection_docs_dd3333";
const share = (n: number) => ({ name: "bob", identifier: `qshare_file_s${n}_aa${n}000_metadata` });
const docs = () => ({ version: 1, title: "Docs", description: "", items: [share(1), share(2)], created: 1, updated: 2 });
const held = () => store.getState().collections.byKey[collectionKey("alice", DOCS)];

/** A Hub publish that answers when the test says. */
function heldPublish() {
  const answer: { done?: (ok: boolean | Error) => void } = {};
  mockQortalAction("PUBLISH_QDN_RESOURCE", () => new Promise((resolve, reject) => {
    answer.done = (ok) => (ok === true ? resolve(true) : reject(ok));
  }));
  return answer;
}

function renderDocs() {
  mockQortalAction("FETCH_QDN_RESOURCE", (params) =>
    params.identifier === DOCS ? docs() : { title: `Share ${String(params.identifier).match(/_s(\d)_/)?.[1]}`, files: [] }
  );
  for (const n of [1, 2]) {
    store.dispatch(addToHashMap({ id: share(n).identifier, user: "bob", title: `Share ${n}`, version: 1, commentsId: "c", category: "1", files: [], created: 1 }));
  }
  return renderWithProviders(
    <Routes>
      <Route path="/collection/:name/:id" element={<CollectionPage />} />
      <Route path="/collections" element={<p>Collections list</p>} />
    </Routes>,
    { initialEntries: [`/collection/alice/${DOCS}`] }
  );
}

async function confirm(open: string, button: string) {
  fireEvent.click(await screen.findByRole("button", { name: open }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: button }));
}

describe("changes on a collection page show at once", { timeout: 20_000 }, () => {
  it("Delete leaves for your collections before Hub answers, and the collection is gone from them", async () => {
    const hub = heldPublish();
    renderDocs();
    await screen.findByRole("heading", { name: "Docs" });
    await confirm("Delete", "Delete");
    // Hub hasn't answered: already on Collections, and the collection counts as deleted.
    expect(await screen.findByText("Collections list")).toBeInTheDocument();
    expect(held()?.deleted).toBe(true);
    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    hub.done?.(true);
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Collection deleted"));
    const stored = JSON.parse(atob(String(qortalCallsFor("PUBLISH_QDN_RESOURCE")[0].data64)));
    expect(stored).toMatchObject({ title: "Docs", items: [], deleted: true });
    expect(stored).not.toHaveProperty("folders");
  });

  it("puts a deleted collection back when Hub says no, and says so", async () => {
    const hub = heldPublish();
    renderDocs();
    await screen.findByRole("heading", { name: "Docs" });
    await confirm("Delete", "Delete");
    expect(await screen.findByText("Collections list")).toBeInTheDocument();
    await waitFor(() => expect(hub.done).toBeDefined());
    hub.done?.(Object.assign(new Error("User declined request"), { error: "User declined request" }));
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertInfo).toBe("“Docs” wasn't deleted."));
    expect(held()?.deleted).toBeUndefined();
    expect(held()?.items).toHaveLength(2);
  });

  it("Remove takes the share off at once, and brings it back if the publish fails", async () => {
    const hub = heldPublish();
    renderDocs();
    await screen.findByText("Share 1");
    await confirm("Remove Share 1 from collection", "Remove");
    // The dialog is gone and so is the share, while Hub asks.
    await waitFor(() => expect(screen.queryByText("Share 1")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Share 2")).toBeInTheDocument();
    // One change at a time: another Remove waits for this one.
    fireEvent.click(screen.getByRole("button", { name: "Remove Share 2 from collection" }));
    expect(within(await screen.findByRole("dialog")).getByRole("button", { name: "Publishing…" })).toBeDisabled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(hub.done).toBeDefined());
    hub.done?.(new Error("Network error"));
    expect(await screen.findByText("Share 1")).toBeInTheDocument();
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertError).toBe("Could not update Docs"));
    expect(held()?.items).toHaveLength(2);
  });
});

