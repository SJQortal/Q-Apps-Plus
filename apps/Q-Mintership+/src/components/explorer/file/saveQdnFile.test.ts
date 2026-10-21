/**
 * Save File: a blob on desktop Hub, `location` in GO and for big files, a
 * blob for a file inside a resource of several, the blob when an older Hub
 * asks for it, a quiet "no", and a plain download link outside Hub. A
 * resource of several files: packed into one ZIP by their paths, stopped by
 * a file the node can't give, by too much in all, or by the viewer closing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetQueries } from '../../../data/query';
import {
  fetchCallsFor,
  mockFetchRoute,
  mockQortalRequest,
  qortalCallsFor,
} from '../../../test/setup';
import { findDirectory, readEntries } from '../../../rules/explorer/zipListing';
import {
  keepsNameByLocation,
  saveQdnFile,
  saveQdnFilesAsZip,
  savesByLocation,
  zipNameOf,
} from './saveQdnFile';

const REF = { service: 'FILE', name: 'Juan Qortal', identifier: 'qshare_file_part-7' };
const FILE = { filepath: null, filename: 'Part 7.pdf', mime: 'application/pdf', size: 167_992 };
const GO = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/141.0 Mobile';

beforeEach(() => {
  resetQueries();
  mockFetchRoute('/arbitrary/FILE/', () => new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46])));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('how a file is handed to Hub', () => {
  it('streams in GO and for big files, as a blob otherwise', () => {
    expect(savesByLocation(FILE, 'jsdom')).toBe(false);
    expect(savesByLocation({ ...FILE, size: 150 * 1024 * 1024 }, 'jsdom')).toBe(true);
    expect(savesByLocation({ ...FILE, size: null }, 'jsdom')).toBe(true);
    expect(savesByLocation(FILE, GO)).toBe(true);
    // GO keeps only A–Z, 0–9, space, _ and - of a name saved by location.
    expect(keepsNameByLocation('Отчёт.pdf')).toBe(false);
    expect(savesByLocation({ ...FILE, filename: 'Отчёт.pdf' }, GO)).toBe(false);
    // A file inside a resource of several: a location can't name it.
    expect(savesByLocation({ ...FILE, filepath: 'docs/a.pdf', size: null }, GO)).toBe(false);
  });

  it('saves a small file on desktop Hub as a blob of its type', async () => {
    mockQortalRequest('SAVE_FILE', true);
    expect(await saveQdnFile(REF, FILE)).toBe('saved');
    const [call] = qortalCallsFor('SAVE_FILE');
    expect(call).toMatchObject({ filename: 'Part 7.pdf', mimeType: 'application/pdf' });
    expect((call.blob as Blob).type).toBe('application/pdf');
    expect(call.location).toBeUndefined();
  });

  it('lets GO fetch it by location, and falls back to a blob for a Hub without it', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(GO);
    mockQortalRequest('SAVE_FILE', true);
    expect(await saveQdnFile(REF, FILE)).toBe('saved');
    expect(qortalCallsFor('SAVE_FILE')[0]).toMatchObject({
      location: { service: 'FILE', name: 'Juan Qortal', identifier: 'qshare_file_part-7' },
    });
    mockQortalRequest('SAVE_FILE', (request: Record<string, unknown>) => {
      if (request.location) throw new Error('Missing fields: blob');
      return true;
    });
    expect(await saveQdnFile(REF, FILE)).toBe('saved');
    const calls = qortalCallsFor('SAVE_FILE');
    // The file's bytes, typed (Node's Blob, not jsdom's: compared by shape).
    expect(calls[calls.length - 1].blob).toMatchObject({ size: 4, type: 'application/pdf' });
  });

  it('takes a no in Hub’s prompt quietly, with no second prompt', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(GO);
    mockQortalRequest('SAVE_FILE', () => {
      throw new Error('User declined to save file');
    });
    expect(await saveQdnFile(REF, FILE)).toBe('declined');
    expect(qortalCallsFor('SAVE_FILE')).toHaveLength(1);
  });

  it('is a plain download link outside Hub', async () => {
    const saved = (globalThis as { qortalRequest?: unknown }).qortalRequest;
    (globalThis as { qortalRequest?: unknown }).qortalRequest = undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      expect(await saveQdnFile(REF, { ...FILE, filepath: 'a b.pdf' })).toBe('saved');
      const link = click.mock.instances[0] as unknown as HTMLAnchorElement;
      expect(link.download).toBe('Part 7.pdf');
      expect(link.href).toBe(
        'http://localhost:12391/arbitrary/FILE/Juan%20Qortal/qshare_file_part-7?filepath=a%20b.pdf'
      );
    } finally {
      (globalThis as { qortalRequest?: unknown }).qortalRequest = saved;
    }
  });
});

const SITE = { service: 'WEBSITE', name: 'AA Maps', identifier: null };
const SITE_FILES: Record<string, string> = {
  'index.html': '<!DOCTYPE html><title>AA Maps</title>',
  'logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  'assets/app.js': 'console.log("maps")',
};

/** A ZIP's entries, from its own central directory. */
async function entriesOf(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const directory = findDirectory(bytes, 0);
  if (!directory) throw new Error('not a ZIP');
  return readEntries(bytes.subarray(directory.offset, directory.offset + directory.size), 100);
}

