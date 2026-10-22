import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkShopDetails,
  DETAIL_CHECK_CONCURRENCY,
  forgetFailedShopDetails,
  forgetShopDetails,
  getShopDetails,
  markShopDeleted,
  primeShopDetails,
  requestShopDetails,
  resetShopDetails,
} from "./shopDetails";
import { shopKey, type ShopEntry } from "./shopIndex";

const validShop = {
  title: "Seller's Shop",
  description: "Mugs",
  location: "Lisbon",
  shipsTo: "Europe",
  created: 1690000000000,
  shortStoreId: "my-shop",
  logo: "data:image/webp;base64,TE9HTw==",
  supportedCoins: ["QORT"],
  foreignCoins: {},
};

const KEY = shopKey("Seller Name", "q-store-general-my-shop");

function stubFetch(answer: (url: string) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>) {
  const fetchMock = vi.fn(async (input: string) => {
    const { status, body } = await answer(String(input));
    return { ok: status === 200, status, json: async () => body, text: async () => JSON.stringify(body) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetShopDetails();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a shop's details", () => {
  it("reads the STORE JSON once, with the name encoded, and checks it as the original does", async () => {
    const fetchMock = stubFetch(() => ({ status: 200, body: validShop }));
    const [first, second] = await Promise.all([
      requestShopDetails("Seller Name", "q-store-general-my-shop"),
      requestShopDetails("Seller Name", "q-store-general-my-shop"),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/arbitrary/STORE/Seller%20Name/q-store-general-my-shop");
    expect(first).toEqual({ status: "ready", shop: validShop, valid: true });
    expect(second).toBe(first);
    expect(getShopDetails(KEY)).toBe(first);
    // Already loaded: no new request.
    await requestShopDetails("Seller Name", "q-store-general-my-shop");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps no coin field of the wrong type for the cards and filters to trip on", async () => {
    stubFetch(() => ({
      status: 200,
      body: { ...validShop, supportedCoins: 1, foreignCoins: { ARRR: 5 }, acceptedAssets: {} },
    }));
    const state = await requestShopDetails("Seller Name", "q-store-general-my-shop");
    expect(state).toEqual({
      status: "ready",
      shop: { ...validShop, supportedCoins: [], foreignCoins: {}, acceptedAssets: [] },
      valid: true,
    });
  });

  it("marks a JSON that isn't a shop as not valid", async () => {
    stubFetch(() => ({ status: 200, body: { title: "No ships-to" } }));
    const state = await requestShopDetails("Seller Name", "q-store-general-my-shop");
    expect(state).toEqual({ status: "ready", shop: {}, valid: false });
  });

  it("asks again after 2, 4 and 8 seconds while the node fetches it from peers, then gives up", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(() => ({ status: 404, body: { error: 1401, message: "not found" } }));
    const job = requestShopDetails("Seller Name", "q-store-general-my-shop");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getShopDetails(KEY)).toEqual({ status: "retrying", attempt: 1 });
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(8000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await expect(job).resolves.toEqual({ status: "failed", final: true });
    // Spent: a card that mounts again doesn't start over.
    await requestShopDetails("Seller Name", "q-store-general-my-shop");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    // Pull to refresh gives it another chance.
    forgetFailedShopDetails();
    expect(getShopDetails(KEY)).toBeUndefined();
  });

  it("finds it on a retry", async () => {
    vi.useFakeTimers();
    let calls = 0;
    stubFetch(() => (++calls < 3 ? { status: 404, body: { error: 1401 } } : { status: 200, body: validShop }));
    const job = requestShopDetails("Seller Name", "q-store-general-my-shop");
    await vi.advanceTimersByTimeAsync(6000);
    await expect(job).resolves.toMatchObject({ status: "ready", valid: true });
  });

  it("a filter's check makes one attempt; a card that shows the shop later still retries", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch(() => ({ status: 404, body: { error: 1401 } }));
    await expect(requestShopDetails("Seller Name", "q-store-general-my-shop", { retries: false })).resolves.toEqual({
      status: "failed",
      final: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Another check doesn't ask again.
    await requestShopDetails("Seller Name", "q-store-general-my-shop", { retries: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const job = requestShopDetails("Seller Name", "q-store-general-my-shop");
    await vi.advanceTimersByTimeAsync(15000);
    await expect(job).resolves.toEqual({ status: "failed", final: true });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("reads a shop again when the index says it changed, showing the old copy until the new one is in", async () => {
    let logo = "data:image/webp;base64,T0xE";
    const fetchMock = stubFetch(() => ({ status: 200, body: { ...validShop, logo } }));
    await requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 100 });
    expect(getShopDetails(KEY)).toEqual({ status: "ready", shop: { ...validShop, logo }, valid: true, updated: 100 });
    // Same version, or none known: nothing to read.
    await requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 100 });
    await requestShopDetails("Seller Name", "q-store-general-my-shop");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The seller published a new logo: the index now says updated 200.
    logo = "data:image/webp;base64,TkVX";
    const job = requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 200 });
    expect(getShopDetails(KEY)).toMatchObject({ status: "ready", shop: { logo: "data:image/webp;base64,T0xE" } });
    await expect(job).resolves.toEqual({ status: "ready", shop: { ...validShop, logo }, valid: true, updated: 200 });
    // Read past the session cache, which still held the old copy.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the old copy when the changed shop can't be read right now, without asking again for that version", async () => {
    let up = true;
    const fetchMock = stubFetch(() => (up ? { status: 200, body: validShop } : { status: 404, body: { error: 1401 } }));
    await requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 100 });
    up = false;
    await expect(requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 200 })).resolves.toEqual({
      status: "ready",
      shop: validShop,
      valid: true,
      updated: 200,
    });
    await requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a Pays in check reads again only the shops that changed", async () => {
    const fetchMock = stubFetch(() => ({ status: 200, body: validShop }));
    const shop = (i: number, updated: number): ShopEntry => ({
      key: shopKey(`Owner ${i}`, `q-store-general-s${i}`),
      owner: `Owner ${i}`,
      id: `q-store-general-s${i}`,
      shortStoreId: `s${i}`,
      title: `s${i}`,
      description: "",
      created: 1,
      updated,
      acceptsArrr: false,
    });
    await checkShopDetails([shop(1, 10), shop(2, 10)]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await checkShopDetails([shop(1, 10), shop(2, 20)]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe("/arbitrary/STORE/Owner%202/q-store-general-s2");
  });

  it("takes a valid shop JSON read by the shop page, keeping the version the card read for", async () => {
    const fetchMock = stubFetch(() => ({ status: 200, body: validShop }));
    primeShopDetails("Seller Name", "q-store-general-my-shop", { ...validShop, supportedCoins: 1 });
    expect(getShopDetails(KEY)).toEqual({ status: "ready", shop: { ...validShop, supportedCoins: [] }, valid: true });
    await requestShopDetails("Seller Name", "q-store-general-my-shop");
    expect(fetchMock).not.toHaveBeenCalled();
    // A card that read version 100, then the shop page's copy: the next index version still reads again.
    resetShopDetails();
    await requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 100 });
    primeShopDetails("Seller Name", "q-store-general-my-shop", { ...validShop, title: "Renamed" });
    expect(getShopDetails(KEY)).toMatchObject({ status: "ready", shop: { title: "Renamed" }, updated: 100 });
    // Not a shop: never replaces what the list shows.
    primeShopDetails("Seller Name", "q-store-general-my-shop", { title: "No ships-to" });
    expect(getShopDetails(KEY)).toMatchObject({ shop: { title: "Renamed" } });
    forgetShopDetails("Seller Name", "q-store-general-my-shop");
    expect(getShopDetails(KEY)).toBeUndefined();
  });

  it("checks many shops five at a time", async () => {
    let inFlight = 0;
    let most = 0;
    stubFetch(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return { status: 200, body: validShop };
    });
    const shops: ShopEntry[] = Array.from({ length: 12 }, (_, i) => ({
      key: shopKey(`Owner ${i}`, `q-store-general-s${i}`),
      owner: `Owner ${i}`,
      id: `q-store-general-s${i}`,
      shortStoreId: `s${i}`,
      title: `s${i}`,
      description: "",
      created: i,
      updated: i,
      acceptsArrr: false,
    }));
    await checkShopDetails(shops);
    expect(most).toBe(DETAIL_CHECK_CONCURRENCY);
    expect(shops.every((s) => getShopDetails(s.key)?.status === "ready")).toBe(true);
  });
});

describe("a deleted shop", () => {
  it("is settled from one read of the delete marker: no retries, and not a valid shop", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => "D", json: async () => "D" }));
    vi.stubGlobal("fetch", fetchMock);
    const details = await requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 5 });
    expect(details).toEqual({ status: "ready", shop: {}, valid: false, deleted: true, updated: 5 });
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Asked again (a card scrolling into view): no new read.
    await requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("can be marked deleted by the page that found out, keeping the version it was read for", async () => {
    stubFetch(() => ({ status: 200, body: validShop }));
    await requestShopDetails("Seller Name", "q-store-general-my-shop", { updated: 7 });
    markShopDeleted("Seller Name", "q-store-general-my-shop");
    expect(getShopDetails(KEY)).toEqual({ status: "ready", shop: {}, valid: false, deleted: true, updated: 7 });
  });
});
