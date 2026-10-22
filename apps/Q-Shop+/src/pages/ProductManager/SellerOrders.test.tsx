import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within, configure } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installMockNode, makeWorld, type World } from "../../test/mockNode";
import { SELLER, SELLER_ADDRESS, SELLER_PK } from "../../test/fixtures/shop";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setCurrentStore, setDataContainer } from "../../state/features/globalSlice";
import { fetchRetry, resetOrderReadCaches } from "../../orders/reads";
import { addOrder, addStatus } from "../../orders/testing";
import { OrdersTab } from "./OrdersTab";
import { SellerOverview } from "./SellerOverview";

const STORE_ID = "q-store-general-my-shop";

function world(): World {
  const w = makeWorld({ shops: 2, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
  addOrder(w, "S0", 2000, { buyer: "Alice" });
  addOrder(w, "S1", 2001, { buyer: "Bob", physical: true });
  addOrder(w, "S2", 2002, { buyer: "Carol" });
  addOrder(w, "S3", 2003, { buyer: "Dave" });
  addOrder(w, "S4", 2004, { buyer: "Erin" });
  addOrder(w, "S5", 2005, { buyer: "Frank" });
  addStatus(w, "S5", "Shipped");
  addStatus(w, "S4", "Refunded");
  addStatus(w, "S2", "Shipped");
  return w;
}

function sellerStore() {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(
    setCurrentStore({
      id: STORE_ID,
      owner: SELLER,
      title: "Seller's Shop",
      description: "",
      shortStoreId: "my-shop",
      created: 1,
      foreignCoins: {},
      supportedCoins: ["QORT"],
    })
  );
  store.dispatch(
    setDataContainer({
      storeId: STORE_ID,
      shortStoreId: "my-shop",
      owner: SELLER,
      products: {
        a: { created: 1, priceQort: 1, category: "Art", catalogueId: "c", status: "AVAILABLE" },
        b: { created: 2, priceQort: 2, category: "Art", catalogueId: "c", status: "AVAILABLE" },
      },
      catalogues: [],
      id: `${STORE_ID}-datacontainer`,
    })
  );
  return store;
}

function names(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("button")
    .map((b) => ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank"].find((n) => b.textContent?.includes(n)) ?? "?");
}

// Rendering MUI in jsdom is slow when the machine is busy; 5 s was too tight.
vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

beforeEach(() => {
  resetOrderReadCaches();
  fetchRetry.delaysMs = [0, 0, 0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchRetry.delaysMs = [2000, 4000, 8000];
});

describe("the seller's Orders tab", () => {
  it("puts the orders to handle first, then the handled ones, newest first", async () => {
    installMockNode(world());
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await waitFor(() => expect(screen.getByRole("button", { name: "To handle · 3" })).toBeInTheDocument());
    await waitFor(() => expect(names(list)).toEqual(["Dave", "Bob", "Alice", "Frank", "Erin", "Carol"]));
    expect(screen.getByRole("button", { name: "Shipped · 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refunded · 1" })).toBeInTheDocument();
    expect(within(list).getAllByText("To handle")).toHaveLength(3);
  });

  it("survives an order written to break the list, and opens it", async () => {
    const w = world();
    const hostile = w.orders.find((o) => o.identifier === "q-store-order-my-shop-S3")!;
    hostile.json = {
      ...hostile.json,
      storeName: { evil: true },
      sellerName: 42,
      payment: { total: { x: 1 }, currency: 7, transactionSignature: ["s"], arrrAddressUsed: 9, foreignTxid: {} },
      details: { totalPrice: [], junk: "text", [`p`]: { product: { title: { t: 1 }, images: [{}] }, quantity: "2", pricePerUnit: "x" } },
    };
    installMockNode(w);
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await waitFor(() => expect(names(list)).toContain("Dave"));
    const dave = within(list)
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Dave"))!;
    expect(dave.textContent).toContain("Product × 2");
    fireEvent.click(dave);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Order from Dave")).toBeInTheDocument();
    expect(within(dialog).getByText("Not recorded in this order.")).toBeInTheDocument();
  });

  it("finds orders by buyer among the loaded ones", async () => {
    installMockNode(world());
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(6));
    fireEvent.change(screen.getByLabelText("Search by buyer"), { target: { value: "car" } });
    await waitFor(() => expect(names(screen.getByRole("list", { name: "Orders received" }))).toEqual(["Carol"]));
    fireEvent.change(screen.getByLabelText("Search by buyer"), { target: { value: "zed" } });
    expect(await screen.findByText("No orders from “zed”")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Orders received" })).getAllByRole("button")).toHaveLength(6)
    );
  });

  it("updates an order's status from the dialog, at once", async () => {
    const node = installMockNode(world());
    let finish: (v: unknown) => void = () => {};
    node.q.on("PUBLISH_QDN_RESOURCE", () => new Promise((r) => (finish = r)));
    const store = sellerStore();
    renderWithProviders(<OrdersTab />, { store });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await waitFor(() => expect(names(list)[0]).toBe("Dave"));
    fireEvent.click(within(list).getAllByRole("button")[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Shipped" }));
    fireEvent.change(within(dialog).getByLabelText("Note for the buyer"), { target: { value: "Posted" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Update status" }));
    // The list behind the dialog counts it as shipped before Hub answers.
    await waitFor(() => expect(screen.getByRole("button", { name: "Shipped · 3", hidden: true })).toBeInTheDocument());
    expect(within(dialog).getByRole("button", { name: "Updating…" })).toBeDisabled();
    expect(within(dialog).getByText("Shipped", { selector: ".MuiChip-label" })).toBeInTheDocument();
    finish({ signature: "ok" });
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Status updated"));
    const pub = node.q.callsFor("PUBLISH_QDN_RESOURCE")[0];
    expect(pub).toMatchObject({
      identifier: "q-store-status-order-my-shop-S3",
      name: SELLER,
      filename: "q-store-order-my-shop-S3_status.json",
    });
  });
});

describe("the seller overview", () => {
  it("counts orders by status and products, lists the latest orders, and links to the tabs", async () => {
    installMockNode(world());
    const onOpenTab = vi.fn();
    renderWithProviders(<SellerOverview storeId={STORE_ID} onOpenTab={onOpenTab} />, { store: sellerStore() });
    await waitFor(() => expect(screen.getByRole("button", { name: /3\s*To handle/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /2\s*Shipped/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\s*Refunded/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2\s*Products/ })).toBeInTheDocument();
    const latest = screen.getByRole("list", { name: "Latest orders" });
    await waitFor(() => expect(within(latest).getAllByRole("button")).toHaveLength(5));
    fireEvent.click(screen.getByRole("button", { name: /3\s*To handle/ }));
    expect(onOpenTab).toHaveBeenLastCalledWith("orders");
    fireEvent.click(screen.getByRole("button", { name: /2\s*Products/ }));
    expect(onOpenTab).toHaveBeenLastCalledWith("products");
    fireEvent.click(screen.getByRole("button", { name: "Reviews" }));
    expect(onOpenTab).toHaveBeenLastCalledWith("reviews");
  });

  it("works without tab links, and says when there are no orders", async () => {
    const w = makeWorld({ shops: 2, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
    installMockNode(w);
    renderWithProviders(<SellerOverview storeId={STORE_ID} />, { store: sellerStore() });
    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reviews" })).not.toBeInTheDocument();
  });
});
