import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAndEvaluateVideos, fetchQdnResource, isShareBody, needsEncodedFetch } from './fetchVideos';
import { fetchCalls, mockFetch, mockQortalAction, qortalCallsFor } from '../test/setup';

afterEach(() => vi.restoreAllMocks());

describe('share bodies', () => {
  it('only a JSON object is a share body', () => {
    expect(isShareBody({ title: 'x', files: [] })).toBe(true);
    expect(isShareBody({})).toBe(true);
    expect(isShareBody('D')).toBe(false);
    expect(isShareBody('\n')).toBe(false);
    expect(isShareBody(null)).toBe(false);
    expect(isShareBody([1, 2])).toBe(false);
  });

  it('marks a string body as deleted and keeps the search row fields', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', 'D');
    const res = await fetchAndEvaluateVideos({ user: 'Claude', videoId: 'qshare_file_a_b_metadata', content: { id: 'qshare_file_a_b_metadata', title: 'Torq Test' } });
    expect(res).toMatchObject({ id: 'qshare_file_a_b_metadata', title: 'Torq Test', isValid: false, deleted: true });
  });

  it('fetches a name with "/" directly, encoded, because q-apps.js would not encode it', async () => {
    const id = 'qshare_file_qortal-corei-settingsjson-fail_WGvzlh_metadata';
    mockFetch('/arbitrary/DOCUMENT/', { title: "Qortal Core'i settings.json faili asukoht", files: [{ filename: 'a.pdf', size: 628000 }] });
    const res = await fetchAndEvaluateVideos({ user: 'Vallot-/8/', videoId: id, content: { id, service: 'DOCUMENT' } });
    expect(fetchCalls).toContain(`/arbitrary/DOCUMENT/Vallot-%2F8%2F/${id}`);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toEqual([]);
    expect(res).toMatchObject({ isValid: true, files: [{ filename: 'a.pdf' }] });
  });

  it('an HTTP error page rejects instead of becoming an empty share', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<h1>Bad Message 400</h1><pre>reason: Ambiguous URI empty segment</pre>', { status: 400 })
    );
    await expect(fetchQdnResource('DOCUMENT', 'Vallot-/8/', 'x')).rejects.toThrow('QDN fetch failed (400)');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{"error":1401,"message":"Data unavailable. Please try again later."}', { status: 404 })
    );
    await expect(fetchQdnResource('DOCUMENT', 'a#b', 'x')).rejects.toThrow('Data unavailable');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 200 }));
    await expect(fetchQdnResource('DOCUMENT', 'a?b', 'x')).rejects.toThrow('Empty response');

    // A delete marker is text, handed back as a string like q-apps.js does.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('D', { status: 200 }));
    await expect(fetchQdnResource('DOCUMENT', '100%', 'x')).resolves.toBe('D');
  });

  it('only names q-apps.js would break go around it', () => {
    expect(needsEncodedFetch('Vallot-/8/')).toBe(true);
    expect(needsEncodedFetch('Cryptic Puzzle #1')).toBe(true);
    expect(needsEncodedFetch('%reset -f')).toBe(true);
    expect(needsEncodedFetch('Simon James')).toBe(false);
    expect(needsEncodedFetch('Qort Darlood ΑΩ')).toBe(false);
    expect(needsEncodedFetch('POS+')).toBe(false);
  });

  it('merges a JSON body over the search row', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Full title', files: [] });
    const res = await fetchAndEvaluateVideos({ user: 'a', videoId: 'id', content: { id: 'id', title: 'Short' } });
    expect(res).toMatchObject({ id: 'id', title: 'Full title', files: [], isValid: true });
    expect(res.deleted).toBeUndefined();
  });

  it("a body can't replace the search row's identifier, name, dates or service, or mark itself deleted", async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', {
      title: 'Full title',
      files: [],
      id: 'qshare_file_someone-elses_Ab1234_metadata',
      user: 'alice',
      created: 1,
      updated: 9_999_999_999_999,
      service: 'FILE',
      deleted: true,
      isValid: false,
    });
    const content = { id: 'id', user: 'mallory', title: 'Short', created: 10, updated: 20, service: 'DOCUMENT' };
    const res = await fetchAndEvaluateVideos({ user: 'mallory', videoId: 'id', content });
    expect(res).toEqual({ id: 'id', user: 'mallory', title: 'Full title', files: [], created: 10, updated: 20, service: 'DOCUMENT', isValid: true });
  });

  it('only a delete marker is a delete: JSON that is not an object cannot be read, other text is retried', async () => {
    const content = { id: 'id', title: 'Short' };
    mockQortalAction('FETCH_QDN_RESOURCE', '\n');
    expect(await fetchAndEvaluateVideos({ user: 'a', videoId: 'id', content })).toMatchObject({ isValid: false, deleted: true });

    mockQortalAction('FETCH_QDN_RESOURCE', [1, 2]);
    expect(await fetchAndEvaluateVideos({ user: 'a', videoId: 'id', content })).toMatchObject({ isValid: false, deleted: false });

    // A proxy's or Jetty's error page, handed back as a string: not a delete, so it rejects.
    mockQortalAction('FETCH_QDN_RESOURCE', '<html><body><h1>502 Bad Gateway</h1></body></html>');
    await expect(fetchAndEvaluateVideos({ user: 'a', videoId: 'id', content })).rejects.toThrow('instead of the share');
  });
});
