/**
 * Variants for buyers against the mocked node: a group listed as one card
 * on the shop page, each variant on its own when the seller chose that, and
 * the product page's choices, which open the variant they lead to.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes, useLocation } from "react-router-dom";
import { renderWithProviders } from "../test/renderWithProviders";
import { installMockNode, installVisibleIntersectionObserver, makeWorld } from "../test/mockNode";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { Store } from "../pages/Store/Store/Store";
import { ProductPage } from "../pages/Product/ProductPage";
import { productPath } from "../qdn/links";

// Glasses: Round in three lens colours, Square in one.
const options = [
  { name: "Round", values: [{ name: "Pale", color: "#f1f5f9" }, { name: "Orange", color: "#f97316" }, { name: "Red" }] },
  { name: "Square", values: [{ name: "Pale" }] },
];

/** Shop 1's products 0–3 become glasses in four items (product 0 the lead, Round / Red out of stock). */
function world(display: "bundle" | "separate") {
  const w = makeWorld({ shops: 3, productsPerShop: 6 });
  const shop = w.shops[1];
  const combos = [
    ["Round", "Pale"],
    ["Round", "Orange"],
    ["Round", "Red"],
    ["Square", "Pale"],
  ];
  const lead = shop.products[0].id;
  combos.forEach((values, i) => {
    const p = shop.products[i];
    p.title = `Glasses — ${values.join(" / ")}`;
    p.price = [{ currency: "qort", value: 10 + i }];
    p.type = "physical";
    p.status = i === 2 ? "OUT_OF_STOCK" : "AVAILABLE";
    p.variant = { group: "GLASSES", title: "Glasses", options, values, display, lead };
  });
  shop.variantGroups = { GLASSES: { title: "Glasses", options, display, lead } };
  return w;
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function render(path: string, w: ReturnType<typeof world>) {
  installVisibleIntersectionObserver();
  installMockNode(w);
  const store = createAppStore();
  store.dispatch(addUser({ address: "QAnn", publicKey: "pk", name: "Ann Buyer" }));
  renderWithProviders(
    <>
      <Routes>
        <Route path="/:user/:store/:product/:catalogue" element={<ProductPage />} />
        <Route path="/:user/:store" element={<Store />} />
      </Routes>
      <Where />
    </>,
    { initialEntries: [path], store }
  );
}

const shopPath = `/${encodeURIComponent("Shop+Plus")}/q-store-general-shop-1`;
const cardTitles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("variants for buyers", () => {
  it("a bundled group is one card: its title, its lowest price, how many, and Choose options", async () => {
    render(shopPath, world("bundle"));
    await waitFor(() => expect(cardTitles()).toContain("Glasses"));
    expect(cardTitles().filter((t) => t?.startsWith("Glasses"))).toEqual(["Glasses"]);
    expect(screen.getByText("4 options")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Choose options: Glasses/ })).toBeInTheDocument();
  });

  it("each item has its own card when the seller lists them apart", async () => {
    render(shopPath, world("separate"));
    await waitFor(() =>
      expect(cardTitles().filter((t) => t?.startsWith("Glasses")).sort()).toEqual(["Glasses — Round / Orange", "Glasses — Round / Pale", "Glasses — Round / Red", "Glasses — Square / Pale"])
    );
    expect(screen.queryByText("4 options")).toBeNull();
  });

  it("the product page offers the choices, and a choice opens the variant it leads to", async () => {
    const w = world("bundle");
    const shop = w.shops[1];
    const cat = `q-store-catalogue-${shop.shortStoreId}-CAT0000000`;
    render(productPath(shop.owner, "q-store-general-shop-1", shop.products[0].id, cat), w);
    expect(await screen.findByRole("heading", { level: 1, name: "Glasses" })).toBeInTheDocument();
    const variants = await screen.findByRole("region", { name: "Variants" });
    const shape = within(variants).getByRole("group", { name: "Variant: Round" });
    expect(within(shape).getByRole("button", { name: "Round" })).toHaveAttribute("aria-pressed", "true");
    const lens = within(variants).getByRole("group", { name: "Round: Pale" });
    // Round's own values only (not Square's), Red out of stock and saying so.
    expect(within(lens).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual(["Pale", "Orange", "Red (out of stock)"]);
    fireEvent.click(within(lens).getByRole("button", { name: "Orange" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain(shop.products[1].id));
    // Square keeps the value when it has it: Pale.
    fireEvent.click(within(within(await screen.findByRole("region", { name: "Variants" })).getByRole("group", { name: "Variant: Round" })).getByRole("button", { name: "Square" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain(shop.products[3].id));
  });
});
