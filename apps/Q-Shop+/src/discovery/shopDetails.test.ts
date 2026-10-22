import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkShopDetails,
  DETAIL_CHECK_CONCURRENCY,
  forgetFailedShopDetails,
  getShopDetails,
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
