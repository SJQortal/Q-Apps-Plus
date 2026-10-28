import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { clearRecentlyViewed, rememberViewed, recentlyViewed, resetRecentlyViewed, MAX_RECENTLY_VIEWED, RECENTLY_VIEWED_KEY } from "./recentlyViewed";
import { RecentlyViewedStrip } from "./RecentlyViewedStrip";

const item = (n: number) => ({ owner: "Shop+Plus", storeId: "q-store-general-shop-1", productId: `q-store-product-shop-1-P${n}`, catalogueId: "q-store-catalogue-shop-1-CAT1" });

vi.mock("../qdn/search", async (original) => ({
  ...(await original<typeof import("../qdn/search")>()),
  fetchQdnJson: vi.fn(async () => ({
    products: {
      "q-store-product-shop-1-P1": { title: "Mug", status: "AVAILABLE", images: [], price: [{ currency: "qort", value: 2 }] },
      "q-store-product-shop-1-P2": { title: "Gone", status: "RETIRED", images: [], price: [{ currency: "qort", value: 2 }] },
    },
  })),
}));

describe("recently viewed", () => {
  it("keeps the latest first, once each, at most 12, on this device", () => {
    for (let n = 0; n < 14; n++) rememberViewed(item(n), n);
    rememberViewed(item(5), 99);
    const list = recentlyViewed();
    expect(list).toHaveLength(MAX_RECENTLY_VIEWED);
    expect(list[0].productId).toBe(item(5).productId);
    expect(list.filter((v) => v.productId === item(5).productId)).toHaveLength(1);
    resetRecentlyViewed();
    expect(recentlyViewed()[0].productId).toBe(item(5).productId);
    clearRecentlyViewed();
    expect(localStorage.getItem(RECENTLY_VIEWED_KEY)).toBeNull();
  });

  it("shows them on a strip, leaving out what its shop retired, and Clear empties it", async () => {
    rememberViewed(item(2), 1);
    rememberViewed(item(1), 2);
    renderWithProviders(<RecentlyViewedStrip />);
    expect(await screen.findByText("Mug")).toBeInTheDocument();
    expect(screen.queryByText("Gone")).toBeNull();
    act(() => screen.getByRole("button", { name: "Clear" }).click());
    expect(screen.queryByText("Recently viewed")).toBeNull();
  });

  it("tells the page while it shows, so the list under it gets its own heading", async () => {
    rememberViewed(item(1), 1);
    const onShown = vi.fn();
    renderWithProviders(<RecentlyViewedStrip onShown={onShown} />);
    expect(await screen.findByText("Mug")).toBeInTheDocument();
    expect(onShown).toHaveBeenLastCalledWith(true);
    act(() => screen.getByRole("button", { name: "Clear" }).click());
    expect(onShown).toHaveBeenLastCalledWith(false);
  });
});
