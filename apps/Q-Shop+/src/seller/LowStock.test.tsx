import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer } from "../state/features/globalSlice";
import { LowStock } from "./LowStock";

const STORE = "q-store-general-shop";
const left = new Map([
  ["p-low", 2],
  ["p-out", 0],
  ["p-plenty", 9],
]);
vi.mock("../stock/notes", () => ({ useStockLeft: () => ({ left, loading: false }) }));
vi.mock("./useCatalogueLoader", () => ({
  useCatalogueLoader: () => ({
    request: () => {},
    productOf: (_c: string, id: string) => ({ id, title: { "p-low": "Lamp", "p-out": "Scarf", "p-plenty": "Mug" }[id], price: [{ currency: "qort", value: 1 }] }),
    statusOf: () => "ready",
  }),
}));

const stock = { v: 1, quantity: 10, since: 1 };
const row = (status = "AVAILABLE") => ({ created: 1, priceQort: 1, category: "Home & Garden", catalogueId: "c1", status, stock });

describe("running low", () => {
  it("lists counted products with 3 or fewer left, sold out first, each opening its editor", () => {
    const store = createAppStore();
    store.dispatch(addUser({ address: "QSeller", publicKey: "pk", name: "Seller" }));
    store.dispatch(setCurrentStore({ id: STORE, owner: "Seller", title: "Shop" } as never));
    store.dispatch(setDataContainer({ storeId: STORE, owner: "Seller", products: { "p-low": row(), "p-out": row(), "p-plenty": row(), "p-gone": row("RETIRED") }, catalogues: [] }));
    const onEdit = vi.fn();
    renderWithProviders(<LowStock storeId={STORE} onEdit={onEdit} />, { store });
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual(["ScarfSold out", "Lamp2 left"]);
    fireEvent.click(screen.getByRole("button", { name: "Lamp: 2 left. Edit it" }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "p-low", title: "Lamp" }));
  });
});
