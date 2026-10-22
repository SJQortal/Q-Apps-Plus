/**
 * The whole app's calls on a first load of My orders, against the mock node
 * (a buyer with 25 orders at two shops, three with a status). The numbers
 * go into the brief; the assertions guard the order reads: one search per
 * page of orders and one for their statuses, never unlimited, each order
 * opened once, the buyer's key looked up once.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { installMockNode, makeWorld } from "../../test/mockNode";
import { BUYER, BUYER_ADDRESS, SELLER } from "../../test/fixtures/shop";
import { addOrder, addStatus, OTHER_SELLER, OTHER_SHORT } from "../../orders/testing";

vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  vi.unstubAllGlobals();
});

async function settle(ms = 800) {
  for (let i = 0; i < ms / 50; i++) await new Promise((r) => setTimeout(r, 50));
}

describe("first load of My orders", () => {
  it("reads a page of orders and their statuses in two searches", async () => {
    vi.resetModules();
    const world = makeWorld({ shops: 2, me: { name: BUYER, address: BUYER_ADDRESS, publicKey: "BuyerPK" } });
    for (let i = 0; i < 25; i++) {
      const uid = `O${String(i).padStart(2, "0")}`;
      if (i % 2) addOrder(world, uid, 1000 + i, { short: OTHER_SHORT, seller: OTHER_SELLER });
      else addOrder(world, uid, 1000 + i);
    }
    addStatus(world, "O24", "Shipped");
    addStatus(world, "O22", "Refunded");
    addStatus(world, "O23", "Shipped", "", { seller: OTHER_SELLER, short: OTHER_SHORT });
    const node = installMockNode(world);
    const { default: App } = await import("../../App");
    const { resetOrderReadCaches } = await import("../../orders/reads");
    resetOrderReadCaches();
    render(
      <MemoryRouter initialEntries={["/my-orders"]}>
        <App />
      </MemoryRouter>
    );
    await vi.waitFor(() => expect(node.summary().hub["FETCH q-store-status"]).toBe(3), { timeout: 20_000, interval: 100 });
    await settle();
    const s = node.summary();
    console.info(`[first load] my orders (buyer, 25 orders): ${JSON.stringify(s)}`);
    const orderSearches = node.fetchCalls.filter((u) => u.startsWith("/arbitrary/resources/search") && u.includes("service=DOCUMENT_PRIVATE"));
    expect(orderSearches).toHaveLength(2);
    expect(s.unlimitedSearches).toBe(0);
    expect(s.hub["FETCH q-store-order"]).toBe(20);
    expect(s.hub.DECRYPT_DATA).toBe(23);
    // GET_NAME_DATA: once for the buyer's key (statuses); the shell asks for nothing else here.
    expect(node.q.callsFor("GET_NAME_DATA").filter((c) => c.name === BUYER)).toHaveLength(1);
    expect(node.q.callsFor("GET_NAME_DATA").filter((c) => c.name === SELLER)).toHaveLength(0);
  });
});
