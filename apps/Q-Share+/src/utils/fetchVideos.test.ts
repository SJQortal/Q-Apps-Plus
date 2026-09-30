import { describe, expect, it } from 'vitest';
import { fetchAndEvaluateVideos, isShareBody } from './fetchVideos';
import { mockQortalAction } from '../test/setup';

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

  it('merges a JSON body over the search row', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Full title', files: [] });
    const res = await fetchAndEvaluateVideos({ user: 'a', videoId: 'id', content: { id: 'id', title: 'Short' } });
    expect(res).toMatchObject({ id: 'id', title: 'Full title', files: [], isValid: true });
    expect(res.deleted).toBeUndefined();
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
