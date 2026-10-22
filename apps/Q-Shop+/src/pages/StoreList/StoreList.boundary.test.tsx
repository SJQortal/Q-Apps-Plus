/**
 * The home page keeps its shops when the new-products strip can't be shown:
 * the strip renders products any seller wrote, so it has its own boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { StoreList } from "./StoreList";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installMockNode, makeWorld } from "../../test/mockNode";
import { resetShopIndexMemory } from "../../discovery/shopIndex";
import { resetShopDetails } from "../../discovery/shopDetails";
import { resetHomeMemory } from "../../discovery/useHomeShops";

vi.mock("../../discovery/NewProductsStrip", () => ({
  NewProductsStrip: () => {
    throw new Error("A product the strip can't show");
  },
}));

beforeEach(() => {
  resetShopIndexMemory();
  resetShopDetails();
  resetHomeMemory();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("home page", () => {
  it("drops the new-products strip, not the page, when the strip fails", async () => {
    installMockNode(makeWorld());
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      renderWithProviders(<StoreList />, { initialEntries: ["/"] });
      await waitFor(() => expect(document.querySelectorAll("[data-shop-card]")).toHaveLength(20));
      expect(screen.getByRole("heading", { level: 1, name: "Shops" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "New products" })).toBeNull();
    } finally {
      error.mockRestore();
    }
  });
});
