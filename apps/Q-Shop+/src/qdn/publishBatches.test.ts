import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatQort,
  publishUnitFee,
  resetPublishUnitFee,
  roomTiming,
  splitPublishBatches,
  unconfirmedCount,
  waitForRoom,
} from "./publishBatches";

const catalogues = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ service: "DOCUMENT", identifier: `q-store-catalogue-my-shop-C${i}` }));
const index = { service: "DOCUMENT", identifier: "q-store-general-my-shop-datacontainer" };

/** Answers `path` with `body` (a function is called per request); everything else 404s. */
function mockFetch(routes: Record<string, unknown | (() => unknown)>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: string) => {
    const url = String(input);
    calls.push(url);
    const route = Object.keys(routes).find((p) => url.startsWith(p));
    if (!route) return { ok: false, status: 404, text: async () => "{}" };
    const value = routes[route];
    const body = typeof value === "function" ? (value as () => unknown)() : value;
    return { ok: true, status: 200, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  roomTiming.visibleMs = 10_000;
  resetPublishUnitFee();
});

describe("splitPublishBatches", () => {
  it("keeps up to 20 resources in one batch, in the order built (the original's single publish)", () => {
    const resources = [...catalogues(19), index];
    expect(splitPublishBatches(resources)).toEqual([resources]);
    expect(splitPublishBatches([])).toEqual([]);
  });

  it("splits more than 20 into batches of 20 with the product index last, in the final batch", () => {
    const batches = splitPublishBatches([...catalogues(25), index]);
    expect(batches.map((b) => b.length)).toEqual([20, 6]);
    expect(batches[1].at(-1)).toBe(index);
    expect(batches.flat().map((r) => r.identifier)).toEqual([...catalogues(25), index].map((r) => r.identifier));
  });

  it("never lets a batch pass 20: an index that doesn't fit goes alone, last", () => {
    expect(splitPublishBatches([...catalogues(20), index]).map((b) => b.length)).toEqual([20, 1]);
    expect(splitPublishBatches([...catalogues(40), index]).map((b) => b.length)).toEqual([20, 20, 1]);
    // An index listed first still goes last.
    const batches = splitPublishBatches([index, ...catalogues(30)]);
    expect(batches.map((b) => b.length)).toEqual([20, 11]);
    expect(batches[1].at(-1)).toBe(index);
    for (const batch of splitPublishBatches([...catalogues(97), index])) expect(batch.length).toBeLessThanOrEqual(20);
  });
});

describe("unconfirmedCount", () => {
  it("counts the account's unconfirmed transactions but not chats, with the key encoded", async () => {
    const calls = mockFetch({ "/transactions/unconfirmed": [{ type: "ARBITRARY" }, { type: "CHAT" }, { type: "PAYMENT" }] });
    expect(await unconfirmedCount("pubKey+/")).toBe(2);
    expect(calls[0]).toBe("/transactions/unconfirmed?creator=pubKey%2B%2F&limit=100");
  });

  it("is null when the node can't say", async () => {
    mockFetch({ "/transactions/unconfirmed": { error: 1, message: "nope" } });
    expect(await unconfirmedCount("k")).toBeNull();
    mockFetch({});
    expect(await unconfirmedCount("k")).toBeNull();
  });
});

describe("waitForRoom", () => {
  it("goes at once when there is room or the node can't tell", async () => {
    mockFetch({ "/transactions/unconfirmed": Array.from({ length: 4 }, () => ({ type: "ARBITRARY" })) });
    const onWaiting = vi.fn();
    await waitForRoom("k", 21, { onWaiting });
    mockFetch({ "/transactions/unconfirmed": "<html>" });
    await waitForRoom("k", 21, { onWaiting });
    expect(onWaiting).not.toHaveBeenCalled();
  });

  it("waits until the network has confirmed enough of the last batch", async () => {
    roomTiming.visibleMs = 5;
    const counts = [21, 12, 5];
    const calls = mockFetch({
      "/transactions/unconfirmed": () => Array.from({ length: counts.shift() ?? 0 }, () => ({ type: "ARBITRARY" })),
    });
    const onWaiting = vi.fn();
    await waitForRoom("k", 20, { onWaiting });
    expect(onWaiting.mock.calls).toEqual([[21], [12]]);
    expect(calls).toHaveLength(3);
  });

  it("gives the last batch a block when the node can't say, if asked to", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mockFetch({ "/transactions/unconfirmed": { error: 1 } });
    let done = false;
    void waitForRoom("k", 20, { unknownWaitMs: 65_000 }).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(64_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(done).toBe(true);
  });

  it("stops waiting when aborted", async () => {
    roomTiming.visibleMs = 60_000;
    const calls = mockFetch({ "/transactions/unconfirmed": Array.from({ length: 25 }, () => ({ type: "ARBITRARY" })) });
    const controller = new AbortController();
    const done = waitForRoom("k", 20, { signal: controller.signal });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();
    await done;
    expect(calls).toHaveLength(1);
  });
});

describe("fees", () => {
  it("reads Core's unit fee once and formats amounts", async () => {
    const calls = mockFetch({ "/transactions/unitfee": "1000000" });
    expect(await publishUnitFee()).toBe(0.01);
    expect(await publishUnitFee()).toBe(0.01);
    expect(calls).toEqual(["/transactions/unitfee?txType=ARBITRARY"]);
    expect(formatQort(0.01 * 26)).toBe("0.26 QORT");
    expect(formatQort(3)).toBe("3.00 QORT");
    expect(formatQort(0.015)).toBe("0.015 QORT");
  });

  it("is null when the node doesn't answer, and asks again next time", async () => {
    mockFetch({ "/transactions/unitfee": { error: 1 } });
    expect(await publishUnitFee()).toBeNull();
    mockFetch({ "/transactions/unitfee": "1000000" });
    expect(await publishUnitFee()).toBe(0.01);
  });
});
