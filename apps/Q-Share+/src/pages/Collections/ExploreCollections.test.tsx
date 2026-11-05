import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction } from "../../test/setup";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { clearMine } from "../../state/features/collectionsSlice";
import { resetQdnSearchCache } from "../../utils/qdnSearch";
import { resetCollectionCaches } from "../../utils/collections";
import { resetMyCollectionsLoader } from "../../components/common/SaveToCollection/useMyCollections";
import { resetSettingsCache, writeSettings } from "../../utils/settings";
import ExploreCollectionsDialog, { EXPLORE_SEARCH_DELAY_MS } from "./ExploreCollectionsDialog";

configure({ asyncUtilTimeout: 5_000 });

const row = (name: string, slug: string, title: string, description = "") => ({
  name,
  service: "DOCUMENT",
  identifier: `qshare_collection_${slug}_${slug.slice(0, 2)}0000`,
  updated: 10,
  metadata: { title, description },
});
const rows = [
  row("alice", "mine", "My own"),
  row("bob", "picks", "Bob's picks", "Live music"),
  row("carol", "gone", "Deleted one"),
  row("dave", "docs", "Manuals"),
  row("spammer", "spam", "Spam"),
];
const bodies: Record<string, unknown[]> = { carol: [] };

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderExplore(onClose = vi.fn()) {
  renderWithProviders(
    <>
      <Routes>
        <Route path="*" element={<ExploreCollectionsDialog open onClose={onClose} />} />
      </Routes>
      <Where />
    </>,
    { initialEntries: ["/"] }
  );
  return onClose;
}

// Everyone's collections; your own (by name) are the My collections summary's.
const allSearches = () => fetchCallsMatching("/arbitrary/resources/search").map((url) => new URL(url, "http://node").searchParams);
const searches = () => allSearches().filter((p) => !p.get("name"));

beforeEach(() => {
  resetQdnSearchCache();
  resetCollectionCaches();
  resetSettingsCache();
  localStorage.clear();
  resetMyCollectionsLoader();
  store.dispatch(clearMine());
  store.dispatch(addUser({ address: "Qalice", publicKey: "k", name: "alice", names: [{ name: "alice", owner: "Qalice" }] }));
  writeSettings({ hiddenNames: ["spammer"] });
  // Core's query: anywhere in the name, identifier, title or description, any case.
  mockFetch("/arbitrary/resources/search", (url: URL) => {
    const q = url.searchParams.get("query")?.toLowerCase();
    const name = url.searchParams.get("name");
    const named = name ? rows.filter((r) => r.name === name) : rows;
    return q
      ? named.filter((r) => [r.name, r.identifier, r.metadata.title, r.metadata.description].some((f) => f.toLowerCase().includes(q)))
      : named;
  });
  mockQortalAction("FETCH_QDN_RESOURCE", (params) => ({
    version: 1,
    title: "x",
    description: "",
    created: 1,
    updated: 2,
    items: bodies[String(params.name)] ?? [{ name: "x", identifier: "qshare_file_a_b_metadata" }],
  }));
});

