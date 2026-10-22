/**
 * The reviews panel and the review dialog: summary, list, "Ordered here",
 * who may review, Read more, and what happens around the (pinned) publish.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createAppStore } from "../../../state/store";
import { addUser } from "../../../state/features/authSlice";
import { addToReviews } from "../../../state/features/storeSlice";
import { installMockNode, makeWorld, type World } from "../../../test/mockNode";
import { installQortalMock } from "../../../test/qortalMock";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { BUYER, BUYER_ADDRESS, BUYER_PK, STORE_ID } from "../../../test/fixtures/shop";
import { setPeerRetryDelaysForTests } from "../peerRetry";
import { ReviewsPanel } from "./ReviewsPanel";
import { AddReview } from "./AddReview/AddReview";

let restore: (() => void) | null = null;
beforeEach(() => {
  restore = setPeerRetryDelaysForTests([10, 10, 10]);
});
afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function worldWithReviews(): World {
  const world = makeWorld();
  world.reviews.push(
    // The owner's own review doesn't count.
    { name: "Seller Name", shortStoreId: "my-shop", uid: "OWNERxxxx1", rating: 5, title: "Mine", description: "My shop", created: 1700000600000 },
    // A later review by Reviewer 0 replaces their first.
    { name: "Reviewer 0", shortStoreId: "my-shop", uid: "LATERxxxx1", rating: 1, title: "Changed my mind", description: "x".repeat(150), created: 1700000700000 },
    // Another shop whose id starts the same.
    { name: "Reviewer 9", shortStoreId: "my-shop-2", uid: "OTHERxxxx1", rating: 1, title: "Other", description: "Other shop", created: 1700000800000 }
  );
  world.orders.push({ identifier: "q-store-order-my-shop-ORDERxxxx1", buyer: "Reviewer 1", created: 1, json: {} });
  world.orders.push({ identifier: "q-store-order-my-shop-2-ORDERxxxx2", buyer: "Reviewer 2", created: 2, json: {} });
  return world;
}

function renderPanel(world: World, me: string | null) {
  const node = installMockNode(world);
  const store = createAppStore();
  if (me) store.dispatch(addUser({ address: "QAddr", publicKey: "pk", name: me }));
  const view = renderWithProviders(
    <ReviewsPanel storeId={STORE_ID} storeTitle="Seller's Shop" storeImage="" storeOwner="Seller Name" />,
    { store }
  );
  return { node, ...view };
}

describe("reviews panel", { timeout: 20_000 }, () => {
  it("summarises and lists one review per reviewer, newest first, without the owner's or another shop's", async () => {
    renderPanel(worldWithReviews(), null);
    const list = await screen.findByRole("region", { name: "Reviews" });
    await waitFor(() => expect(within(list).getAllByRole("article")).toHaveLength(6));
    const names = within(list).getAllByRole("article").map((a) => a.querySelector("p")?.textContent);
    expect(names[0]).toBe("Reviewer 0");
    expect(within(list).queryByText("Mine")).toBeNull();
    expect(within(list).queryByText("Other")).toBeNull();
    expect(within(list).getByText("Changed my mind")).toBeInTheDocument();
    // 1, 3.5, 4, 3, 3.5, 4 → 3.2
    expect(screen.getByText("3.2")).toBeInTheDocument();
    expect(screen.getByText("6 reviews")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "4 stars: 4 reviews" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "1 star: 1 review" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to review this shop.")).toBeInTheDocument();
  });

  it("marks reviewers with an order at the shop from one order search, without claiming more", async () => {
    const { node } = renderPanel(worldWithReviews(), null);
    await waitFor(() => expect(screen.getAllByText("Ordered here")).toHaveLength(1));
    // An order identifier is all that is checked: anyone can publish one, so it isn't "verified".
    expect(screen.queryByText(/verified/i)).toBeNull();
    const article = screen.getByText("Ordered here").closest("article")!;
    expect(within(article).getByText("Reviewer 1")).toBeInTheDocument();
    const orderSearches = node.fetchCalls.filter((u) => u.includes("service=DOCUMENT_PRIVATE"));
    expect(orderSearches).toHaveLength(1);
    const params = new URLSearchParams(orderSearches[0].split("?")[1]);
    expect(params.get("identifier")).toBe("q-store-order-my-shop-");
    expect(params.get("prefix")).toBe("true");
    expect(params.getAll("name").sort()).toEqual(["Reviewer 0", "Reviewer 1", "Reviewer 2", "Reviewer 3", "Reviewer 4", "Reviewer 5"]);
  });

  it("keeps an Ordered here answer that lands after the panel re-rendered", async () => {
    const world = worldWithReviews();
    const { store, node } = renderPanel(world, null);
    const realFetch = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("service=DOCUMENT_PRIVATE")) await gate;
        return realFetch(url);
      })
    );
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(6));
    // Something else changes the list while the order search is out.
    store.dispatch(addToReviews({ id: "q-store-review-other-shop-ZZZZZZZZZZ-50", name: "Elsewhere", created: 1, title: "x", description: "y", rating: 5 }));
    release();
    await waitFor(() => expect(screen.getAllByText("Ordered here")).toHaveLength(1));
    expect(node.fetchCalls.filter((u) => u.includes("service=DOCUMENT_PRIVATE"))).toHaveLength(1);
  });

  it("reads the full review on Read more", async () => {
    const world = worldWithReviews();
    renderPanel(world, null);
    const button = await screen.findByRole("button", { name: "Read more" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Read more" })).toBeNull());
    expect(screen.getByText("x".repeat(150))).toBeInTheDocument();
  });

  it("never shows another name's copy, published under the same identifier, as the reviewer's text", async () => {
    const world = worldWithReviews();
    // Mallory publishes under Reviewer 0's exact review identifier.
    world.reviews.push({
      name: "Mallory",
      shortStoreId: "my-shop",
      uid: "LATERxxxx1",
      rating: 1,
      title: "Fake title",
      description: "y".repeat(150),
      created: 1700000750000,
    });
    const error = vi.spyOn(console, "error");
    renderPanel(world, null);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(7));
    const articleOf = (name: string) => screen.getAllByRole("article").find((a) => within(a).queryByText(name))!;
    fireEvent.click(within(articleOf("Mallory")).getByRole("button", { name: "Read more" }));
    await waitFor(() => expect(within(articleOf("Mallory")).queryByRole("button", { name: "Read more" })).toBeNull());
    const genuine = articleOf("Reviewer 0");
    expect(within(genuine).getByText("Changed my mind")).toBeInTheDocument();
    expect(within(genuine).queryByText("Fake title")).toBeNull();
    expect(within(genuine).getByRole("button", { name: "Read more" })).toBeInTheDocument();
    // One key per reviewer and identifier.
    expect(error.mock.calls.some((args) => String(args[0]).includes("same key"))).toBe(false);
  });

  it("keeps the short copy when a full review's title isn't text", async () => {
    const world = worldWithReviews();
    installMockNode(world);
    const realFetch = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    const body = { title: { a: 1 }, description: "The whole story", rating: 1, created: 1700000700000 };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/arbitrary/DOCUMENT/Reviewer%200/q-store-review-my-shop-LATERxxxx1-10"
          ? { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body }
          : realFetch(url)
      )
    );
    renderWithProviders(<ReviewsPanel storeId={STORE_ID} storeTitle="Seller's Shop" storeImage="" storeOwner="Seller Name" />);
    fireEvent.click(await screen.findByRole("button", { name: "Read more" }));
    expect(await screen.findByText("The whole story")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Changed my mind" })).toBeInTheDocument();
  });

  it("lets a buyer with an order write a review, and nobody else", async () => {
    const world = worldWithReviews();
    renderPanel(world, "Reviewer 1");
    expect(await screen.findByRole("button", { name: "Write a new review" })).toBeInTheDocument();
    expect(screen.getByText("Your latest review replaces your earlier one.")).toBeInTheDocument();
  });

  it("refuses a name whose only order is at another shop with a similar id", async () => {
    const { node } = renderPanel(worldWithReviews(), "Reviewer 2");
    expect(await screen.findByText("Only buyers with an order from this shop can review it.")).toBeInTheDocument();
    const check = node.fetchCalls.find((u) => u.includes("service=DOCUMENT_PRIVATE") && new URLSearchParams(u.split("?")[1]).getAll("name").length === 1)!;
    const params = new URLSearchParams(check.split("?")[1]);
    expect(params.get("name")).toBe("Reviewer 2");
    expect(params.get("exactmatchnames")).toBe("true");
    expect(Number(params.get("limit"))).toBeGreaterThan(0);
  });

  it("doesn't offer the owner a review of their own shop", async () => {
    renderPanel(worldWithReviews(), "Seller Name");
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(6));
    expect(screen.queryByRole("button", { name: /Write a/ })).toBeNull();
    expect(screen.queryByText(/Only buyers/)).toBeNull();
  });

  it("says when there are no reviews yet", async () => {
    const world = makeWorld();
    world.reviews = [];
    renderPanel(world, null);
    expect(await screen.findByText("No reviews yet")).toBeInTheDocument();
  });
});

describe("review dialog", { timeout: 20_000 }, () => {
  function renderDialog(handlers: Parameters<typeof installQortalMock>[0]) {
    const q = installQortalMock(handlers);
    const store = createAppStore();
    store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: BUYER_PK, name: BUYER }));
    const onClose = vi.fn();
    renderWithProviders(<AddReview open storeId={STORE_ID} storeTitle="Shop" onClose={onClose} />, { store });
    return { q, store, onClose };
  }
  function fill() {
    fireEvent.click(screen.getByLabelText("4 Stars"));
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Good" } });
    fireEvent.change(screen.getByLabelText(/^Your review/), { target: { value: "Arrived fast" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish review" }));
  }

  it("asks for a rating, a title and the review before publishing anything", async () => {
    const { q } = renderDialog({});
    fireEvent.click(screen.getByRole("button", { name: "Publish review" }));
    expect(await screen.findByText("Pick a rating.")).toBeInTheDocument();
    expect(screen.getByText("Add a title.")).toBeInTheDocument();
    expect(screen.getByText("Write your review.")).toBeInTheDocument();
    expect(q.calls).toHaveLength(0);
  });

  it("offers no Close or Back while the publish runs, then closes as usual", async () => {
    let decline: () => void = () => {};
    const { q, onClose } = renderDialog({
      LIST_QDN_RESOURCES: async () => ({ resources: [] }),
      PUBLISH_QDN_RESOURCE: () => new Promise((_resolve, reject) => (decline = () => reject({ error: "User declined request" }))),
    });
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    fill();
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Publishing…" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    decline();
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("treats a declined publish as a cancel: no error, the dialog stays", async () => {
    const { q, onClose } = renderDialog({
      LIST_QDN_RESOURCES: async () => ({ resources: [] }),
      PUBLISH_QDN_RESOURCE: async () => Promise.reject({ error: "User declined request" }),
    });
    fill();
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish review" })).toBeInTheDocument());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("after a timeout, checks QDN and counts a review that landed as published", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => [{ name: BUYER, service: "DOCUMENT", identifier: new URLSearchParams(url.split("?")[1]).get("identifier") }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { q, store, onClose } = renderDialog({
      LIST_QDN_RESOURCES: async () => ({ resources: [] }),
      PUBLISH_QDN_RESOURCE: async () => Promise.reject("The request timed out"),
    });
    fill();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("prefix=true");
    expect(store.getState().store.storeReviews[0].title).toBe("Good");
  });

  it("after a timeout that didn't land, says so; a retry that then finds it doesn't publish again", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })));
    let listed = false;
    const { q, onClose } = renderDialog({
      LIST_QDN_RESOURCES: async () => ({ resources: listed ? [{}] : [] }),
      PUBLISH_QDN_RESOURCE: async () => Promise.reject("The request timed out"),
    });
    fill();
    expect(await screen.findByText(/Hub didn't confirm the review in time/)).toBeInTheDocument();
    listed = true;
    fireEvent.click(screen.getByRole("button", { name: "Publish review" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1);
  });
});
