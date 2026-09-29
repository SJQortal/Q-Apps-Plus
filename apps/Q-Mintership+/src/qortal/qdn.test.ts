import { describe, expect, it } from 'vitest';
import {
  fetchCallsFor,
  fetchRequests,
  mockFetchRoute,
  mockQortalRequest,
  qortalCallsFor,
} from '../test/setup';
import {
  RENDER_DATA_PENDING_MESSAGE,
  buildSearchSimpleQuery,
  countSearchSimple,
  decryptAndParseObject,
  fetchAndSaveAttachment,
  fetchInlineImageUrl,
  fetchQdnResource,
  publishMultipleResources,
  publishResource,
  renderData,
  resourceUrl,
  searchAllWithOffset,
  searchLatestDataByIdentifier,
  searchQdnResources,
  searchResourcesWithStatus,
  searchSimple,
  searchSimpleOne,
} from './qdn';
import { base64EncodeString } from './util';

describe('buildSearchSimpleQuery', () => {
  it('uses the legacy name-only form', () => {
    expect(
      buildSearchSimpleQuery({ service: 'BLOG_POST', name: 'alice', limit: 20, reverse: true })
    ).toBe('service=BLOG_POST&name=alice&limit=20&prefix=true&reverse=true&after=0');
  });

  it('uses the legacy identifier-only form', () => {
    expect(
      buildSearchSimpleQuery({ service: 'BLOG_POST', identifier: 'card-MAC-', limit: 50, reverse: false })
    ).toBe('service=BLOG_POST&identifier=card-MAC-&limit=50&prefix=true&reverse=false&after=0');
  });

  it('uses the full form when a room or both name and identifier are given', () => {
    expect(
      buildSearchSimpleQuery({
        service: 'MAIL_PRIVATE',
        identifier: 'mintership-forum-message-admins-e',
        name: '',
        limit: 10,
        offset: 20,
        room: 'admins',
        reverse: false,
        after: null,
      })
    ).toBe(
      'service=MAIL_PRIVATE&identifier=mintership-forum-message-admins-e&name=&prefix=true&limit=10&offset=20&reverse=false&prefix=true&after=0'
    );
    expect(
      buildSearchSimpleQuery({ service: 'BLOG_POST', identifier: 'x', name: 'bob', after: 5 })
    ).toBe('service=BLOG_POST&identifier=x&name=bob&prefix=true&limit=20&offset=0&reverse=true&prefix=true&after=5');
  });

  it('never sends limit 0 and needs a name or identifier', () => {
    expect(buildSearchSimpleQuery({ service: 'BLOG_POST', identifier: 'x', limit: 0 })).toContain(
      'limit=20'
    );
    expect(buildSearchSimpleQuery({ service: 'BLOG_POST' })).toBeNull();
  });
});

describe('searchSimple', () => {
  it('returns rows, an empty array for none, and one row via searchSimpleOne', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', (url) =>
      url.searchParams.get('identifier') === 'none'
        ? []
        : [{ name: 'alice', service: 'BLOG_POST', identifier: 'card-MAC-1', created: 1 }]
    );
    await expect(searchSimple({ service: 'BLOG_POST', identifier: 'card-MAC-' })).resolves.toHaveLength(1);
    await expect(searchSimple({ service: 'BLOG_POST', identifier: 'none' })).resolves.toEqual([]);
    const one = await searchSimpleOne({ service: 'BLOG_POST', identifier: 'card-MAC-' });
    expect(one?.identifier).toBe('card-MAC-1');
    expect(fetchCallsFor('/arbitrary/resources/searchsimple').at(-1)).toContain('limit=1&');
    await expect(searchSimple({ service: 'BLOG_POST' })).rejects.toThrow(/name or an identifier/);
  });

  it('counts by paging and stops on a short page', async () => {
    const pages = [Array(100).fill({}), Array(37).fill({})];
    mockFetchRoute('/arbitrary/resources/searchsimple', (url) =>
      pages[Number(url.searchParams.get('offset')) / 100] ?? []
    );
    await expect(countSearchSimple('BLOG_POST', 'mintership-forum-message-general', 'general')).resolves.toBe(137);
    expect(fetchCallsFor('/arbitrary/resources/searchsimple')).toHaveLength(2);
  });
});

