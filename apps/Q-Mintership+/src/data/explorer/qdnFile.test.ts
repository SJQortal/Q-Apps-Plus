/**
 * Open File's reads: paths with every kind of name, the metadata (none is
 * an answer), the node's status, the latest version, and the file read in
 * byte ranges cut to its size (Core breaks a longer one).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetQueries } from '../query';
import { fetchCalls, fetchRequests, mockFetchRoute } from '../../test/setup';
import {
  fileUrl,
  getQdnLatest,
  getQdnMeta,
  getQdnStatus,
  probeFile,
  QdnFileError,
  readFileRange,
  readFileStart,
  resourcePath,
} from './qdnFile';

const JSON_REF = { service: 'JSON', name: 'Avery Admin', identifier: 'avery-settings' };
const SITE = { service: 'WEBSITE', name: 'Q Maps+', identifier: null };

/** A node answering a byte range of `bytes` as Core does (206 with Content-Range). */
function rangeAnswer(bytes: Uint8Array) {
  return (_url: URL, init?: RequestInit) => {
    const range = new Headers(init?.headers).get('Range');
    if (!range)
      return new Response(bytes.slice(), {
        status: 200,
        headers: { 'Content-Length': String(bytes.length), 'Content-Type': 'text/plain' },
      });
    const [from, to] = range.replace('bytes=', '').split('-').map(Number);
    return new Response(bytes.slice(from, to + 1), {
      status: 206,
      headers: {
        'Content-Range': `bytes ${from}-${to}/${bytes.length}`,
        'Content-Type': 'text/plain',
      },
    });
  };
}

beforeEach(() => {
  resetQueries();
});

describe('paths', () => {
  it('encodes every name and identifier, and says default for the default identifier', () => {
    expect(resourcePath(JSON_REF)).toBe('/arbitrary/JSON/Avery%20Admin/avery-settings');
    expect(resourcePath(SITE)).toBe('/arbitrary/WEBSITE/Q%20Maps%2B/default');
    // Relative inside Hub (the tests have qortalRequest), as every Explorer read.
    expect(fileUrl(SITE, 'assets/a b.js')).toBe(
      '/arbitrary/WEBSITE/Q%20Maps%2B/default?filepath=assets%2Fa%20b.js'
    );
  });
});

describe('what the node says about a resource', () => {
  it('reads the metadata once, and none is an answer', async () => {
    mockFetchRoute('/arbitrary/metadata/', (url: URL) =>
      url.pathname.includes('avery-settings')
        ? { title: 'Settings', files: ['settings.json'], mimeType: 'application/json', tags: ['a'] }
        : new Response('{"error":1401}', { status: 404 })
    );
    expect(await getQdnMeta(JSON_REF)).toEqual({
      title: 'Settings',
      description: null,
      tags: ['a'],
      category: null,
      files: ['settings.json'],
      mimeType: 'application/json',
    });
    await getQdnMeta(JSON_REF);
    expect(fetchCalls.filter((path) => path.startsWith('/arbitrary/metadata/'))).toHaveLength(1);
    expect(await getQdnMeta(SITE)).toBeNull();
  });

  it('reads the status as it stands, or building', async () => {
    mockFetchRoute('/arbitrary/resource/status/', {
      status: 'DOWNLOADING',
      localChunkCount: 2,
      totalChunkCount: 8,
      percentLoaded: 25,
    });
    expect(await getQdnStatus(SITE)).toEqual({
      status: 'DOWNLOADING',
      percent: 25,
      chunks: { local: 2, total: 8 },
    });
    await getQdnStatus(SITE, { build: true });
    expect(fetchCalls).toEqual([
      '/arbitrary/resource/status/WEBSITE/Q%20Maps%2B/default',
      '/arbitrary/resource/status/WEBSITE/Q%20Maps%2B/default?build=true',
    ]);
  });

  it('finds the latest version, the default identifier among the name’s others', async () => {
    mockFetchRoute('/arbitrary/resources/searchsimple', (url: URL) =>
      url.searchParams.get('identifier')
        ? [
            {
              name: 'Avery Admin',
              service: 'JSON',
              identifier: 'avery-settings',
              latestSignature: 'S2',
              created: 5,
            },
          ]
        : [
            {
              name: 'Q Maps+',
              service: 'WEBSITE',
              identifier: 'beta',
              latestSignature: 'B',
              created: 1,
            },
            { name: 'Q Maps+', service: 'WEBSITE', latestSignature: 'D', created: 2, updated: 9 },
          ]
    );
    expect(await getQdnLatest(JSON_REF)).toEqual({ signature: 'S2', created: 5, updated: null });
    expect(await getQdnLatest(SITE)).toEqual({ signature: 'D', created: 2, updated: 9 });
    const site = fetchCalls.find((path) => path.includes('WEBSITE')) as string;
    expect(site).toContain('name=Q%20Maps%2B');
    expect(site).toContain('prefix=false');
    expect(site).not.toContain('identifier=');
  });
});

describe('reading the file', () => {
  const bytes = new TextEncoder().encode('{"theme":"dark","notes":"hello"}');

  it('learns its size and type from one byte', async () => {
    mockFetchRoute('/arbitrary/JSON/', rangeAnswer(bytes));
    expect(await probeFile(JSON_REF)).toEqual({ size: bytes.length, contentType: 'text/plain' });
    expect(new Headers(fetchRequests[0].init?.headers).get('Range')).toBe('bytes=0-0');
  });

  it('cuts every range to the file’s size, as Core needs', async () => {
    mockFetchRoute('/arbitrary/JSON/', rangeAnswer(bytes));
    const head = await readFileRange(JSON_REF, null, { from: 0, to: 4095, size: bytes.length });
    expect(new TextDecoder().decode(head)).toBe('{"theme":"dark","notes":"hello"}');
    expect(new Headers(fetchRequests[0].init?.headers).get('Range')).toBe(
      `bytes=0-${bytes.length - 1}`
    );
    const tail = await readFileRange(JSON_REF, null, { from: 28, to: 999, size: bytes.length });
    expect(new TextDecoder().decode(tail)).toBe('lo"}');
    expect(await readFileRange(JSON_REF, null, { from: 50, to: 60, size: bytes.length })).toEqual(
      new Uint8Array(0)
    );
  });

  it('reads from the start and keeps only what it needs when the size is unknown', async () => {
    mockFetchRoute('/arbitrary/JSON/', rangeAnswer(bytes));
    const start = await readFileStart(JSON_REF, null, 8, null);
    expect(new TextDecoder().decode(start.bytes)).toBe('{"theme"');
    expect(start.truncated).toBe(true);
    expect(new Headers(fetchRequests[0].init?.headers).get('Range')).toBeNull();
    const all = await readFileStart(JSON_REF, null, 4096, bytes.length);
    expect(all.truncated).toBe(false);
    expect(all.bytes).toHaveLength(bytes.length);
  });

  it('tells a resource of several files from a missing one', async () => {
    mockFetchRoute(
      '/arbitrary/WEBSITE/',
      new Response(
        JSON.stringify({
          error: 102,
          message: 'filepath is required for resources containing more than one file',
        }),
        { status: 400 }
      )
    );
    const error = await probeFile(SITE).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QdnFileError);
    expect((error as QdnFileError).problem).toBe('several');
    mockFetchRoute(
      '/arbitrary/JSON/',
      new Response(JSON.stringify({ error: 1401, message: 'File not found' }), { status: 404 })
    );
    expect(((await probeFile(JSON_REF).catch((e: unknown) => e)) as QdnFileError).problem).toBe(
      'notFound'
    );
  });
});
