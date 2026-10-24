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

const options = [
  { name: "Colour", values: ["Red", "Blue"] },
  { name: "Size", values: ["S", "M"] },
];

/** Shop 1's products 0–3 become a T-shirt in four variants (product 0 the lead, Blue / M out of stock). */
function world(display: "bundle" | "separate") {
  const w = makeWorld({ shops: 3, productsPerShop: 6 });
  const shop = w.shops[1];
  const combos = [
    ["Red", "S"],
    ["Red", "M"],
    ["Blue", "S"],
    ["Blue", "M"],
  ];
  const lead = shop.products[0].id;
  combos.forEach((values, i) => {
    const p = shop.products[i];
    p.title = `T-shirt — ${values.join(" / ")}`;
    p.price = [{ currency: "qort", value: 10 + i }];
    p.type = "physical";
    p.status = i === 3 ? "OUT_OF_STOCK" : "AVAILABLE";
    p.variant = { group: "TSHIRT", title: "T-shirt", options, values, display, lead };
  });
  shop.variantGroups = { TSHIRT: { title: "T-shirt", options, display, lead } };
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
    await waitFor(() => expect(cardTitles()).toContain("T-shirt"));
    expect(cardTitles().filter((t) => t?.startsWith("T-shirt"))).toEqual(["T-shirt"]);
    expect(screen.getByText("4 options")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Choose options: T-shirt/ })).toBeInTheDocument();
  });

  it("each variant has its own card when the seller lists them apart", async () => {
    render(shopPath, world("separate"));
    await waitFor(() => expect(cardTitles().filter((t) => t?.startsWith("T-shirt")).sort()).toEqual(["T-shirt — Blue / M", "T-shirt — Blue / S", "T-shirt — Red / M", "T-shirt — Red / S"]));
    expect(screen.queryByText("4 options")).toBeNull();
  });

  it("the product page offers the choices, and a choice opens the variant it leads to", async () => {
    const w = world("bundle");
    const shop = w.shops[1];
    const cat = `q-store-catalogue-${shop.shortStoreId}-CAT0000000`;
    render(productPath(shop.owner, "q-store-general-shop-1", shop.products[0].id, cat), w);
    expect(await screen.findByRole("heading", { level: 1, name: "T-shirt" })).toBeInTheDocument();
    const variants = await screen.findByRole("region", { name: "Variants" });
    const size = within(variants).getByRole("group", { name: "Size: S" });
    expect(within(size).getByRole("button", { name: "S" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(size).getByRole("button", { name: "M" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toContain(shop.products[1].id));
    // Blue / M is out of stock, and says so.
    const colour = within(await screen.findByRole("region", { name: "Variants" })).getByRole("group", { name: "Colour: Red" });
    expect(within(colour).getByRole("button", { name: "Blue (out of stock)" })).toBeInTheDocument();
  });
});
