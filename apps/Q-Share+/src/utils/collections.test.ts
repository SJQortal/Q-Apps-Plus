import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../test/setup';
import { QSHARE_COLLECTION_BASE } from '../constants/Identifiers';
import { QDN_PAGE, resetQdnSearchCache } from './qdnSearch';
import { recipientMarker, resetOwnerAddresses } from './recipientMarker';
import {
  QDN_IDENTIFIER_MAX,
  buildCollectionBody,
  buildCollectionIdentifier,
  buildCollectionPublish,
  fetchCollection,
  hasItem,
  newCollectionUid,
  parseCollection,
  markedShareOwners,
  publishCollection,
  resetCollectionCaches,
  searchCollections,
  summaryToCollection,
  slugifyCollectionTitle,
  toggleItem,
  type Collection,
} from './collections';

const decode = (data64: string) => JSON.parse(atob(data64));

describe('collection identifiers', () => {
  it('slugs the title and keeps the identifier under the QDN limit', () => {
    expect(slugifyCollectionTitle('My Holiday Photos!')).toBe('my-holiday-photos');
    expect(slugifyCollectionTitle('  a   b  ')).toBe('a-b');
    expect(slugifyCollectionTitle('***')).toBe('collection');
    expect(slugifyCollectionTitle('')).toBe('collection');
    expect(slugifyCollectionTitle('x'.repeat(40)).length).toBe(30);
    const longTitle = 'A very long title that goes on and on and on forever';
    const id = buildCollectionIdentifier(longTitle, 'ab12cd');
    expect(id).toMatch(/^qshare_collection_[a-z0-9-]{1,30}_[a-z0-9]{6}$/);
    expect(id.length).toBeLessThanOrEqual(QDN_IDENTIFIER_MAX);
    expect(id.startsWith(QSHARE_COLLECTION_BASE)).toBe(true);
    expect(buildCollectionIdentifier('Docs', 'ab12cd')).toBe('qshare_collection_docs_ab12cd');
  });

  it('makes six-character lower-case uids', () => {
    const uid = newCollectionUid();
    expect(uid).toMatch(/^[a-z0-9]{6}$/);
    expect(newCollectionUid()).not.toBe(uid);
  });
});

describe('collection bodies and publish payload', () => {
  it('builds a version-1 body with deduped items and timestamps', () => {
    const body = buildCollectionBody({
      title: '  Reading list  ',
      description: 'd'.repeat(200),
      items: [
        { name: 'alice', identifier: 'qshare_file_a_1_metadata' },
        { name: 'alice', identifier: 'qshare_file_a_1_metadata' },
        { name: 'bob', identifier: 'qshare_file_b_2_metadata' },
      ],
      now: 1000,
    });
    expect(body).toEqual({
      version: 1,
      title: 'Reading list',
      description: 'd'.repeat(150),
      items: [
        { name: 'alice', identifier: 'qshare_file_a_1_metadata' },
        { name: 'bob', identifier: 'qshare_file_b_2_metadata' },
      ],
      created: 1000,
      updated: 1000,
    });
    expect(buildCollectionBody({ title: 'x', created: 5, now: 9 })).toMatchObject({ created: 5, updated: 9 });
  });

  it('publishes one DOCUMENT with the collection tag, filename and a base64 body', async () => {
    const body = buildCollectionBody({ title: 'Docs', description: 'Useful', items: [], now: 1 });
    const payload = await buildCollectionPublish({ name: 'alice', identifier: 'qshare_collection_docs_ab12cd', body });
    expect(payload).toMatchObject({
      action: 'PUBLISH_QDN_RESOURCE',
      name: 'alice',
      service: 'DOCUMENT',
      identifier: 'qshare_collection_docs_ab12cd',
      title: 'Docs',
      description: 'Useful',
      tag1: 'qshare_collection_',
      filename: 'collection.json',
    });
    expect(decode(payload.data64)).toEqual(body);
  });
});

