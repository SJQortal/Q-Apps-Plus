import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { createAppStore } from "../../state/store";
import { replaceCarts, setProductToCart } from "../../state/features/cartSlice";
import { CartBadgeIcon } from "../../components/layout/BottomNav/BottomNav";
import { CartButton } from "./CartBits";

describe("cart badges", () => {
  // MUI keeps a "0" in an empty badge (scaled away), which axe counts as visible text that
  // isn't in the button's name "Cart" (label-content-name-mismatch, WCAG 2.5.3).
  it("hold no text while the cart is empty, and the count once it isn't", () => {
    const store = createAppStore();
    renderWithProviders(<CartButton />, { store });
    expect(screen.getByRole("button", { name: "Cart" }).textContent).toBe("");
  });

  it("show the count, which the name says too", () => {
    const store = createAppStore();
    store.dispatch(setProductToCart({ storeId: "q-store-general-s", storeOwner: "Ann", productId: "p1", catalogueId: "c1", quantity: 3 }));
    renderWithProviders(<CartButton />, { store });
    expect(screen.getByRole("button", { name: "Cart, 3 items" }).textContent).toBe("3");
  });

  it("hold no text once the cart is emptied (a hidden badge kept its last number)", () => {
    const store = createAppStore();
    store.dispatch(setProductToCart({ storeId: "q-store-general-s", storeOwner: "Ann", productId: "p1", catalogueId: "c1", quantity: 2 }));
    renderWithProviders(<CartButton />, { store });
    act(() => {
      store.dispatch(replaceCarts({}));
    });
    expect(screen.getByRole("button", { name: "Cart" }).textContent).toBe("");
  });

  it("the header and bottom bar's icon holds no text at 0", () => {
    const { container } = render(<CartBadgeIcon items={0} pending={0} />);
    expect(container.textContent).toBe("");
  });
});
