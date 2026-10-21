import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import { installWorld } from '../test/world';
import { QdnDeletedError, QdnUnavailableError, fetchQdnJson } from './qdn';

afterEach(() => vi.useRealTimers());

const PATH = '/arbitrary/JSON/Someone/qmp-note';
const tries = () => fetchCallsFor(PATH).length;
const later = (ms: number) => vi.setSystemTime(Date.now() + ms);

describe('fetchQdnJson: a body that isn’t on the node', () => {
  it('isn’t asked for again on every refresh: after 2 minutes, then 4, …', async () => {
    installWorld('learner');
    let there = false;
    mockFetchRoute(PATH, () => (there ? { ok: true } : new Response('not here', { status: 404 })));
    const read = () => fetchQdnJson('JSON', 'Someone', 'qmp-note', 'v1');

    await expect(read()).rejects.toBeInstanceOf(QdnUnavailableError);
    const ladder = tries();
    expect(ladder).toBeGreaterThan(1);
    // A refresh a minute later: no new GET, the same answer at once.
    later(60_000);
    await expect(read()).rejects.toBeInstanceOf(QdnUnavailableError);
    expect(tries()).toBe(ladder);
    // Due again after 2 minutes: one more ladder, then a 4-minute wait.
    later(61_000);
    await expect(read()).rejects.toBeInstanceOf(QdnUnavailableError);
    expect(tries()).toBe(2 * ladder);
    later(3 * 60_000);
    await expect(read()).rejects.toBeInstanceOf(QdnUnavailableError);
    expect(tries()).toBe(2 * ladder);
    // It arrives: read once the wait is over, then kept.
    there = true;
    later(61_000);
    await expect(read()).resolves.toEqual({ ok: true });
    await expect(read()).resolves.toEqual({ ok: true });
    expect(tries()).toBe(2 * ladder + 1);
  });

  it('a deleted body is final for its version; a republish is read', async () => {
    installWorld('learner');
    mockFetchRoute(PATH, () => 'D');
    await expect(fetchQdnJson('JSON', 'Someone', 'qmp-note', 'v1')).rejects.toBeInstanceOf(
      QdnDeletedError
    );
    later(60 * 60_000);
    await expect(fetchQdnJson('JSON', 'Someone', 'qmp-note', 'v1')).rejects.toBeInstanceOf(
      QdnDeletedError
    );
    expect(tries()).toBe(1);
    mockFetchRoute(PATH, () => ({ again: true }));
    await expect(fetchQdnJson('JSON', 'Someone', 'qmp-note', 'v2')).resolves.toEqual({
      again: true,
    });
  });
});