describe('recipient markers on publish', () => {
  const ALICE = 'Q9aWbQnCZXmuNNkpg6t4sTCk8CRYoGF7Ce';
  const BOB = 'QWEsSfJdVa1DR4HPDQ29iRXSNtDdZ9H8fZ';
  const CAROL = 'QZ4gAsrEf1HaMz8HCJdQeyB6oDRSvJV6JS';
  const OWNERS: Record<string, string> = { alice: ALICE, bob: BOB, carol: CAROL };

  beforeEach(() => {
    resetCollectionCaches();
    resetOwnerAddresses();
    mockQortalAction('PUBLISH_QDN_RESOURCE', true);
    mockFetch('/names/', (url: URL) => {
      const owner = OWNERS[decodeURIComponent(url.pathname.slice('/names/'.length)).toLowerCase()];
      return owner ? { name: 'x', owner } : { error: 401 };
    });
  });

  it('names the owners of newly added shares first, then of the newest ones already there, never the publisher', async () => {
    const before = [{ name: 'bob', identifier: 'b1' }];
    await publishCollection({
      name: 'alice',
      identifier: 'qshare_collection_docs_ab12cd',
      previousItems: before,
      body: buildCollectionBody({
        title: 'Docs',
        description: 'Guides I like',
        items: [...before, { name: 'alice', identifier: 'a1' }, { name: 'carol', identifier: 'c1' }],
      }),
    });
    const [payload] = qortalCallsFor('PUBLISH_QDN_RESOURCE');
    expect(payload.description).toBe(`Guides I like ${recipientMarker(CAROL)}${recipientMarker(BOB)}`);
    // The JSON body never carries markers.
    expect(decode(String(payload.data64)).description).toBe('Guides I like');
  });

  it('keeps naming earlier owners on later publishes, so an owner whose app was closed still finds it', async () => {
    const bobs = { name: 'bob', identifier: 'b1' };
    const carols = { name: 'carol', identifier: 'c1' };
    // bob's share was added first; carol's now: both stay marked.
    expect(await markedShareOwners('alice', [bobs], [bobs, carols])).toEqual([CAROL, BOB]);
    // A publish that adds nothing (a title edit) keeps them too, newest first.
    expect(await markedShareOwners('alice', [bobs, carols], [bobs, carols])).toEqual([CAROL, BOB]);
    // An emptied collection names no one; an owner Core doesn't know is skipped.
    expect(await markedShareOwners('alice', [bobs], [])).toEqual([]);
    expect(await markedShareOwners('alice', [], [{ name: 'ghost', identifier: 'g1' }])).toEqual([]);
  });

  it('stops at four owners, newest first', async () => {
    for (const n of [1, 2, 3, 4, 5]) OWNERS[`owner${n}`] = `Q${String(n).repeat(33)}`;
    const items = [1, 2, 3, 4, 5].map((n) => ({ name: `owner${n}`, identifier: `s${n}` }));
    expect(await markedShareOwners('alice', items, items)).toEqual([5, 4, 3, 2].map((n) => `Q${String(n).repeat(33)}`));
  });

  it('keeps markers out of the descriptions the app shows', () => {
    const summary = summaryToCollection({
      name: 'alice',
      service: 'DOCUMENT',
      identifier: 'qshare_collection_docs_ab12cd',
      metadata: { title: 'Docs', description: `Guides I like ${recipientMarker(BOB)}` },
    });
    expect(summary.description).toBe('Guides I like');
  });
});

describe('parseCollection', () => {
  it('rejects junk and drops bad items', () => {
    expect(parseCollection(null)).toBeNull();
    expect(parseCollection('not json')).toBeNull();
    expect(parseCollection([])).toBeNull();
    expect(parseCollection({ title: 'x' })).toBeNull();
    expect(parseCollection({ title: 'x', items: [] })).toBeNull();
    expect(parseCollection({ version: 1, items: [] })).toBeNull();
    expect(parseCollection({ version: 1, title: 42, items: [] })).toBeNull();
    const parsed = parseCollection({
      version: 1,
      title: 'Docs',
      description: 7,
      items: [
        { name: 'alice', identifier: 'qshare_file_a_1_metadata' },
        { name: '', identifier: 'x' },
        { identifier: 'y' },
        'junk',
        null,
        { name: 'alice', identifier: 'qshare_file_a_1_metadata' },
      ],
      created: 10,
      updated: 20,
    });
    expect(parsed).toEqual({
      version: 1,
      title: 'Docs',
      description: '',
      items: [{ name: 'alice', identifier: 'qshare_file_a_1_metadata' }],
      created: 10,
      updated: 20,
    });
  });

  it('accepts JSON text and fills missing timestamps', () => {
    const parsed = parseCollection(JSON.stringify({ version: 1, title: 'T', description: 'D', items: [], updated: 5 }));
    expect(parsed).toMatchObject({ title: 'T', description: 'D', created: 5, updated: 5 });
  });
});

