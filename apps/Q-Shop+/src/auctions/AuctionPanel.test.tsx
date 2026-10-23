/**
 * An auction on its product page against the mock node: where it stands,
 * placing a bid (the bidder's publish), a bid that came in meanwhile, the
 * winner's checkout at the winning bid in QORT only, and the seller's view.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../test/renderWithProviders";
import { installMockNode, makeWorld, type World } from "../test/mockNode";
import { addUser } from "../state/features/authSlice";
import { createAppStore } from "../state/store";
import { base64ToJson } from "../qdn/payloads";
import { resetQdnCaches } from "../qdn/search";
import { ProductPage } from "../pages/Product/ProductPage";
import { AUCTIONS_PAID_STORAGE_KEY } from "./paid";

const STORE_ID = "q-store-general-my-shop";
const P11 = "q-store-product-my-shop-P000000011";
const CAT1 = "q-store-catalogue-my-shop-CAT0000001";
const PATH = `/Seller%20Name/${STORE_ID}/${P11}/${CAT1}`;
const PREFIX = "q-store-bid-my-shop-P000000011-";
const MIN = 60_000;
const DAY = 86_400_000;

afterEach(() => {
  vi.unstubAllGlobals();
  resetQdnCaches();
  localStorage.clear();
});

interface BidRow {
  name: string;
  identifier: string;
  created: number;
  description: string;
}

function auctionWorld(auction: Record<string, unknown>) {
  const world = makeWorld();
  const product = world.shops[0].products[11];
  world.shops[0].products[11] = { ...product, title: "Old clock", status: "OUT_OF_STOCK", price: [{ currency: "qort", value: 10 }], auction };
  return world;
}

const bid = (name: string, uid: string, amount: number, created: number): BidRow => ({ name, identifier: `${PREFIX}${uid}`, created, description: `bid:${amount};to:Seller%20Name` });

function renderAuction(world: World, bids: () => BidRow[], me: string | null = "Buyer+One") {
  const node = installMockNode(world);
  const nodeFetch = globalThis.fetch;
  const bidSearches: string[] = [];
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/arbitrary/resources/search") && url.includes(`identifier=${PREFIX}`)) {
      bidSearches.push(url);
      const rows = bids().map((b) => ({ ...b, service: "DOCUMENT", updated: b.created, size: 150, metadata: { title: "Bid", description: b.description } }));
      return { ok: true, status: 200, text: async () => JSON.stringify(rows), json: async () => rows };
    }
    return nodeFetch(input, init);
  });
  const store = createAppStore();
  if (me) store.dispatch(addUser({ address: "QAddr", publicKey: "pk", name: me }));
  const view = renderWithProviders(
    <Routes>
      <Route path="/:user/:store/:product/:catalogue" element={<ProductPage />} />
    </Routes>,
    { initialEntries: [PATH], store }
  );
  return { node, bidSearches, ...view };
}

describe("an auction on its product page", { timeout: 20_000 }, () => {
  it("shows where it stands from one search of its bids, instead of a price and Add to cart", async () => {
    const now = Date.now();
    const { bidSearches } = renderAuction(auctionWorld({ v: 1, start: now - DAY, end: now + 2 * DAY + 30 * MIN, startingBid: 10, reserve: 30, extendMinutes: 5 }), () => [
      bid("Ann", "AAA111", 12, now - 60 * MIN),
      bid("Cy", "CCC333", 15.5, now - 30 * MIN),
      // Under the step after Cy's: doesn't count.
      bid("Bob", "BBB222", 15.6, now - 20 * MIN),
    ]);
    const panel = await screen.findByRole("region", { name: "Auction" });
    expect(await within(panel).findByText("2 bids")).toBeInTheDocument();
    expect(within(panel).getByText(/^Ends in 2d/)).toBeInTheDocument();
    expect(within(panel).getByText("Current bid")).toBeInTheDocument();
    expect(within(panel).getByText("15.50")).toBeInTheDocument();
    expect(within(panel).getByText("Highest bidder: Cy.")).toBeInTheDocument();
    expect(within(panel).getByText("The reserve price isn't met yet.")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Bid 16.00 QORT" })).toBeInTheDocument();
    expect(within(panel).getByText("At least 16.00 QORT")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add to cart" })).toBeNull();
    expect(screen.queryByText(/Out of stock/)).toBeNull();
    expect(bidSearches).toHaveLength(1);
    expect(bidSearches[0]).toContain("prefix=true");
    expect(bidSearches[0]).toContain("limit=100");

    fireEvent.click(within(panel).getByRole("button", { name: "Show bids (2)" }));
    const list = within(panel).getByRole("list", { name: "Bids, newest first" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([expect.stringMatching(/^Cy15\.50 QORT/), expect.stringMatching(/^Ann12\.00 QORT/)]);
    expect(within(panel).getByText(/1 more bid doesn't count/)).toBeInTheDocument();
  });

  it("places a bid as a document under the bidder's name, after reading the latest bids", async () => {
    const now = Date.now();
    const world = auctionWorld({ v: 1, start: now - DAY, end: now + DAY, startingBid: 10, extendMinutes: 5 });
    const { node, bidSearches } = renderAuction(world, () => [bid("Ann", "AAA111", 12, now - 60 * MIN)]);
    node.q.on("PUBLISH_QDN_RESOURCE", async () => ({ signature: "sig" }));
    const panel = await screen.findByRole("region", { name: "Auction" });
    fireEvent.change(await within(panel).findByRole("textbox", { name: "Your bid" }), { target: { value: "14" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Bid 14.00 QORT" }));
    expect(await within(panel).findByText("Bid placed: 14.00 QORT.")).toBeInTheDocument();
    expect(within(panel).getByText(/Your bid of 14\.00 QORT is on its way/)).toBeInTheDocument();
    // The page's read, then a fresh one just before the publish.
    expect(bidSearches).toHaveLength(2);
    const [publish] = node.q.callsFor("PUBLISH_QDN_RESOURCE");
    expect(publish).toMatchObject({ name: "Buyer+One", service: "DOCUMENT", filename: "bid.json", title: "Bid", description: "bid:14;to:Seller%20Name" });
    expect(String(publish.identifier)).toMatch(new RegExp(`^${PREFIX}[A-Za-z0-9]{6}$`));
    expect(base64ToJson(String(publish.data64))).toMatchObject({ v: 1, productId: P11, storeId: STORE_ID, seller: "Seller Name", amount: 14, coin: "QORT" });
  });

  it("doesn't publish a bid someone has beaten meanwhile, and says the least it can be now", async () => {
    const now = Date.now();
    const rows = [bid("Ann", "AAA111", 12, now - 60 * MIN)];
    const { node } = renderAuction(auctionWorld({ v: 1, start: now - DAY, end: now + DAY, startingBid: 10, extendMinutes: 5 }), () => rows);
    const panel = await screen.findByRole("region", { name: "Auction" });
    const button = await within(panel).findByRole("button", { name: "Bid 12.50 QORT" });
    rows.push(bid("Cy", "CCC333", 20, now - MIN));
    fireEvent.click(button);
    expect(await within(panel).findByText("Someone bid meanwhile: the least you can bid now is 20.50 QORT.")).toBeInTheDocument();
    expect(node.q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(0);
    expect(await within(panel).findByText("Highest bidder: Cy.")).toBeInTheDocument();
  });

  it("lets the winner pay the winning bid through checkout, in QORT only, once the result is confirmed", async () => {
    const now = Date.now();
    renderAuction(auctionWorld({ v: 1, start: now - 3 * DAY, end: now - DAY, startingBid: 10, extendMinutes: 5 }), () => [
      bid("Ann", "AAA111", 12, now - 2 * DAY),
      bid("Buyer+One", "MINE01", 15.5, now - 2 * DAY + MIN),
    ]);
    const panel = await screen.findByRole("region", { name: "Auction" });
    expect(await within(panel).findByText(/You won! Pay 15\.50 QORT to Seller Name/)).toBeInTheDocument();
    expect(within(panel).getByText("Winning bid")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Pay 15.50 QORT" }));
    const dialog = await screen.findByRole("dialog", { name: "Review your order" });
    expect(within(dialog).getByText("Old clock")).toBeInTheDocument();
    // The shop also takes ARRR; an auction is paid in QORT.
    expect(within(dialog).queryByText("ARRR")).toBeNull();
    await waitFor(() => expect(within(dialog).getAllByText("15.50").length).toBeGreaterThan(0));
  });

  it("tells a winner who paid from here where the order is, and others who won", async () => {
    const now = Date.now();
    const rows = [bid("Buyer+One", "MINE01", 15.5, now - 2 * DAY)];
    localStorage.setItem(AUCTIONS_PAID_STORAGE_KEY, JSON.stringify({ [P11]: { bid: `${PREFIX}MINE01`, at: now } }));
    const terms = { v: 1, start: now - 3 * DAY, end: now - DAY, startingBid: 10, extendMinutes: 5 };
    const first = renderAuction(auctionWorld(terms), () => rows);
    expect(await screen.findByText("You won this auction and paid for it. Follow the order in My orders.")).toBeInTheDocument();
    first.unmount();
    resetQdnCaches();
    renderAuction(auctionWorld(terms), () => rows, "Someone Else");
    expect(await screen.findByText("Won by Buyer+One for 15.50 QORT.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pay/ })).toBeNull();
  });

  it("shows the seller who won, with a message link, and never a bid form", async () => {
    const now = Date.now();
    renderAuction(auctionWorld({ v: 1, start: now - 3 * DAY, end: now - DAY, startingBid: 10, extendMinutes: 5 }), () => [bid("Ann", "AAA111", 12, now - 2 * DAY)], "Seller Name");
    expect(await screen.findByText(/Ann won it for 12\.00 QORT/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute("href", "qortal://APP/Q-Mail/to/Ann");
    expect(screen.queryByRole("textbox", { name: "Your bid" })).toBeNull();
  });

  it("prices Buy now at the least bid allowed once a bid just under it leads", async () => {
    const now = Date.now();
    renderAuction(auctionWorld({ v: 1, start: now - DAY, end: now + DAY, startingBid: 10, buyNow: 80, extendMinutes: 5 }), () => [bid("Ann", "AAA111", 79.8, now - MIN)]);
    const panel = await screen.findByRole("region", { name: "Auction" });
    expect(await within(panel).findByRole("button", { name: "Buy now for 80.30 QORT" })).toBeInTheDocument();
    // A typed bid over it buys it at that price.
    fireEvent.change(within(panel).getByRole("textbox", { name: "Your bid" }), { target: { value: "95" } });
    expect(within(panel).getByRole("button", { name: "Bid 80.30 QORT" })).toBeInTheDocument();
  });

  it("says when an upcoming auction opens, and takes no bids before", async () => {
    const now = Date.now();
    renderAuction(auctionWorld({ v: 1, start: now + 3 * 3_600_000 + 5 * MIN, end: now + 2 * DAY, startingBid: 10, extendMinutes: 5 }), () => []);
    const panel = await screen.findByRole("region", { name: "Auction" });
    expect(within(panel).getByText(/^Starts in 3h/)).toBeInTheDocument();
    expect(within(panel).getByText("Bidding opens when the auction starts.")).toBeInTheDocument();
    expect(await within(panel).findByText("No bids yet")).toBeInTheDocument();
    expect(within(panel).getByText("Starting bid")).toBeInTheDocument();
    expect(within(panel).queryByRole("textbox", { name: "Your bid" })).toBeNull();
  });
});
