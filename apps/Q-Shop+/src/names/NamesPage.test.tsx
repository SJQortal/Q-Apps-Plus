import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within, configure } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../test/renderWithProviders";
import { installVisibleIntersectionObserver } from "../test/mockNode";
import { installQortalMock, type QortalMock } from "../test/qortalMock";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { resetQdnCaches } from "../qdn/search";
import { resetShowNames, setShowNames } from "../utils/namesSetting";
import { decodeData64 } from "../test/fixtures/shop";
import { NamesPage } from "./NamesPage";
import { resetNameCaches } from "./market";
import { resetPendingNames } from "./actions";
import { auctionDescription, NAME_AUCTION_ID } from "./auctions";

vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

const SELLER = "QSeLLerAddressxxxxxxxxxxxx9f3c2a";
const ME = "QBuyerAddressxxxxxxxxxxxxxx7b1d0e";
let q: QortalMock;
let auctionRows: unknown[] = [];

function stubNode() {
  const now = Date.now();
  auctionRows = [
    {
      name: "spare",
      service: "DOCUMENT",
      identifier: NAME_AUCTION_ID,
      created: now - 60_000,
      metadata: { description: auctionDescription("AUCxxxx1", SELLER, { v: 1, start: now - 3_600_000, end: now + 86_400_000, startingBid: 5, extendMinutes: 5 }) },
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(String(input), "http://node");
      const p = url.searchParams;
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
      if (url.pathname === "/names/forsale") {
        return ok(
          Number(p.get("offset")) > 0
            ? []
            : [
                { name: "alpha", owner: SELLER, salePrice: "12.50000000", isForSale: true, registered: 1600000000000 },
                { name: "zed", owner: SELLER, salePrice: "3.00000000", isForSale: true },
              ]
        );
      }
      if (url.pathname === "/transactions/search") return ok([{ name: "zed", timestamp: now - 1000 }, { name: "alpha", timestamp: now - 9000 }]);
      if (url.pathname.startsWith("/names/primary/")) return ok({ name: url.pathname.endsWith(ME) ? "Buyer" : "Seller One" });
      if (url.pathname.startsWith("/names/")) {
        const name = decodeURIComponent(url.pathname.slice("/names/".length));
        return ok({ name, owner: SELLER, isForSale: name !== "spare", salePrice: name === "alpha" ? "12.5" : name === "zed" ? "3" : null });
      }
      if (url.pathname === "/arbitrary/resources/search") {
        if (p.get("identifier") === NAME_AUCTION_ID) return ok(auctionRows);
        if (p.get("identifier")?.startsWith("q-store-namebid-")) return ok([]);
        const name = p.get("name");
        if (name === "alpha" && !p.get("service")) {
          return ok([
            { name: "alpha", service: "WEBSITE", identifier: "default" },
            { name: "alpha", service: "VIDEO", identifier: "v1" },
            { name: "alpha", service: "VIDEO", identifier: "v2" },
            { name: "alpha", service: "VIDEO", identifier: "v3" },
          ]);
        }
        return ok([]);
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
    })
  );
}

function renderNames(signedIn = true) {
  const store = createAppStore();
  if (signedIn) store.dispatch(addUser({ address: ME, publicKey: "pk", name: "Buyer", names: [{ name: "Buyer", owner: ME }, { name: "spare2", owner: ME }] }));
  renderWithProviders(
    <Routes>
      <Route path="/names" element={<NamesPage />} />
      <Route path="/settings" element={<p>Settings page</p>} />
    </Routes>,
    { store, initialEntries: ["/names"] }
  );
  return store;
}

const cardNames = () =>
  within(screen.getByRole("list", { name: "Names for sale" }))
    .getAllByRole("article")
    .map((a) => a.getAttribute("aria-label"));

