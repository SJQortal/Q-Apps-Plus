/**
 * The home page against the mock node (24 shops, the oldest being "Seller's
 * Shop" by "Seller Name", which has six reviews): what it asks the node for,
 * and what it shows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { StoreList } from "./StoreList";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installMockNode, installVisibleIntersectionObserver, makeWorld, type World } from "../../test/mockNode";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setOwnShopStatus, type OwnShopStatus } from "../../state/features/globalSlice";
import { setAllMyStores, type Store } from "../../state/features/storeSlice";
import { resetShopIndexMemory } from "../../discovery/shopIndex";
import { resetRatingsMemory } from "../../discovery/ratings";
import { resetActivityMemory } from "../../discovery/activity";
import { resetShopDetails } from "../../discovery/shopDetails";
import { resetHomeMemory } from "../../discovery/useHomeShops";
import { resetNewProductsCache } from "../../discovery/newProducts";
import { invalidateQdnSearches } from "../../qdn/search";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

/** Records the URLs as the app asked for them (the mock node matches identifiers as Core does). */
function recordFetches(): string[] {
  const nodeFetch = globalThis.fetch;
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      asked.push(String(input));
      return nodeFetch(String(input));
    })
  );
  return asked;
}

const MY_SHOP: Store = {
  title: "Seller's Shop",
  description: "Everything shop 0 sells",
  created: 1690000000000,
  owner: "Seller Name",
  id: "q-store-general-my-shop",
};

function renderHome(
  options: {
    path?: string;
    world?: World;
    user?: string;
    myStores?: Store[];
    ownShopStatus?: OwnShopStatus;
    allInView?: boolean;
  } = {}
) {
  if (options.allInView) installVisibleIntersectionObserver();
  const node = installMockNode(options.world ?? makeWorld());
  const asked = recordFetches();
  const store = createAppStore();
  if (options.user) store.dispatch(addUser({ address: "QAddress", publicKey: "pk", name: options.user }));
  if (options.myStores) store.dispatch(setAllMyStores(options.myStores));
  if (options.ownShopStatus) store.dispatch(setOwnShopStatus(options.ownShopStatus));
  const view = renderWithProviders(
    <>
      <StoreList />
      <LocationProbe />
    </>,
    { initialEntries: [options.path ?? "/"], store }
  );
  return { ...view, node, store, asked };
}

const cards = () => document.querySelectorAll("[data-shop-card]");
const cardTitles = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const location = () => screen.getByTestId("location").textContent;
const searchParams = (urls: string[]) =>
  urls.filter((u) => u.startsWith("/arbitrary/resources/search")).map((u) => new URLSearchParams(u.split("?")[1]));

