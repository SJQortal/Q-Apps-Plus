/**
 * Save File: a blob on desktop Hub, `location` in GO and for big files, a
 * blob for a file inside a resource of several, the blob when an older Hub
 * asks for it, a quiet "no", and a plain download link outside Hub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetQueries } from '../../../data/query';
import { mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../../test/setup';
import { keepsNameByLocation, saveQdnFile, savesByLocation } from './saveQdnFile';

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
