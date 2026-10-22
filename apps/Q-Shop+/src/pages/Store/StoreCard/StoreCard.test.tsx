import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { StoreCard } from "./StoreCard";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { installVisibleIntersectionObserver } from "../../../test/mockNode";
import { forgetFailedShopDetails, requestShopDetails, resetShopDetails } from "../../../discovery/shopDetails";
import { shopKey, type ShopEntry } from "../../../discovery/shopIndex";

const SHOP: ShopEntry = {
  key: shopKey("Seller Name", "q-store-general-my-shop"),
  owner: "Seller Name",
  id: "q-store-general-my-shop",
  shortStoreId: "my-shop",
  title: "Seller's Shop",
  description: "Mugs, posters and digital art",
  created: 1690000000000,
  updated: 1690000000000,
  acceptsArrr: true,
};

const SHOP_JSON = {
  title: "Seller's Shop",
  description: "Mugs, posters and digital art",
  location: "Lisbon",
  shipsTo: "Europe",
  created: 1690000000000,
  shortStoreId: "my-shop",
  logo: "data:image/webp;base64,TE9HTw==",
  supportedCoins: ["QORT", "ARRR", "BTC"],
  foreignCoins: { ARRR: "zs1arrr", BTC: "bc1q" },
};

let up = true;
interface FakeResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

function stubNode() {
  const fetchMock = vi.fn(
    async (_url: string): Promise<FakeResponse> =>
      up
        ? { ok: true, status: 200, text: async () => JSON.stringify(SHOP_JSON) }
        : { ok: false, status: 404, text: async () => '{"error":1401}' }
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderCard(props: Partial<Parameters<typeof StoreCard>[0]> = {}) {
  return renderWithProviders(
    <ul>
      <StoreCard shop={SHOP} mine={false} onOpen={() => {}} onMenu={() => {}} {...props} />
    </ul>
  );
}

beforeEach(() => {
  resetShopDetails();
  up = true;
  installVisibleIntersectionObserver();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a shop card", () => {
  it("reads its shop once in view: the logo, the coins it takes, and the shop for the cart's titles", async () => {
    const fetchMock = stubNode();
    const { store } = renderCard();
    expect(await screen.findByRole("img", { name: "Seller's Shop" })).toHaveAttribute("src", SHOP_JSON.logo);
    expect(screen.getByRole("link", { name: "Seller's Shop" })).toHaveAccessibleDescription(/Pays in QORT, ARRR, BTC\./);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(store.getState().store.hashMapStores["q-store-general-my-shop"]).toMatchObject({ isValid: true, owner: "Seller Name", title: "Seller's Shop" }));
  });

  it("shows no logo that isn't an image inside the shop's JSON", async () => {
    stubNode();
    SHOP_JSON.logo = "https://tracker.example/pixel.png";
    try {
      renderCard();
      await waitFor(() => expect(screen.getByRole("link", { name: "Seller's Shop" })).toHaveAccessibleDescription(/BTC/));
      expect(screen.queryByRole("img", { name: "Seller's Shop" })).not.toBeInTheDocument();
    } finally {
      SHOP_JSON.logo = "data:image/webp;base64,TE9HTw==";
    }
  });

  it("tries again a shop that a Pays in check read only once", async () => {
    const fetchMock = stubNode();
    up = false;
    await requestShopDetails(SHOP.owner, SHOP.id, { retries: false });
    up = true;
    renderCard();
    expect(await screen.findByRole("img", { name: "Seller's Shop" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("says when its shop isn't on the node, and asks again after a pull to refresh", async () => {
    vi.useFakeTimers();
    const fetchMock = stubNode();
    up = false;
    const job = requestShopDetails(SHOP.owner, SHOP.id);
    await vi.advanceTimersByTimeAsync(15_000);
    await job;
    vi.useRealTimers();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    renderCard();
    expect(screen.getByText("Logo not available right now")).toBeInTheDocument();
    up = true;
    act(() => forgetFailedShopDetails());
    expect(await screen.findByRole("img", { name: "Seller's Shop" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("shows a shop whose JSON has coin fields of the wrong type (they crashed the whole app)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ...SHOP_JSON, supportedCoins: 1, foreignCoins: { ARRR: 5 }, acceptedAssets: {} }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderCard();
    expect(await screen.findByRole("img", { name: "Seller's Shop" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Seller's Shop" })).toHaveAccessibleDescription(/Pays in QORT\./);
  });

  it("gives way to a plain card with a link when it can't be shown, and the rest of the list stays", async () => {
    stubNode();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      renderWithProviders(
        <ul>
          <StoreCard shop={SHOP} mine={false} rating={{ average: 4, count: { n: 1 } as unknown as number }} onOpen={() => {}} onMenu={() => {}} />
          <StoreCard
            shop={{ ...SHOP, key: shopKey("Other", "q-store-general-other"), owner: "Other", id: "q-store-general-other", title: "Other shop" }}
            mine={false}
            onOpen={() => {}}
            onMenu={() => {}}
          />
        </ul>
      );
      expect(screen.getByText("This shop's card couldn't be shown.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Open shop" })).toHaveAttribute("href", "/Seller%20Name/q-store-general-my-shop");
      expect(screen.getByRole("link", { name: "Other shop" })).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    } finally {
      error.mockRestore();
    }
  });

  it("reads its shop again when the index says the shop changed, keeping the old logo meanwhile", async () => {
    const fetchMock = stubNode();
    let setShop: (shop: ShopEntry) => void = () => {};
    function Harness() {
      const [shop, set] = useState(SHOP);
      setShop = set;
      return (
        <ul>
          <StoreCard shop={shop} mine={false} onOpen={() => {}} onMenu={() => {}} />
        </ul>
      );
    }
    renderWithProviders(<Harness />);
    expect(await screen.findByRole("img", { name: "Seller's Shop" })).toHaveAttribute("src", SHOP_JSON.logo);
    // The seller edits the shop: a new logo, and BTC dropped.
    const oldLogo = SHOP_JSON.logo;
    SHOP_JSON.logo = "data:image/webp;base64,TkVX";
    SHOP_JSON.supportedCoins = ["QORT", "ARRR"];
    try {
      // The same version again: nothing to read.
      act(() => setShop({ ...SHOP }));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // A pull to refresh brings the index's newer `updated`.
      act(() => setShop({ ...SHOP, updated: SHOP.updated + 60_000 }));
      expect(screen.getByRole("img", { name: "Seller's Shop" })).toHaveAttribute("src", oldLogo);
      await waitFor(() => expect(screen.getByRole("img", { name: "Seller's Shop" })).toHaveAttribute("src", "data:image/webp;base64,TkVX"));
      expect(screen.getByRole("link", { name: "Seller's Shop" })).toHaveAccessibleDescription(/Pays in QORT, ARRR\./);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      SHOP_JSON.logo = oldLogo;
      SHOP_JSON.supportedCoins = ["QORT", "ARRR", "BTC"];
    }
  });

  it("is one link to the shop with a separate More button", async () => {
    stubNode();
    const onMenu = vi.fn();
    renderCard({ onMenu, mine: true, rating: { average: 4.25, count: 2 } });
    const link = screen.getByRole("link", { name: "Seller's Shop" });
    expect(link).toHaveAttribute("href", "/Seller%20Name/q-store-general-my-shop");
    expect(link).toHaveAccessibleDescription(/Rated 4\.3 out of 5 from 2 reviews\..*Your shop\./);
    screen.getByRole("button", { name: "More for Seller's Shop" }).click();
    expect(onMenu).toHaveBeenCalledWith(SHOP, expect.any(HTMLElement));
  });
});