beforeEach(() => {
  resetShopIndexMemory();
  resetRatingsMemory();
  resetActivityMemory();
  resetShopDetails();
  resetHomeMemory();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("home page", () => {
  it("paints every card from one search, newest first, with no shop JSON until a card is in view", async () => {
    const { node } = renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Shops" })).toBeInTheDocument();
    await waitFor(() => expect(cards()).toHaveLength(20));
    expect(cardTitles()[0]).toBe("Shop number 23");
    expect(screen.getByText("24 shops")).toBeInTheDocument();
    // The cards paint from the one shop-index search; the reviews index (for
    // their stars) and the favourites' (their hearts) follow once it is in, and still no shop JSON is read.
    await waitFor(() => expect(node.summary().searches).toEqual({ STORE: 1, DOCUMENT: 2 }));
    const s = node.summary();
    expect(searchParams(node.fetchCalls).filter((p) => p.get("service") === "DOCUMENT").map((p) => p.get("identifier")).sort()).toEqual(["q-store-fav", "q-store-review-"]);
    expect(s.unlimitedSearches).toBe(0);
    expect(s.resources).toEqual({});
    // Titles and descriptions come from the metadata, without the coins marker.
    expect(screen.getByText("Everything shop 23 sells")).toBeInTheDocument();
  });

  it("makes each card a link to its shop, named by its title, with the owner encoded", async () => {
    renderHome({ path: "/?sort=az" });
    const link = await screen.findByRole("link", { name: "Seller's Shop" });
    expect(link).toHaveAttribute("href", "/Seller%20Name/q-store-general-my-shop");
    expect(link).toHaveAccessibleDescription(/Everything shop 0 sells/);
    // The reviews index loads after the shop index on every visit, so the stars join in.
    await waitFor(() =>
      expect(link).toHaveAccessibleDescription(/By Seller Name\. Rated 3\.5 out of 5 from 6 reviews\. Pays in QORT, ARRR\./)
    );
  });

  it("shows 20 cards, then the rest as the end of the list comes into view", async () => {
    renderHome({ allInView: true });
    await waitFor(() => expect(cards()).toHaveLength(24));
    expect(screen.getByText("That's every shop.")).toBeInTheDocument();
  });

  it("shows the newest products after the first rows, linking to their pages, once the strip is in view", async () => {
    const { node } = renderHome({ allInView: true });
    const strip = await screen.findByRole("region", { name: "New products" });
    const link = await within(strip).findByRole("link", { name: /^Product 11\b/ });
    expect(link).toHaveAttribute(
      "href",
      "/Seller%2023/q-store-general-shop-23/q-store-product-shop-23-P000000011/q-store-catalogue-shop-23-CAT0000001"
    );
    expect(within(within(strip).getByRole("list")).getAllByRole("link")).toHaveLength(12);
    expect(within(strip).getByRole("link", { name: "See all products" })).toHaveAttribute("href", "/products");
    const catalogues = searchParams(node.fetchCalls).filter((p) => p.get("identifier") === "q-store-catalogue-");
    expect(catalogues).toHaveLength(1);
    expect(catalogues[0].get("limit")).toBe("4");
  });

  it("leaves out a new product whose title isn't text (it blanked the whole app)", async () => {
    const world = makeWorld();
    world.shops[23].products[11].title = { a: 1 };
    // Catalogues read by earlier tests stay cached for the session: read this world's.
    resetNewProductsCache();
    renderHome({ world, allInView: true });
    const strip = await screen.findByRole("region", { name: "New products" });
    await within(strip).findByRole("link", { name: /^Product 10\b/ }, { timeout: 5000 });
    const hrefs = within(within(strip).getByRole("list")).getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toHaveLength(12);
    expect(hrefs.some((href) => href?.includes("q-store-product-shop-23-P000000011"))).toBe(false);
    expect(cards()).toHaveLength(24);
    resetNewProductsCache();
  });

  it("has no new-products strip while searching or filtering, and reads none until it is in view", async () => {
    const { node } = renderHome();
    await waitFor(() => expect(cards()).toHaveLength(20));
    expect(screen.getByRole("region", { name: "New products" })).toBeInTheDocument();
    expect(node.q.callsFor("FETCH_QDN_RESOURCE")).toHaveLength(0);
    fireEvent.change(screen.getByRole("textbox", { name: "Search shops" }), { target: { value: "number 1" } });
    await waitFor(() => expect(cards()).toHaveLength(11));
    expect(screen.queryByRole("region", { name: "New products" })).not.toBeInTheDocument();
  });

  it("reads a card's shop JSON when it is in view: the logo replaces the initial, a broken shop goes", async () => {
    const world = makeWorld();
    // Shop 22's JSON fails the original's check (no description).
    world.shops[22].description = "";
    const { node } = renderHome({ world, allInView: true });
    await waitFor(() => expect(screen.getByRole("img", { name: "Shop number 23" })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Shop number 22" })).not.toBeInTheDocument());
    expect(node.summary().resources.STORE).toBe(24);
  });

  describe("search", () => {
    it("searches once typing pauses, keeps the text in the URL, and clears", async () => {
      const { asked } = renderHome();
      await waitFor(() => expect(cards()).toHaveLength(20));
      fireEvent.change(screen.getByRole("textbox", { name: "Search shops" }), { target: { value: "number 1" } });
      await waitFor(() => expect(location()).toBe("/?q=number+1"));
      await waitFor(() => expect(cards()).toHaveLength(11));
      expect(screen.getByText("11 shops match")).toBeInTheDocument();
      const queries = searchParams(asked).filter((p) => p.get("query"));
      // Typing "number 1" in one go: one search, not one per letter.
      expect(queries).toHaveLength(1);
      const [params] = queries;
      expect(params.get("query")).toBe("number 1");
      expect(params.get("service")).toBe("STORE");
      expect(params.get("identifier")).toBe("q-store-general-");
      expect(params.get("prefix")).toBeNull();
      expect(params.get("limit")).toBe("20");

      fireEvent.click(screen.getByRole("button", { name: "Clear the search" }));
      await waitFor(() => expect(location()).toBe("/"));
      await waitFor(() => expect(cards()).toHaveLength(20));
    });

    it("runs the search from the URL, so Back restores it", async () => {
      renderHome({ path: "/?q=number%202" });
      expect(screen.getByRole("textbox", { name: "Search shops" })).toHaveValue("number 2");
      await waitFor(() => expect(cardTitles()).toEqual(["Shop number 23", "Shop number 22", "Shop number 21", "Shop number 20", "Shop number 2"]));
    });

    it("keeps the last results on screen while the next search loads", async () => {
      renderHome({ path: "/?q=number%201" });
      await waitFor(() => expect(cards()).toHaveLength(11));
      let release = () => {};
      const gate = new Promise<void>((resolve) => (release = resolve));
      const shimFetch = globalThis.fetch;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
          if (url.includes("query=number+2")) await gate;
          return shimFetch(url);
        })
      );
      fireEvent.change(screen.getByRole("textbox", { name: "Search shops" }), { target: { value: "number 2" } });
      await waitFor(() => expect(location()).toBe("/?q=number+2"));
      expect(screen.getByText("Searching…")).toBeInTheDocument();
      expect(cards()).toHaveLength(11);
      release();
      await waitFor(() => expect(cards()).toHaveLength(5));
      expect(screen.getByText("5 shops match")).toBeInTheDocument();
    });

    it("says when nothing matches, and offers every shop again", async () => {
      renderHome({ path: "/?q=zzz" });
      expect(await screen.findByText('No shops match "zzz"')).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Show all shops" }));
      await waitFor(() => expect(location()).toBe("/"));
      await waitFor(() => expect(cards()).toHaveLength(20));
    });

    it("doesn't count a match inside the coins marker", async () => {
      renderHome({ path: "/?q=arrrtrue" });
      expect(await screen.findByText('No shops match "arrrtrue"')).toBeInTheDocument();
    });
  });

  it("says when the shops can't be loaded, and retries", async () => {
    installMockNode(makeWorld());
    const nodeFetch = globalThis.fetch;
    let down = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        down && url.startsWith("/arbitrary/resources/search") ? Promise.reject(new Error("down")) : nodeFetch(url)
      )
    );
    renderWithProviders(<StoreList />);
    expect(await screen.findByText("Couldn't load shops")).toBeInTheDocument();
    down = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(cards()).toHaveLength(20));
  });

  describe("sorts", () => {
    it("Top rated loads the reviews once, puts rated shops first and shows their stars", async () => {
      const { node } = renderHome({ path: "/?sort=rated" });
      await waitFor(() => expect(cardTitles()[0]).toBe("Seller's Shop"));
      const reviews = searchParams(node.fetchCalls).filter((p) => p.get("identifier") === "q-store-review-");
      expect(reviews).toHaveLength(1);
      expect(reviews[0].get("service")).toBe("DOCUMENT");
      expect(reviews[0].get("prefix")).toBe("true");
      expect(reviews[0].get("limit")).toBe("100");
      // Six reviewers: 3, 3.5, 4, 3, 3.5, 4.
      const link = screen.getByRole("link", { name: "Seller's Shop" });
      const card = link.closest("[data-shop-card]") as HTMLElement;
      expect(within(card).getByText("3.5")).toBeInTheDocument();
      expect(within(card).getByText("(6)")).toBeInTheDocument();
      expect(link).toHaveAccessibleDescription(/Rated 3\.5 out of 5 from 6 reviews\./);
    });

    it("Most products reads the shops' product indexes in one search", async () => {
      const world = makeWorld();
      world.shops[5].products = [...world.shops[5].products, ...world.shops[6].products];
      const { node } = renderHome({ world, path: "/?sort=products" });
      await waitFor(() => expect(cardTitles()[0]).toBe("Shop number 5"));
      const indexes = searchParams(node.fetchCalls).filter(
        (p) => p.get("service") === "DOCUMENT" && p.get("identifier") === "q-store-general-"
      );
      expect(indexes).toHaveLength(1);
      expect(indexes[0].get("identifier")).toBe("q-store-general-");
      expect(indexes[0].get("prefix")).toBe("true");
      expect(node.summary().resources).toEqual({});
    });

    it("changes from the Sort by menu, in the URL", async () => {
      renderHome();
      await waitFor(() => expect(cards()).toHaveLength(20));
      fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sort by" }));
      fireEvent.click(await screen.findByRole("option", { name: "A–Z" }));
      await waitFor(() => expect(location()).toBe("/?sort=az"));
      await waitFor(() => expect(cardTitles()[0]).toBe("Seller's Shop"));
    });
  });

  describe("filters", () => {
    it("Pays in ARRR uses the metadata marker, without reading any shop", async () => {
      const { node } = renderHome({ path: "/?pay=ARRR" });
      await waitFor(() => expect(cards()).toHaveLength(12));
      expect(screen.getByText("12 shops")).toBeInTheDocument();
      expect(node.summary().resources).toEqual({});
    });

    it("Pays in Q-Assets reads the shops' JSON to find the ones that take one", async () => {
      const world = makeWorld();
      world.shops[4].acceptedAssets = [{ id: 81, name: "Gold" }];
      const { node } = renderHome({ world, path: "/?pay=assets", allInView: true });
      await waitFor(() => expect(cardTitles()).toEqual(["Shop number 4"]), { timeout: 8000 });
      await waitFor(() => expect(screen.getByText("1 shop")).toBeInTheDocument());
      expect(node.summary().resources.STORE).toBe(24);
    });

    it("an old link to Pays in BTC shows every shop: Q-Shop+ takes QORT, ARRR and assets only", async () => {
      const { node } = renderHome({ path: "/?pay=BTC" });
      await waitFor(() => expect(cards()).toHaveLength(20));
      expect(screen.queryByRole("button", { name: /Remove Pays in/ })).not.toBeInTheDocument();
      expect(node.summary().resources).toEqual({});
    });

    it("Pays in Q-Assets finds a shop that added one once the index shows it changed, reading only that shop again", async () => {
      const world = makeWorld();
      world.shops[4].acceptedAssets = [{ id: 81, name: "Gold" }];
      const first = renderHome({ world, path: "/?pay=assets", allInView: true });
      // 24 shop reads: under a busy test run this takes longer than waitFor's default second.
      await waitFor(() => expect(cardTitles()).toEqual(["Shop number 4"]), { timeout: 8000 });
      // Shop 4 can show before the other reads have landed: wait for all 24.
      await waitFor(() => expect(first.node.summary().resources.STORE).toBe(24), { timeout: 8000 });
      first.unmount();

      // Shop 7 starts taking an asset; the index (read again after a pull to
      // refresh, or once its cache is dropped) shows its newer `updated`.
      world.shops[7].acceptedAssets = [{ id: 82, name: "Silver" }];
      world.shops[7].updated += 60_000;
      invalidateQdnSearches();
      resetHomeMemory();
      const second = renderHome({ world, path: "/?pay=assets", allInView: true });
      await waitFor(() => expect(cardTitles()).toEqual(["Shop number 7", "Shop number 4"]), { timeout: 8000 });
      // One shop JSON read again, not 24.
      expect(second.node.fetchCalls.filter((u) => u.startsWith("/arbitrary/STORE/"))).toEqual([
        "/arbitrary/STORE/Seller%207/q-store-general-shop-7",
      ]);
    });

    it("My shops shows the signed-in name's shops, with a Yours badge", async () => {
      renderHome({ user: "Seller Name", myStores: [MY_SHOP] });
      await waitFor(() => expect(cards()).toHaveLength(20));
      fireEvent.click(screen.getByRole("button", { name: "My shops" }));
      await waitFor(() => expect(location()).toBe("/?mine=1"));
      await waitFor(() => expect(cardTitles()).toEqual(["Seller's Shop"]));
      const link = screen.getByRole("link", { name: "Seller's Shop" });
      expect(within(link.closest("[data-shop-card]") as HTMLElement).getByText("Yours")).toBeInTheDocument();
      expect(link).toHaveAccessibleDescription(/Your shop\./);
    });

    it("has no My shops for a name without a shop", async () => {
      renderHome({ user: "Buyer+One" });
      await waitFor(() => expect(cards()).toHaveLength(20));
      expect(screen.queryByRole("button", { name: "My shops" })).not.toBeInTheDocument();
    });
  });

  it("offers to open a shop to a signed-in name without one", async () => {
    const { store } = renderHome({ user: "Buyer+One", ownShopStatus: "none" });
    fireEvent.click(await screen.findByRole("button", { name: "Open your own shop" }));
    expect(store.getState().global.isOpenCreateStoreModal).toBe(true);
  });

  it("doesn't offer it while signed out", async () => {
    renderHome({ ownShopStatus: "none" });
    await waitFor(() => expect(cards()).toHaveLength(20));
    expect(screen.queryByRole("button", { name: "Open your own shop" })).not.toBeInTheDocument();
  });

  describe("a card's menu", () => {
    it("copies a Q-Shop+ link to the shop", async () => {
      const writeText = vi.fn(async () => undefined);
      vi.stubGlobal("isSecureContext", true);
      vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
      const { store } = renderHome({ path: "/?sort=az" });
      fireEvent.click(await screen.findByRole("button", { name: "More for Seller's Shop" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Copy link" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith("qortal://APP/Q-Shop+/Seller%20Name/q-store-general-my-shop"));
      await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Link copied"));
    });

    it("shows the link to copy by hand where copying isn't allowed", async () => {
      vi.stubGlobal("isSecureContext", false);
      renderHome({ path: "/?sort=az" });
      fireEvent.click(await screen.findByRole("button", { name: "More for Seller's Shop" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Copy link" }));
      const dialog = await screen.findByRole("dialog", { name: "Copy link" });
      expect(within(dialog).getByRole("textbox", { name: "Link" })).toHaveValue(
        "qortal://APP/Q-Shop+/Seller%20Name/q-store-general-my-shop"
      );
    });

    it("opens the shop", async () => {
      renderHome({ path: "/?sort=az" });
      fireEvent.click(await screen.findByRole("button", { name: "More for Seller's Shop" }));
      fireEvent.click(await screen.findByRole("menuitem", { name: "Open shop" }));
      await waitFor(() => expect(location()).toBe("/Seller%20Name/q-store-general-my-shop"));
    });
  });

  describe("on a phone", () => {
    const realMatchMedia = window.matchMedia;
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes("max-width:599.95px"),
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => false,
      })) as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = realMatchMedia;
    });

    it("sorts and filters in a sheet, and shows what is on as chips that turn it off", async () => {
      renderHome();
      await waitFor(() => expect(cards()).toHaveLength(20));
      expect(screen.queryByRole("combobox", { name: "Sort by" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Sort & filter" }));
      const sheet = await screen.findByRole("dialog", { name: "Sort and filter" });
      fireEvent.click(within(sheet).getByRole("radio", { name: "A–Z" }));
      fireEvent.click(within(sheet).getByRole("button", { name: "ARRR, Pirate Chain" }));
      await waitFor(() => expect(location()).toBe("/?sort=az&pay=ARRR"));
      fireEvent.click(within(sheet).getByRole("button", { name: "Done" }));
      // The page is aria-hidden until the sheet has slid away.
      expect(await screen.findByRole("button", { name: "Sort & filter · 2" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Remove Pays in ARRR" }));
      await waitFor(() => expect(location()).toBe("/?sort=az"));
    });
  });
});
