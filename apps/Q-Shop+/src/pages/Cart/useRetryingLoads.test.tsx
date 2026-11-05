import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRetryingLoads, type LoadJob } from "./useRetryingLoads";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const job = (key: string): LoadJob<string> => ({ key, item: key });

describe("useRetryingLoads", () => {
  it("loads each job once, five at a time", async () => {
    let running = 0;
    let most = 0;
    const load = vi.fn(async () => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return true;
    });
    const jobs = Array.from({ length: 12 }, (_, i) => job(`k${i}`));
    const { rerender } = renderHook(({ list }) => useRetryingLoads(list, load), { initialProps: { list: jobs } });
    rerender({ list: [...jobs] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(load).toHaveBeenCalledTimes(12);
    expect(most).toBe(5);
  });

  it("asks again after 2, 4 and 8 s, then waits for Retry", async () => {
    const load = vi.fn(async () => false);
    const { result } = renderHook(() => useRetryingLoads([job("cat")], load));
    expect(result.current.phaseOf("cat")).toBe("loading");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.phaseOf("cat")).toBe("retrying");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999);
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000 + 8000);
    });
    expect(load).toHaveBeenCalledTimes(4);
    expect(result.current.phaseOf("cat")).toBe("failed");

    // Nothing more on its own (no polling)…
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(load).toHaveBeenCalledTimes(4);

    // …until Retry, which starts over.
    load.mockResolvedValueOnce(true);
    await act(async () => {
      result.current.retry("cat");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(load).toHaveBeenCalledTimes(5);
    expect(result.current.phaseOf("cat")).toBe("loading");
  });

  it("stops retrying when the page goes away", async () => {
    const load = vi.fn(async () => false);
    const { unmount } = renderHook(() => useRetryingLoads([job("cat")], load));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    unmount();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("doesn't load a key again on its own after it loaded, even when it is listed again", async () => {
    const load = vi.fn(async () => true);
    const { rerender, result } = renderHook(({ list }) => useRetryingLoads(list, load), {
      initialProps: { list: [job("alice"), job("mallory")] },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(load).toHaveBeenCalledTimes(2);
    // Two copies that keep replacing each other elsewhere list the other key again, and again.
    for (const list of [[job("alice")], [job("mallory")], [job("alice")], [job("mallory")]]) {
      rerender({ list });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    }
    expect(load).toHaveBeenCalledTimes(2);
    // Retry still loads it again.
    await act(async () => {
      result.current.retry("mallory");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(load).toHaveBeenCalledTimes(3);
  });
});
