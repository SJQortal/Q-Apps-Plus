/**
 * Counts the Qortal calls each main screen makes on first load, against the
 * mock node (24 shops of 12 products, signed in as a buyer who owns no
 * shop, and as the owner of "my-shop"). The numbers go into the brief's
 * before/after table; the assertions guard the efficiency rules
 * (docs/QORTAL.md): no unlimited search, bounded searches and fetches.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
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

/**
 * The home page on a screen that shows its first `cards` shop cards: only
 * elements inside those cards are reported in view, so the end of the list
 * (and its "load more") stays below the fold, as on a real first load.
 */
const CARDS_IN_VIEW = 6;

function installFirstCardsInView(cards: number): void {
  class FirstCardsObserver {
    private cb: IntersectionObserverCallback;
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [0];
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
    }
    observe(el: Element) {
      queueMicrotask(() => {
        const card = el.closest("[data-shop-card]");
        const index = card ? [...document.querySelectorAll("[data-shop-card]")].indexOf(card) : -1;
        const inView = index >= 0 && index < cards;
        this.cb([{ isIntersecting: inView, intersectionRatio: inView ? 1 : 0, target: el } as unknown as IntersectionObserverEntry], this as any);
      });
    }
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FirstCardsObserver);
}

async function loadHome(world = makeWorld()): Promise<MockNode> {
  vi.resetModules();
  installFirstCardsInView(CARDS_IN_VIEW);
  const node = installMockNode(world);
  const { default: App } = await import("../App");
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>
  );
  // The lazy route can take a while under a busy test run: wait for the cards, then for what they ask.
  await waitFor(() => expect(document.querySelectorAll("[data-shop-card]").length).toBeGreaterThan(0), { timeout: 10_000 });
  await settle();
  return node;
}

const total = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

// The first import of the whole app compiles every module; on a busy machine
// that alone took over 5 s and timed out whichever case ran first. Compile it
// here, with room to spare, so each case measures only its own load.
beforeAll(async () => {
  await import("../App");
  await import("../pages/StoreList/StoreList");
  await import("../pages/Store/Store/Store");
}, 60_000);

describe("first load", () => {
  // Before night 1: 2 STORE searches (limit 20, no metadata) and all 20 shop
  // JSONs, logos included, before any card showed.
  it("home, signed in as a buyer", async () => {
    const node = await loadHome();
    const s = report("home (buyer)", node);
    expect(s.unlimitedSearches).toBe(0);
    // The own-shops search and the shop index; no product-index or reviews search until a sort asks.
    expect(total(s.searches)).toBeLessThanOrEqual(2);
    expect(s.searches).toEqual({ STORE: 2 });
    // Shop JSONs (logos) only for the cards on screen.
    expect(s.resources.STORE ?? 0).toBeGreaterThan(0);
    expect(s.resources.STORE ?? 0).toBeLessThanOrEqual(CARDS_IN_VIEW);
    expect(s.resources["data container"] ?? 0).toBe(0);
    // Every card is there at once, from the index's metadata.
    expect(document.querySelectorAll("[data-shop-card]")).toHaveLength(20);
  }, 20_000);

  it("home, signed in as a shop owner", async () => {
    const world = makeWorld({ me: { name: "Seller Name", address: "QSeLLeR", publicKey: "SellerPK" } });
    const node = await loadHome(world);
    const s = report("home (owner)", node);
    expect(s.unlimitedSearches).toBe(0);
    expect(total(s.searches)).toBeLessThanOrEqual(2);
    expect(s.searches).toEqual({ STORE: 2 });
    // The cards on screen, plus the owner's own shop (and its product index) for the seller pages.
    expect(s.resources.STORE ?? 0).toBeLessThanOrEqual(CARDS_IN_VIEW + 1);
    expect(s.resources["data container"] ?? 0).toBeLessThanOrEqual(1);
  }, 20_000);

  // The original sent 4 searches here, 2 of them unlimited (one with limit 0
  // only to learn whether the product index exists).
  it("a shop page, as a buyer", async () => {
    const node = await loadAt("/Seller%20Name/q-store-general-my-shop");
    const s = report("shop (buyer)", node);
    expect(s.unlimitedSearches).toBe(0);
    const searches = Object.values(s.searches).reduce((a, b) => a + b, 0);
    expect(searches).toBeLessThanOrEqual(4);
    // The shop and its product index once each, and one fetch per catalogue on screen (12 products: 2).
    expect(s.resources.STORE).toBe(1);
    expect(s.resources["data container"]).toBe(1);
    expect(s.resources.DOCUMENT).toBe(2);
    expect(s.hub.SEARCH_QDN_RESOURCES ?? 0).toBe(0);
  }, 20_000);
});
