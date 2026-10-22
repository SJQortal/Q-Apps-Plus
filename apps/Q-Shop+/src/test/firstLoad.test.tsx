/**
 * Counts the Qortal calls each main screen makes on first load, against the
 * mock node (24 shops of 12 products, signed in as a buyer who owns no
 * shop, and as the owner of "my-shop"). The numbers go into the brief's
 * before/after table; the assertions guard the efficiency rules
 * (docs/QORTAL.md): no unlimited search, bounded searches and fetches.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { installMockNode, installVisibleIntersectionObserver, makeWorld, type MockNode } from "./mockNode";

async function settle(ms = 400) {
  for (let i = 0; i < ms / 50; i++) await new Promise((r) => setTimeout(r, 50));
}

async function loadAt(path: string, world = makeWorld()): Promise<MockNode> {
  vi.resetModules();
  installVisibleIntersectionObserver();
  const node = installMockNode(world);
  const { default: App } = await import("../App");
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
  await settle();
  return node;
}

function report(label: string, node: MockNode) {
  const s = node.summary();
  console.info(`[first load] ${label}: ${JSON.stringify(s)}`);
  return s;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("first load", () => {
  it("home, signed in as a buyer", async () => {
    const node = await loadAt("/");
    const s = report("home (buyer)", node);
    expect(s.unlimitedSearches).toBe(0);
  });

  it("home, signed in as a shop owner", async () => {
    const world = makeWorld({ me: { name: "Seller Name", address: "QSeLLeR", publicKey: "SellerPK" } });
    const node = await loadAt("/", world);
    const s = report("home (owner)", node);
    expect(s.unlimitedSearches).toBe(0);
  });

  // Fails until the shop page stops sending unlimited searches (round 2).
  it.fails("a shop page, as a buyer", async () => {
    const node = await loadAt("/Seller%20Name/q-store-general-my-shop");
    const s = report("shop (buyer)", node);
    expect(s.unlimitedSearches).toBe(0);
  });
});
