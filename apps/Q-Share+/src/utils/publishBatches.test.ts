import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCallsMatching, mockFetch } from "../test/setup";
import {
  batchCount,
  formatQort,
  publishUnitFee,
  resetPublishUnitFee,
  roomTiming,
  splitPublishBatches,
  UNCHECKED_BATCH_MAX,
  unconfirmedCount,
  waitForRoom,
} from "./publishBatches";

const files = (n: number) => Array.from({ length: n }, (_, i) => ({ service: "FILE", identifier: `f${i}` }));
const details = { service: "DOCUMENT", identifier: "doc" };

describe("splitPublishBatches", () => {
  it("keeps a small share in one batch, details last", () => {
    const batches = splitPublishBatches([...files(3), details]);
    expect(batches.map((b) => b.map((r) => r.identifier))).toEqual([["f0", "f1", "f2", "doc"]]);
  });

  it("sends 20 files per batch and the details with the last one", () => {
    const batches = splitPublishBatches([...files(45), details]);
    expect(batches.map((b) => b.length)).toEqual([20, 20, 6]);
    expect(batches[2].at(-1)).toBe(details);
    expect(batches.flat().map((r) => r.identifier)).toEqual([...files(45).map((f) => f.identifier), "doc"]);
  });

  it("puts details listed first at the end, and sends them alone when no file is left", () => {
    expect(splitPublishBatches([details, ...files(20)]).map((b) => b.length)).toEqual([21]);
    expect(splitPublishBatches([details])).toEqual([[details]]);
    expect(splitPublishBatches(files(40)).map((b) => b.length)).toEqual([20, 20]);
  });

  it("sends a thumbnail with the details, so it never adds a batch", () => {
    const thumb = { service: "THUMBNAIL", identifier: "thumb" };
    const batches = splitPublishBatches([...files(20), thumb, details]);
    expect(batches.map((b) => b.map((r) => r.identifier).slice(-2))).toEqual([["thumb", "doc"]]);
    expect(batches[0]).toHaveLength(22);
    expect(splitPublishBatches([...files(21), thumb, details]).map((b) => b.length)).toEqual([20, 3]);
    expect(batchCount(20)).toBe(1);
    // 10 files, a thumbnail and the details go as before 1.0.1: without a room check.
    expect(splitPublishBatches([...files(10), thumb, details])[0].length).toBeLessThanOrEqual(UNCHECKED_BATCH_MAX);
  });

  it("counts batches for the form", () => {
    expect(batchCount(1)).toBe(1);
    expect(batchCount(20)).toBe(1);
    expect(batchCount(21)).toBe(2);
    expect(batchCount(300)).toBe(15);
    expect(batchCount(0)).toBe(1);
  });
});

describe("unconfirmedCount", () => {
  it("counts the account's unconfirmed transactions but not chats", async () => {
    mockFetch("/transactions/unconfirmed", [{ type: "ARBITRARY" }, { type: "CHAT" }, { type: "PAYMENT" }]);
    expect(await unconfirmedCount("pubKey+/")).toBe(2);
    expect(fetchCallsMatching("/transactions/unconfirmed")[0]).toBe(
      "/transactions/unconfirmed?creator=pubKey%2B%2F&limit=100"
    );
  });

  it("is null when the node can't say", async () => {
    mockFetch("/transactions/unconfirmed", { error: 1, message: "nope" });
    expect(await unconfirmedCount("k")).toBeNull();
  });
});

describe("waitForRoom", () => {
  afterEach(() => {
    vi.useRealTimers();
    roomTiming.visibleMs = 10_000;
  });

  it("goes at once when there is room or the node can't tell", async () => {
    mockFetch("/transactions/unconfirmed", Array.from({ length: 4 }, () => ({ type: "ARBITRARY" })));
    const onWaiting = vi.fn();
    await waitForRoom("k", 21, { onWaiting });
    expect(onWaiting).not.toHaveBeenCalled();
    mockFetch("/transactions/unconfirmed", "<html>");
    await waitForRoom("k", 21, { onWaiting });
    expect(onWaiting).not.toHaveBeenCalled();
  });

  it("waits until the network has confirmed enough of the last batch", async () => {
    roomTiming.visibleMs = 5;
    const counts = [21, 12, 5];
    mockFetch("/transactions/unconfirmed", () => Array.from({ length: counts.shift() ?? 0 }, () => ({ type: "ARBITRARY" })));
    const onWaiting = vi.fn();
    await waitForRoom("k", 20, { onWaiting });
    expect(onWaiting.mock.calls).toEqual([[21], [12]]);
    expect(fetchCallsMatching("/transactions/unconfirmed").length).toBe(3);
  });

  it("gives the last batch a block when the node can't say, if asked to", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mockFetch("/transactions/unconfirmed", { error: 1 });
    let done = false;
    void waitForRoom("k", 20, { unknownWaitMs: 65_000 }).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(64_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(done).toBe(true);
  });

  it("stops waiting when aborted", async () => {
    roomTiming.visibleMs = 60_000;
    mockFetch("/transactions/unconfirmed", Array.from({ length: 25 }, () => ({ type: "ARBITRARY" })));
    const controller = new AbortController();
    const done = waitForRoom("k", 20, { signal: controller.signal });
    await vi.waitFor(() => expect(fetchCallsMatching("/transactions/unconfirmed").length).toBe(1));
    controller.abort();
    await done;
    expect(fetchCallsMatching("/transactions/unconfirmed").length).toBe(1);
  });
});

describe("fees", () => {
  afterEach(() => resetPublishUnitFee());

  it("reads Core's unit fee once and formats amounts", async () => {
    mockFetch("/transactions/unitfee", "1000000");
    expect(await publishUnitFee()).toBe(0.01);
    expect(await publishUnitFee()).toBe(0.01);
    expect(fetchCallsMatching("/transactions/unitfee").length).toBe(1);
    expect(formatQort(0.01 * 301)).toBe("3.01 QORT");
    expect(formatQort(0.2)).toBe("0.20 QORT");
    expect(formatQort(3)).toBe("3.00 QORT");
    expect(formatQort(0.015)).toBe("0.015 QORT");
  });

  it("is null when the node doesn't answer, and asks again next time", async () => {
    mockFetch("/transactions/unitfee", { error: 1 });
    expect(await publishUnitFee()).toBeNull();
    mockFetch("/transactions/unitfee", "1000000");
    expect(await publishUnitFee()).toBe(0.01);
  });
});
