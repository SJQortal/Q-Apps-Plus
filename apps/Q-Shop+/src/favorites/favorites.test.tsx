/**
 * Favourites and hidden shops against the mocked Hub and node: the card
 * menu, the shop page's heart, the Favourites page, Most loved, and
 * Hide shop with Settings' Show again. Nothing reaches a real node.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../test/renderWithProviders";
import { installMockNode, installVisibleIntersectionObserver, makeWorld, type World } from "../test/mockNode";
import { decodeData64 } from "../test/fixtures/shop";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { StoreList } from "../pages/StoreList/StoreList";
import { Store } from "../pages/Store/Store/Store";
import { FavoritesPage } from "../pages/Favorites/FavoritesPage";
import { SettingsPage } from "../pages/Settings/SettingsPage";
import { resetShopIndexMemory } from "../discovery/shopIndex";
import { resetRatingsMemory } from "../discovery/ratings";
import { resetHomeMemory } from "../discovery/useHomeShops";
import { isShopHidden } from "../discovery/hiddenShops";
import { buildFavoritePublish, favoriteProduct, favoriteShop, type Favorite } from "./model";

const BUYER = "Ann Buyer";
const DECLINE = { error: { cancelled: true }, message: "User declined request" };

/** A favourite as the node lists it once published. */
function listed(name: string, fav: Favorite, created = 1) {
  const p = buildFavoritePublish({ name, fav, now: created });
  return { name, identifier: p.identifier, title: p.title, description: p.description, created };
}

function render(path: string, world: World, element: React.ReactNode, route = "*") {
  resetShopIndexMemory();
  resetRatingsMemory();
  resetHomeMemory();
  installVisibleIntersectionObserver();
  const node = installMockNode(world);
  const store = createAppStore();
  store.dispatch(addUser({ address: "QAnn", publicKey: "pk", name: BUYER }));
  renderWithProviders(
    <Routes>
      <Route path={route} element={element} />
    </Routes>,
    { initialEntries: [path], store }
  );
  return { node, store };
}

const titles = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("favourites", () => {
  it("the card menu adds a shop at once and publishes it; Hub's decline puts it back", async () => {
    const world = makeWorld();
    const { node } = render("/", world, <StoreList />);
    node.q.on("PUBLISH_QDN_RESOURCE", async () => true);
    fireEvent.click(await screen.findByRole("button", { name: "More for Shop number 23" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to favourites" }));
    await waitFor(() => expect(node.q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const publish = node.q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any;
    expect(publish).toMatchObject({ name: BUYER, service: "DOCUMENT", identifier: "q-store-favs-shop-23", description: "fav:Seller%2023" });
    expect(decodeData64(publish.data64)).toMatchObject({ kind: "shop", storeId: "q-store-general-shop-23", owner: "Seller 23" });
    // It landed: the menu offers the way back.
    fireEvent.click(screen.getByRole("button", { name: "More for Shop number 23" }));
    expect(await screen.findByRole("menuitem", { name: "Remove from favourites" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

    node.q.on("PUBLISH_QDN_RESOURCE", async () => {
      throw DECLINE;
    });
    fireEvent.click(await screen.findByRole("button", { name: "More for Shop number 22" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to favourites" }));
    await waitFor(() => expect(node.q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "More for Shop number 22" }));
    expect(await screen.findByRole("menuitem", { name: "Add to favourites" })).toBeInTheDocument();
  });

  it("Most loved lists the shops most names keep first, the owner's own not counted, and the cards show it", async () => {
    const world = makeWorld();
    const five = favoriteShop("Seller 5", "q-store-general-shop-5")!;
    const three = favoriteShop("Seller 3", "q-store-general-shop-3")!;
    // Three names for shop 3 (its owner's own doesn't count), two for shop 5.
    world.favorites = [listed("Bob", five), listed("Carol", five), listed("Dan", three), listed("Seller 3", three), listed("Eve", three), listed("Frank", three)];
    render("/?sort=favorites", world, <StoreList />);
    await waitFor(() => expect(titles().slice(0, 3)).toEqual(["Shop number 3", "Shop number 5", "Shop number 23"]));
    // The cards say it too (each card's summary for screen readers, and a heart with the number).
    expect(screen.getAllByText(/3 buyers keep it as a favourite\./)).toHaveLength(1);
    expect(screen.getAllByText(/2 buyers keep it as a favourite\./)).toHaveLength(1);
  });

  it("the shop page's heart keeps the shop, at once", async () => {
    const world = makeWorld();
    const { node } = render("/Seller%203/q-store-general-shop-3", world, <Store />, "/:user/:store");
    node.q.on("PUBLISH_QDN_RESOURCE", async () => true);
    const heart = await screen.findByRole("button", { name: "Add to favourites" });
    expect(heart).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(heart);
    expect(await screen.findByRole("button", { name: "In your favourites" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(node.q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    expect(node.q.callsFor("PUBLISH_QDN_RESOURCE")[0]).toMatchObject({ identifier: "q-store-favs-shop-3", title: "Favourite shop" });
  });

  it("the Favourites page shows the shops and the products apart", async () => {
    const world = makeWorld();
    const product = favoriteProduct("Shop+Plus", "q-store-general-shop-1", "q-store-product-shop-1-P000000003", "q-store-catalogue-shop-1-CAT0000000")!;
    world.favorites = [listed(BUYER, favoriteShop("Seller 3", "q-store-general-shop-3")!), listed(BUYER, product, 2), listed("Bob", favoriteShop("Seller 4", "q-store-general-shop-4")!)];
    render("/favorites", world, <FavoritesPage />);
    const shops = await screen.findByRole("list", { name: "Favourite shops" });
    expect(await within(shops).findByRole("heading", { name: "Shop number 3" })).toBeInTheDocument();
    expect(within(shops).queryByRole("heading", { name: "Shop number 4" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Products (1)" }));
    const products = await screen.findByRole("list", { name: "Favourite products" });
    expect(await within(products).findByRole("link", { name: "Product 3" })).toHaveAttribute("href", expect.stringContaining("q-store-product-shop-1-P000000003"));
    expect(within(products).getByRole("button", { name: "Remove Product 3 from favourites" })).toBeInTheDocument();
  });
});

describe("hidden shops", () => {
  it("Hide shop leaves the shop out of the list, and Settings shows it again", async () => {
    const world = makeWorld();
    render("/", world, <StoreList />);
    fireEvent.click(await screen.findByRole("button", { name: "More for Shop number 23" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Hide shop" }));
    await waitFor(() => expect(titles()).not.toContain("Shop number 23"));
    expect(isShopHidden("Seller 23", "shop-23")).toBe(true);
    expect(screen.getByText("23 shops")).toBeInTheDocument();
  });

  it("Settings lists the hidden shops to show again", async () => {
    const world = makeWorld();
    render("/", world, <StoreList />);
    fireEvent.click(await screen.findByRole("button", { name: "More for Shop number 23" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Hide shop" }));
    await waitFor(() => expect(isShopHidden("Seller 23", "shop-23")).toBe(true));
    render("/settings", world, <SettingsPage />);
    const list = await screen.findByRole("list", { name: "Hidden shops" });
    fireEvent.click(within(list).getByRole("button", { name: "Show again: Shop number 23" }));
    expect(isShopHidden("Seller 23", "shop-23")).toBe(false);
  });
});
