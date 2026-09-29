import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTtlCache, dedupeInflight, memoizeAsync } from './cache';

describe('createTtlCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('expires entries after the TTL', () => {
    const cache = createTtlCache<number>(1000);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    vi.advanceTimersByTime(999);
    expect(cache.has('a')).toBe(true);
    vi.advanceTimersByTime(2);
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts the least recently used entry beyond the cap', () => {
    const cache = createTtlCache<number>(10_000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.size).toBe(2);
  });
});

describe('dedupeInflight', () => {
  it('shares one promise while pending and forgets it afterwards', async () => {
    const inflight = new Map<string, Promise<string>>();
    const run = vi.fn(async () => 'x');
    const [a, b] = await Promise.all([
      dedupeInflight(inflight, 'k', run),
      dedupeInflight(inflight, 'k', run),
    ]);
    expect(a).toBe('x');
    expect(b).toBe('x');
    expect(run).toHaveBeenCalledTimes(1);
    expect(inflight.size).toBe(0);
    await dedupeInflight(inflight, 'k', run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('retries after a failure', async () => {
    const inflight = new Map<string, Promise<string>>();
    const run = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    await expect(dedupeInflight(inflight, 'k', run)).rejects.toThrow('boom');
    await expect(dedupeInflight(inflight, 'k', run)).resolves.toBe('ok');
  });
});

describe('memoizeAsync', () => {
  it('runs once per key for the session', async () => {
    const store = new Map<string, number>();
    const inflight = new Map<string, Promise<number>>();
    const run = vi.fn(async () => 42);
    await Promise.all([
      memoizeAsync(store, inflight, 'k', run),
      memoizeAsync(store, inflight, 'k', run),
    ]);
    await memoizeAsync(store, inflight, 'k', run);
    expect(run).toHaveBeenCalledTimes(1);
    expect(store.get('k')).toBe(42);
  });
});
