import { afterEach, describe, expect, it, vi } from "vitest";
import { peerRetryDelays, RetryCancelled, setPeerRetryDelaysForTests, withPeerRetries } from "./peerRetry";

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
  vi.useRealTimers();
});

describe("withPeerRetries", () => {
  it("waits 2, 4 and 8 seconds between attempts by default", async () => {
    expect(peerRetryDelays()).toEqual([2000, 4000, 8000]);
    vi.useFakeTimers();
    const task = vi.fn(async () => {
      throw new Error("not here yet");
    });
    const onRetry = vi.fn();
    const done = withPeerRetries(task, { onRetry }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(task).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(8000);
    expect(task).toHaveBeenCalledTimes(4);
    expect(((await done) as Error).message).toBe("not here yet");
    expect(onRetry.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });

  it("returns as soon as an attempt works, and can stop early", async () => {
    restore = setPeerRetryDelaysForTests([0, 0, 0]);
    let n = 0;
    expect(await withPeerRetries(async () => (++n < 3 ? Promise.reject(new Error("x")) : "ok"))).toBe("ok");
    const task = vi.fn(async () => Promise.reject(new Error("gone")));
    await expect(withPeerRetries(task, { shouldRetry: () => false })).rejects.toThrow("gone");
    expect(task).toHaveBeenCalledTimes(1);
    let alive = true;
    const p = withPeerRetries(
      async () => {
        alive = false;
        throw new Error("x");
      },
      { isAlive: () => alive }
    );
    await expect(p).rejects.toBeInstanceOf(RetryCancelled);
  });
});