describe('searchQdnResources and searchAllWithOffset', () => {
  it('forces a limit on SEARCH_QDN_RESOURCES', async () => {
    mockQortalRequest('SEARCH_QDN_RESOURCES', [{ name: 'a', service: 'BLOG_POST', identifier: 'x' }]);
    await searchQdnResources({ service: 'BLOG_POST', query: 'x', limit: 0 });
    expect(qortalCallsFor('SEARCH_QDN_RESOURCES')[0]).toMatchObject({ limit: 20 });
  });

  it('sends the legacy forum search shapes', async () => {
    mockQortalRequest('SEARCH_QDN_RESOURCES', []);
    await searchAllWithOffset('', 'mintership-forum-message-general', 10, 20, 'general');
    await searchAllWithOffset('', 'mintership-forum-message-admins-e', 10, 0, 'admins');
    expect(qortalCallsFor('SEARCH_QDN_RESOURCES')).toEqual([
      {
        action: 'SEARCH_QDN_RESOURCES',
        service: 'BLOG_POST',
        query: 'mintership-forum-message-general',
        limit: 10,
        offset: 20,
        mode: 'ALL',
        reverse: false,
      },
      {
        action: 'SEARCH_QDN_RESOURCES',
        service: 'MAIL_PRIVATE',
        query: 'mintership-forum-message-admins-e',
        limit: 10,
        offset: 0,
        mode: 'ALL',
        reverse: false,
      },
    ]);
    await expect(searchAllWithOffset('FILE', 'x', 1, 0, 'general')).resolves.toEqual([]);
  });
});

describe('search endpoints', () => {
  it('builds the legacy /arbitrary/resources/search URLs with a limit', async () => {
    mockFetchRoute('/arbitrary/resources/search', [
      { name: 'a', service: 'DOCUMENT', identifier: 'd', status: { status: 'ready' } },
      { name: 'b', service: 'DOCUMENT', identifier: 'e', status: { status: 'published' } },
    ]);
    await searchLatestDataByIdentifier('minter-stats');
    expect(fetchCallsFor('/arbitrary/resources/search?service=DOCUMENT')[0]).toBe(
      '/arbitrary/resources/search?service=DOCUMENT&identifier=minter-stats&includestatus=true&mode=ALL&limit=20&reverse=true'
    );
    await expect(searchResourcesWithStatus('q', 5, 'local')).resolves.toHaveLength(1);
    await expect(searchResourcesWithStatus('q', 5, 'notLocal')).resolves.toHaveLength(1);
    expect(fetchCallsFor('/arbitrary/resources/search?query=q').at(-1)).toBe(
      '/arbitrary/resources/search?query=q&includestatus=true&limit=200&reverse=true'
    );
  });
});

describe('fetch, decrypt and publish', () => {
  it('fetches JSON and base64 resources with the exact legacy request shape', async () => {
    mockQortalRequest('FETCH_QDN_RESOURCE', (req) =>
      req.encoding === 'base64' ? 'ZW5j' : { messageHtml: '<p>hi</p>' }
    );
    const ref = { name: 'alice', service: 'BLOG_POST', identifier: 'mintership-forum-message-general-abc123' };
    await expect(fetchQdnResource(ref)).resolves.toEqual({ messageHtml: '<p>hi</p>' });
    await expect(fetchQdnResource(ref, { encoding: 'base64' })).resolves.toBe('ZW5j');
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toEqual([
      { action: 'FETCH_QDN_RESOURCE', ...ref },
      { action: 'FETCH_QDN_RESOURCE', ...ref, encoding: 'base64' },
    ]);
  });

  it('decrypts and parses admin data', async () => {
    const inner = base64EncodeString(JSON.stringify({ header: 'h', content: 'é' }));
    mockQortalRequest('DECRYPT_DATA', inner);
    await expect(decryptAndParseObject('ENCRYPTED')).resolves.toEqual({ header: 'h', content: 'é' });
    expect(qortalCallsFor('DECRYPT_DATA')).toEqual([{ action: 'DECRYPT_DATA', encryptedData: 'ENCRYPTED' }]);
  });

  it('publishes through the mocked bridge only, with encrypt flags when private', async () => {
    mockQortalRequest('PUBLISH_MULTIPLE_QDN_RESOURCES', { ok: true });
    mockQortalRequest('PUBLISH_QDN_RESOURCE', { ok: true });
    const resources = [{ name: 'alice', service: 'BLOG_POST', identifier: 'x', data64: 'e30=' }];
    await publishMultipleResources(resources);
    await publishMultipleResources(resources, ['PK1'], true);
    expect(qortalCallsFor('PUBLISH_MULTIPLE_QDN_RESOURCES')).toEqual([
      { action: 'PUBLISH_MULTIPLE_QDN_RESOURCES', resources },
      { action: 'PUBLISH_MULTIPLE_QDN_RESOURCES', resources, encrypt: true, publicKeys: ['PK1'] },
    ]);
    await publishResource({
      name: 'alice',
      service: 'MAIL_PRIVATE',
      identifier: 'card-MAC-1',
      data64: 'e30=',
      encrypt: true,
      publicKeys: ['PK1'],
    });
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')[0]).toEqual({
      action: 'PUBLISH_QDN_RESOURCE',
      name: 'alice',
      service: 'MAIL_PRIVATE',
      identifier: 'card-MAC-1',
      data64: 'e30=',
      encrypt: true,
      publicKeys: ['PK1'],
    });
  });

  it('returns null when a multi-publish fails instead of throwing', async () => {
    await expect(publishMultipleResources([])).resolves.toBeNull();
  });
});