describe('toggleItem', () => {
  const base: Collection = {
    version: 1,
    title: 'Docs',
    description: '',
    items: [{ name: 'alice', identifier: 'a' }],
    created: 1,
    updated: 1,
    name: 'me',
    identifier: 'qshare_collection_docs_ab12cd',
    fetchedAt: 1,
  };

  it('adds an absent item and removes a present one without mutating', () => {
    const added = toggleItem(base, { name: 'bob', identifier: 'b' });
    expect(added.items).toEqual([
      { name: 'alice', identifier: 'a' },
      { name: 'bob', identifier: 'b' },
    ]);
    expect(base.items.length).toBe(1);
    expect(hasItem(added, { name: 'bob', identifier: 'b' })).toBe(true);
    const removed = toggleItem(added, { name: 'alice', identifier: 'a' });
    expect(removed.items).toEqual([{ name: 'bob', identifier: 'b' }]);
    expect(removed.name).toBe('me');
  });

  it('dedupes by name and identifier', () => {
    const dup = { ...base, items: [...base.items, { name: 'alice', identifier: 'a' }] };
    expect(toggleItem(dup, { name: 'bob', identifier: 'b' }).items.length).toBe(2);
    expect(toggleItem(dup, { name: 'alice', identifier: 'a' }).items).toEqual([]);
  });
});

describe('searchCollections and fetchCollection', () => {
  beforeEach(() => {
    resetQdnSearchCache();
    resetCollectionCaches();
  });

  it('searches DOCUMENT by the collection prefix with a page of 20, never limit=0', async () => {
    mockFetch('/arbitrary/resources/search', [
      { name: 'alice', service: 'DOCUMENT', identifier: 'qshare_collection_docs_ab12cd', updated: 5, metadata: { title: 'Docs', description: 'D' } },
      { name: 'alice', service: 'DOCUMENT', identifier: 'qshare_file_not-a-collection_x_metadata', metadata: { title: 'Nope' } },
    ]);
    const rows = await searchCollections({ name: 'alice' });
    expect(rows).toEqual([
      { name: 'alice', identifier: 'qshare_collection_docs_ab12cd', title: 'Docs', description: 'D', created: undefined, updated: 5 },
    ]);
    const [url] = fetchCallsMatching('/arbitrary/resources/search');
    expect(url).toContain('service=DOCUMENT');
    expect(url).toContain('identifier=qshare_collection_');
    expect(url).toContain('name=alice');
    expect(url).toContain('includemetadata=true');
    expect(url).toContain(`limit=${QDN_PAGE}`);
    expect(url).not.toMatch(/limit=0\b/);
    await searchCollections({ limit: 0, offset: 20 });
    const second = fetchCallsMatching('/arbitrary/resources/search')[1];
    expect(second).toContain(`limit=${QDN_PAGE}`);
    expect(second).toContain('offset=20');
    expect(second).not.toContain('name=');
  });

  it('fetches a body once per session and refreshes after a publish', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', { version: 1, title: 'Docs', description: '', items: [], created: 1, updated: 1 });
    mockQortalAction('PUBLISH_QDN_RESOURCE', true);
    const a = await fetchCollection('alice', 'qshare_collection_docs_ab12cd');
    const b = await fetchCollection('alice', 'qshare_collection_docs_ab12cd');
    expect(a).toMatchObject({ name: 'alice', identifier: 'qshare_collection_docs_ab12cd', title: 'Docs' });
    expect(b).toBe(a);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(1);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')[0]).toMatchObject({ service: 'DOCUMENT', name: 'alice' });

    const published = await publishCollection({
      name: 'alice',
      identifier: 'qshare_collection_docs_ab12cd',
      body: buildCollectionBody({ title: 'Docs', items: [{ name: 'bob', identifier: 'b' }], created: 1, now: 2 }),
    });
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE').length).toBe(1);
    expect(published.items).toEqual([{ name: 'bob', identifier: 'b' }]);
    // The published copy is the current one; no extra read.
    expect(await fetchCollection('alice', 'qshare_collection_docs_ab12cd')).toBe(published);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(1);
  });

  it('reads a collection by a name with "/" with the name encoded', async () => {
    mockFetch('/arbitrary/DOCUMENT/', { version: 1, title: 'Guides', description: '', items: [], created: 1, updated: 1 });
    const c = await fetchCollection('Vallot-/8/', 'qshare_collection_guides_ab12cd');
    expect(c).toMatchObject({ name: 'Vallot-/8/', title: 'Guides' });
    expect(fetchCallsMatching('/arbitrary/DOCUMENT/')).toEqual(['/arbitrary/DOCUMENT/Vallot-%2F8%2F/qshare_collection_guides_ab12cd']);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(0);
  });

  it('resolves null for a resource that is not a collection', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'a share', files: [] });
    expect(await fetchCollection('alice', 'qshare_collection_x_ab12cd')).toBeNull();
  });
});