beforeEach(() => {
  installVisibleIntersectionObserver();
  resetQdnCaches();
  resetNameCaches();
  resetPendingNames();
  resetShowNames();
  localStorage.clear();
  stubNode();
  q = installQortalMock({
    BUY_NAME: async () => ({ signature: "SIG" }),
    SELL_NAME: async () => ({ signature: "SIG" }),
    GET_ACCOUNT_NAMES: async () => [{ name: "Buyer" }, { name: "spare2" }],
    PUBLISH_QDN_RESOURCE: async () => true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Names", () => {
  it("lists names for sale and name auctions as cards, newest first, with who sells them", async () => {
    renderNames();
    // Newest listed first: zed and alpha by their SELL_NAME transactions, the auction by its listing.
    await waitFor(() => expect(cardNames()).toEqual(["zed", "alpha", "spare"]));
    const alpha = screen.getByRole("article", { name: "alpha" });
    expect(within(alpha).getByText("12.50")).toBeInTheDocument();
    expect(await within(alpha).findByText("by Seller One")).toBeInTheDocument();
    const spare = screen.getByRole("article", { name: "spare" });
    expect(within(spare).getByText("Auction")).toBeInTheDocument();
    expect(within(spare).getByRole("button", { name: "Bid: spare" })).toBeInTheDocument();
    // Filters, search and sorts.
    fireEvent.click(screen.getByRole("button", { name: "Auctions (1)" }));
    expect(cardNames()).toEqual(["spare"]);
    fireEvent.click(screen.getByRole("button", { name: "Buy now" }));
    expect(cardNames()).toEqual(["zed", "alpha"]);
    fireEvent.change(screen.getByRole("textbox", { name: "Search names" }), { target: { value: "alp" } });
    expect(cardNames()).toEqual(["alpha"]);
  });

  it("buys a name at its price: what comes with it in the explorer, then BUY_NAME as the Names app asks it", async () => {
    renderNames();
    fireEvent.click(await screen.findByRole("button", { name: "Buy: alpha" }));
    const dialog = await screen.findByRole("dialog", { name: "alpha" });
    // What it comes with is the owner's account in Q-Mintership+'s explorer, not a read of everything it published.
    expect(within(dialog).getByRole("link", { name: /^See what it published/ })).toHaveAttribute("href", `qortal://APP/Q-Mintership+/explorer/account/${SELLER}`);
    const searched = vi.mocked(fetch).mock.calls.map(([input]) => new URL(String(input), "http://node"));
    expect(searched.some((url) => url.pathname === "/arbitrary/resources/search" && url.searchParams.get("name") === "alpha" && !url.searchParams.get("identifier"))).toBe(false);
    fireEvent.click(await within(dialog).findByRole("button", { name: "Buy for 12.50 QORT" }));
    expect(within(dialog).getByText(/Buy alpha for 12\.50 QORT\? It moves to your account/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Buy" }));
    await waitFor(() => expect(q.callsFor("BUY_NAME")).toEqual([{ action: "BUY_NAME", nameForSale: "alpha" }]));
    expect(await within(dialog).findByText(/alpha is yours once the next block confirms it/)).toBeInTheDocument();
  });

  it("sells one of the viewer's names at a price; the primary name can't be sold while there are others", async () => {
    renderNames();
    fireEvent.click(await screen.findByRole("button", { name: "Sell a name" }));
    const dialog = await screen.findByRole("dialog", { name: "Sell a name" });
    expect(await within(dialog).findByRole("radio", { name: /Buyer/ })).toBeDisabled();
    expect(within(dialog).getByText("your primary name: sell your other names first")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: /spare2/ })).toBeChecked();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Price" }), { target: { value: "7" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "List it for sale" }));
    await waitFor(() => expect(q.callsFor("SELL_NAME")).toEqual([{ action: "SELL_NAME", nameForSale: "spare2", salePrice: 7 }]));
    expect(await screen.findByText(/spare2 is for sale at 7\.00 QORT once the next block confirms it/)).toBeInTheDocument();
  });

  it("lists my names compactly, the primary one without Sell, and searches them when there are over 20", async () => {
    const many = ["Buyer", ...Array.from({ length: 24 }, (_, i) => `name${String(i + 1).padStart(2, "0")}`)];
    q.on("GET_ACCOUNT_NAMES", async () => many.map((name) => ({ name })));
    renderNames();
    fireEvent.click(await screen.findByRole("button", { name: "My names" }));
    const list = await screen.findByRole("list", { name: "My names" });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(25));
    expect(within(list).getByText("Sell your other names first")).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: "Sell Buyer" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your names" }), { target: { value: "name1" } });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("10 names match")).toBeInTheDocument();
  });

  it("sells one of many names from its card: the name chosen in a list to search, a missing price said at the field", async () => {
    const many = ["Buyer", ...Array.from({ length: 8 }, (_, i) => `name${i + 1}`)];
    q.on("GET_ACCOUNT_NAMES", async () => many.map((name) => ({ name })));
    renderNames();
    fireEvent.click(await screen.findByRole("button", { name: "My names" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sell name3" }));
    const dialog = await screen.findByRole("dialog", { name: "Sell a name" });
    // Not nine radio buttons: one field, with the card's name in it.
    expect(within(dialog).queryAllByRole("radio")).toHaveLength(0);
    expect(within(dialog).getByRole("combobox", { name: /^Name/ })).toHaveValue("name3");
    fireEvent.click(within(dialog).getByRole("button", { name: "List it for sale" }));
    const price = within(dialog).getByRole("textbox", { name: "Price" });
    expect(await within(dialog).findByText("Type the price in QORT.")).toBeInTheDocument();
    expect(price).toHaveFocus();
    expect(q.callsFor("SELL_NAME")).toHaveLength(0);
    fireEvent.change(price, { target: { value: "15" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "List it for sale" }));
    await waitFor(() => expect(q.callsFor("SELL_NAME")).toEqual([{ action: "SELL_NAME", nameForSale: "name3", salePrice: 15 }]));
  });

  it("starts an auction of a name, published under the name itself", async () => {
    renderNames();
    fireEvent.click(await screen.findByRole("button", { name: "Sell a name" }));
    const dialog = await screen.findByRole("dialog", { name: "Sell a name" });
    await within(dialog).findByRole("radio", { name: /spare2/ });
    fireEvent.click(within(dialog).getByRole("button", { name: "Auction" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Starting bid" }), { target: { value: "10" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Start the auction" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const publish = q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any;
    expect(publish).toMatchObject({ name: "spare2", service: "DOCUMENT", identifier: NAME_AUCTION_ID, title: "Name auction" });
    expect(publish.description).toMatch(new RegExp(`^nameauc:[A-Za-z0-9]{8};s:\\d+;e:\\d+;b:10;x:5;o:${ME}$`));
    expect(decodeData64(publish.data64)).toMatchObject({ v: 1, name: "spare2", owner: ME, terms: { startingBid: 10, extendMinutes: 5 } });
  });

  it("bids on a name auction under the viewer's name", async () => {
    renderNames();
    fireEvent.click(await screen.findByRole("button", { name: "Bid: spare" }));
    const dialog = await screen.findByRole("dialog", { name: "spare" });
    fireEvent.change(await within(dialog).findByRole("textbox", { name: "Your bid" }), { target: { value: "6" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Place bid" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const bid = q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any;
    expect(bid.identifier).toMatch(/^q-store-namebid-AUCxxxx1-[A-Za-z0-9]{6}$/);
    expect(bid).toMatchObject({ name: "Buyer", description: "bid:6;to:spare" });
    expect(await within(dialog).findByText("Bid placed: 6.00 QORT.")).toBeInTheDocument();
  });

  it("is hidden when Settings turns names off", async () => {
    setShowNames(false);
    renderNames();
    expect(screen.getByText("Names for sale are hidden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(await screen.findByText("Settings page")).toBeInTheDocument();
  });
});