describe('Save File on a resource of several files', () => {
  beforeEach(() => {
    mockFetchRoute('/arbitrary/WEBSITE/', (url: URL) => {
      const text = SITE_FILES[url.searchParams.get('filepath') ?? ''];
      return text === undefined
        ? new Response('{"error":102}', { status: 400 })
        : new Response(new TextEncoder().encode(text));
    });
  });

  it('names the ZIP after the resource, and its identifier when it has one', () => {
    expect(zipNameOf(SITE)).toBe('AA Maps.zip');
    expect(zipNameOf({ service: 'APP', name: 'Q-Support', identifier: 'beta' })).toBe(
      'Q-Support - beta.zip'
    );
    expect(zipNameOf({ service: 'FILE', name: 'a/b', identifier: 'x:y' })).toBe('a_b - x_y.zip');
  });

  it('reads each file by its path and packs them all, folders kept, in the list’s order', async () => {
    mockQortalRequest('SAVE_FILE', true);
    const read: number[] = [];
    const files = ['index.html', 'logo.svg', 'assets/app.js'];
    const result = await saveQdnFilesAsZip(SITE, files, 'AA Maps.zip', {
      onProgress: (count) => read.push(count),
    });
    expect(result).toBe('saved');
    expect(read).toEqual([1, 2, 3]);
    expect(fetchCallsFor('/arbitrary/WEBSITE/')).toEqual([
      '/arbitrary/WEBSITE/AA%20Maps/default?filepath=index.html',
      '/arbitrary/WEBSITE/AA%20Maps/default?filepath=logo.svg',
      '/arbitrary/WEBSITE/AA%20Maps/default?filepath=assets%2Fapp.js',
    ]);
    const [call] = qortalCallsFor('SAVE_FILE');
    expect(call).toMatchObject({ filename: 'AA Maps.zip', mimeType: 'application/zip' });
    expect(call.location).toBeUndefined();
    const entries = await entriesOf(call.blob as Blob);
    expect(entries.map((entry) => [entry.name, entry.size])).toEqual(
      files.map((name) => [name, new TextEncoder().encode(SITE_FILES[name]).length])
    );
  });

  it('stops at a file the node can’t give, before Hub is asked', async () => {
    mockQortalRequest('SAVE_FILE', true);
    await expect(
      saveQdnFilesAsZip(SITE, ['index.html', 'cancelled.png'], 'AA Maps.zip')
    ).rejects.toThrow('your node answered 400 for cancelled.png');
    expect(qortalCallsFor('SAVE_FILE')).toEqual([]);
  });

  it('stops past its limit in all', async () => {
    mockQortalRequest('SAVE_FILE', true);
    await expect(
      saveQdnFilesAsZip(SITE, Object.keys(SITE_FILES), 'AA Maps.zip', { maxBytes: 50 })
    ).rejects.toThrow('its files come to more than 50 bytes, too much to pack into one ZIP here');
    expect(qortalCallsFor('SAVE_FILE')).toEqual([]);
  });

  it('stops when the viewer closes, and every read with it', async () => {
    const signals: AbortSignal[] = [];
    mockFetchRoute(
      '/arbitrary/WEBSITE/',
      (_url: URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal) signals.push(init.signal);
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );
    const closing = new AbortController();
    const saving = saveQdnFilesAsZip(SITE, Object.keys(SITE_FILES), 'AA Maps.zip', {
      signal: closing.signal,
    });
    await vi.waitFor(() => expect(signals).toHaveLength(3));
    closing.abort();
    await expect(saving).rejects.toMatchObject({ name: 'AbortError' });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(qortalCallsFor('SAVE_FILE')).toEqual([]);
  });

  it('takes a no in Hub’s prompt quietly', async () => {
    mockQortalRequest('SAVE_FILE', () => {
      throw new Error('User declined to save file');
    });
    expect(await saveQdnFilesAsZip(SITE, ['index.html', 'logo.svg'], 'AA Maps.zip')).toBe(
      'declined'
    );
  });
});
