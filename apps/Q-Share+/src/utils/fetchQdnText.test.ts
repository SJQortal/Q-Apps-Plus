import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchQdnText, resetQdnSearchCache } from './qdnSearch';
import { fetchCallsMatching, mockFetch } from '../test/setup';

const notFound = () =>
  new Response('{"error":1401,"message":"Couldn\'t find PUT transaction for name qortal seth"}', {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });

describe('fetchQdnText', () => {
  beforeEach(() => {
    resetQdnSearchCache();
  });

  it('reads the body as text, encodes the name and caches it', async () => {
    mockFetch('/arbitrary/FILE/', 'hello');
    expect(await fetchQdnText('FILE', 'Q&A+', 'id_1')).toBe('hello');
    expect(await fetchQdnText('FILE', 'Q&A+', 'id_1')).toBe('hello');
    expect(fetchCallsMatching('/arbitrary/FILE/')).toEqual(['/arbitrary/FILE/Q%26A%2B/id_1']);
  });

  it('rejects on a node error instead of returning the error JSON, and does not cache it', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => notFound());
    await expect(fetchQdnText('FILE', 'Qortal Seth', 'qshare_file_x')).rejects.toThrow(/404/);

    mockFetch('/arbitrary/FILE/', 'arrived');
    expect(await fetchQdnText('FILE', 'Qortal Seth', 'qshare_file_x')).toBe('arrived');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});