describe('files', () => {
  it('builds public resource URLs with encoding', () => {
    expect(resourceUrl({ service: 'FILE', name: 'a b', identifier: 'x+y' })).toBe(
      '/arbitrary/FILE/a%20b/x%2By'
    );
  });

  it('decrypts admin-room inline images and reads public ones as-is', async () => {
    mockFetchRoute('/arbitrary/FILE_PRIVATE/', 'ENC');
    mockFetchRoute('/arbitrary/FILE/', 'aGVsbG8=');
    mockQortalRequest('DECRYPT_DATA', 'aGVsbG8=');
    const url = await fetchInlineImageUrl(
      { service: 'MAIL_PRIVATE', name: 'a', identifier: 'i' },
      'image/png',
      'admins'
    );
    expect(url).toMatch(/^blob:/);
    expect(fetchCallsFor('/arbitrary/FILE_PRIVATE/')).toEqual(['/arbitrary/FILE_PRIVATE/a/i?encoding=base64']);
    await fetchInlineImageUrl({ service: 'FILE', name: 'a', identifier: 'i' }, 'image/png', 'general');
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(1);
  });

  it('saves attachments through SAVE_FILE, decrypting private ones', async () => {
    mockFetchRoute('/arbitrary/FILE_PRIVATE/', 'ENC');
    mockFetchRoute('/arbitrary/FILE/', 'plain');
    mockQortalRequest('DECRYPT_DATA', 'aGVsbG8=');
    mockQortalRequest('SAVE_FILE', true);
    await fetchAndSaveAttachment({ service: 'MAIL_PRIVATE', name: 'a', identifier: 'i' }, 'f.png', 'image/png');
    await fetchAndSaveAttachment({ service: 'FILE', name: 'a', identifier: 'i' }, 'f.txt', 'text/plain');
    expect(fetchRequests.map((r) => r.path)).toEqual([
      '/arbitrary/FILE_PRIVATE/a/i?async=true&attempts=5&encoding=base64',
      '/arbitrary/FILE/a/i?async=true&attempts=5',
    ]);
    expect(qortalCallsFor('SAVE_FILE')).toHaveLength(2);
    expect(qortalCallsFor('SAVE_FILE')[0]).toMatchObject({ filename: 'f.png', mimeType: 'image/png' });
    await expect(
      fetchAndSaveAttachment({ service: 'FILE', name: 'a', identifier: 'i' }, '', 'x')
    ).rejects.toThrow(/required/);
  });

  it('renders data or returns the legacy pending message', async () => {
    mockFetchRoute('/render/DOCUMENT/', '{"a":1}');
    await expect(renderData({ service: 'DOCUMENT', name: 'n', identifier: 'i' })).resolves.toEqual({ a: 1 });
    mockFetchRoute('/render/DOCUMENT/', '<!DOCTYPE html>');
    await expect(renderData({ service: 'DOCUMENT', name: 'n', identifier: 'i' })).resolves.toBe(
      RENDER_DATA_PENDING_MESSAGE
    );
  });
});