describe("Explore collections", { timeout: 20_000 }, () => {
  it("lists other people's collections with one paged search, leaving out yours, hidden names and deleted ones", async () => {
    renderExplore();
    const dialog = within(await screen.findByRole("dialog", { name: "Explore collections" }));
    expect(await dialog.findByRole("button", { name: "Open Bob's picks" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Open Manuals" })).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Open My own" })).not.toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Open Spam" })).not.toBeInTheDocument();
    // An emptied (deleted) collection goes once its body says so.
    await waitFor(() => expect(dialog.queryByRole("button", { name: "Open Deleted one" })).not.toBeInTheDocument());

    expect(searches()).toHaveLength(1);
    const [first] = searches();
    expect(first.get("identifier")).toBe("qshare_collection_");
    expect(first.get("limit")).toBe("20");
    expect(first.get("query")).toBeNull();
    expect(first.get("name")).toBeNull();
    expect(dialog.getByRole("textbox", { name: "Search collections" })).toBeInTheDocument();
  });

  it("searches as typing pauses, once per query, and says when nothing matches", async () => {
    renderExplore();
    const dialog = within(await screen.findByRole("dialog", { name: "Explore collections" }));
    await dialog.findByRole("button", { name: "Open Manuals" });
    vi.useFakeTimers();
    try {
      const field = dialog.getByRole("textbox", { name: "Search collections" });
      fireEvent.change(field, { target: { value: "l" } });
      fireEvent.change(field, { target: { value: "live" } });
      act(() => vi.advanceTimersByTime(EXPLORE_SEARCH_DELAY_MS - 1));
      expect(searches()).toHaveLength(1);
      act(() => vi.advanceTimersByTime(1));
      expect(searches()).toHaveLength(2);
      expect(searches()[1].get("query")).toBe("live");
    } finally {
      vi.useRealTimers();
    }
    expect(await dialog.findByRole("button", { name: "Open Bob's picks" })).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Open Manuals" })).not.toBeInTheDocument();

    // Enter runs it at once.
    fireEvent.change(dialog.getByRole("textbox", { name: "Search collections" }), { target: { value: "zzz" } });
    fireEvent.submit(dialog.getByRole("search"));
    expect(await dialog.findByText("No collections match “zzz”")).toBeInTheDocument();
    expect(searches().at(-1)?.get("query")).toBe("zzz");

    fireEvent.click(dialog.getByRole("button", { name: "Clear search" }));
    expect(await dialog.findByRole("button", { name: "Open Manuals" })).toBeInTheDocument();
    expect(dialog.getByRole("textbox", { name: "Search collections" })).toHaveValue("");
    // Back to the first list: served from the session's cache, no new search.
    expect(searches().filter((p) => p.get("query") === null)).toHaveLength(1);
  });

  it("opens a collection or its publisher, closing the window", async () => {
    const onClose = renderExplore();
    const dialog = within(await screen.findByRole("dialog", { name: "Explore collections" }));
    fireEvent.click(await dialog.findByRole("button", { name: "Open Bob's picks" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where")).toHaveTextContent("/collection/bob/qshare_collection_picks_pi0000");

    fireEvent.click(dialog.getByRole("button", { name: "Shares by dave" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("where")).toHaveTextContent("/channel/dave");
  });

  it("shows your collections first, with a summary, and opens them", async () => {
    const onClose = renderExplore();
    const dialog = within(await screen.findByRole("dialog", { name: "Explore collections" }));
    // alice has one collection with one share; asked for at once, by name, once.
    const mine = await dialog.findByRole("button", { name: "My collections: 1 collection, 1 share" });
    // The newest by its body's title (every body here is titled "x").
    expect(mine).toHaveTextContent(/Newest: x,/);
    expect(allSearches().filter((p) => p.get("name") === "alice")).toHaveLength(1);
    // Above everyone else's.
    const others = await dialog.findByRole("button", { name: "Open Bob's picks" });
    expect(mine.compareDocumentPosition(others) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(mine);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/collections$/);
  });

  it("leaves the summary out while searching, and when signed out", async () => {
    renderExplore();
    const dialog = within(await screen.findByRole("dialog", { name: "Explore collections" }));
    await dialog.findByRole("button", { name: /^My collections/ });
    fireEvent.change(dialog.getByRole("textbox", { name: "Search collections" }), { target: { value: "picks" } });
    fireEvent.submit(dialog.getByRole("search"));
    await waitFor(() => expect(dialog.queryByRole("button", { name: /^My collections/ })).not.toBeInTheDocument());
  });

  it("says so when you have none yet", async () => {
    store.dispatch(addUser({ address: "Qzed", publicKey: "k", name: "zed", names: [{ name: "zed", owner: "Qzed" }] }));
    renderExplore();
    const dialog = within(await screen.findByRole("dialog", { name: "Explore collections" }));
    expect(await dialog.findByRole("button", { name: "My collections: none yet" })).toBeInTheDocument();
    expect(dialog.getByText(/None yet\. Save a share with its bookmark/)).toBeInTheDocument();
  });
});
