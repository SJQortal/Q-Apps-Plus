/**
 * Open File and Save File on a QDN publish (Simon, 2026-10-17): the viewer
 * reads only after a press, waits while the node gets the file, asks before
 * a big one, says why one can't open, lists a resource's files, shows a
 * file by its kind, notes an earlier version, saves through Hub's prompt,
 * and never appears on an encrypted publish. Nothing is POSTed.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import {
  fetchCalls,
  fetchRequests,
  mockFetchRoute,
  mockQortalRequest,
  qortalCallsFor,
} from '../../../test/setup';
import type { TxRow } from '../../../data/types';
import { QdnFileButtons } from './QdnFileButtons';
import { setReadyTimings } from './useQdnReady';

const T = { timeout: 4000 };
const SIGNATURE =
  '4fpyzUn1aW7maTf4G4HRxTCE7joXVMxRytmdHoGLwfqyuibhdYoajyTVEk2MADg4HmNhx3Kp9nKGmJ8XwZWmBzt7';

function publish(fields: Partial<TxRow>): TxRow {
  return {
    type: 'ARBITRARY',
    timestamp: 1_792_227_163_476,
    signature: SIGNATURE,
    txGroupId: 0,
    blockHeight: 2_762_919,
    service: 1110,
    name: 'Avery Admin',
    identifier: 'avery-settings',
    size: 240,
    ...fields,
  } as TxRow;
}

const SETTINGS = new TextEncoder().encode('{"theme":"dark","notes":["one","two"]}');

/** How many status reads the node answered (a test waits on it). */
const reads = { status: 0 };

/**
 * The node's answers for one resource: its statuses in turn (the last
 * repeats; `statuses` can be pushed to while a test runs), metadata, latest
 * version and files.
 */
function node(options: {
  statuses?: string[];
  meta?: Record<string, unknown> | null;
  latest?: string;
  files: Record<string, { bytes: Uint8Array; type: string }>;
}) {
  const statuses = options.statuses ?? ['READY'];
  reads.status = 0;
  mockFetchRoute('/arbitrary/resource/status/', () => {
    const status = statuses.length > 1 ? (statuses.shift() as string) : statuses[0];
    reads.status += 1;
    return {
      status,
      localChunkCount: status === 'READY' ? 4 : 1,
      totalChunkCount: 4,
      percentLoaded: status === 'READY' ? 100 : 25,
    };
  });
  mockFetchRoute('/arbitrary/metadata/', () =>
    options.meta === null || options.meta === undefined
      ? new Response('{"error":1401,"message":"no metadata"}', { status: 404 })
      : options.meta
  );
  mockFetchRoute('/arbitrary/resources/searchsimple', [
    {
      name: 'Avery Admin',
      service: 'JSON',
      identifier: 'avery-settings',
      latestSignature: options.latest ?? SIGNATURE,
      created: 1_792_000_000_000,
      updated: 1_792_227_163_476,
    },
  ]);
  mockFetchRoute(
    /^\/arbitrary\/(JSON|WEBSITE|FILE|IMAGE|VIDEO)\//,
    (url: URL, init?: RequestInit) => {
      const file = options.files[url.searchParams.get('filepath') ?? ''];
      if (!file)
        return new Response(
          JSON.stringify({
            error: 102,
            message: 'filepath is required for resources containing more than one file',
          }),
          { status: 400 }
        );
      const range = new Headers(init?.headers).get('Range');
      if (!range)
        return new Response(file.bytes.slice(), { status: 200, headers: { 'Content-Type': file.type } });
      const [from, to] = range.replace('bytes=', '').split('-').map(Number);
      return new Response(file.bytes.slice(from, to + 1), {
        status: 206,
        headers: {
          'Content-Range': `bytes ${from}-${to}/${file.bytes.length}`,
          'Content-Type': file.type,
        },
      });
    }
  );
}

async function show(tx: TxRow) {
  const result = await renderPage(<QdnFileButtons tx={tx} />, { path: '/file' });
  return { ...result, user: userEvent.setup() };
}

beforeEach(() => {
  setReadyTimings({ steps: [5], stalled: 5, stallMs: 60_000, giveUpMs: 60_000, errors: 3 });
});

describe('Open File', () => {
  it('reads nothing before a press, then shows a JSON file laid out, with what it is', async () => {
    const { user, posts } = await show(publish({}));
    node({
      meta: {
        title: 'Avery’s settings',
        description: 'Kept for the next visit.',
        files: ['settings.json'],
        mimeType: 'application/json',
      },
      files: { '': { bytes: SETTINGS, type: 'application/json' } },
    });
    expect(fetchCalls.filter((path) => path.startsWith('/arbitrary'))).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Open File' }));
    const dialog = await screen.findByRole('dialog', {}, T);
    expect(await within(dialog).findByText('The file’s JSON', {}, T)).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'settings.json' })).toBeInTheDocument();
    expect(within(dialog).getByText('Avery’s settings')).toBeInTheDocument();
    expect(within(dialog).getByText('Kept for the next visit.')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Published by');
    expect(dialog).toHaveTextContent('JSON · 38 bytes · JSON data');
    const region = within(dialog).getByRole('region', { name: 'settings.json' });
    expect(region).toHaveTextContent('"theme": "dark"');
    // One byte for its size, then the file itself, cut to its size.
    const ranges = fetchRequests
      .filter((request) => request.path.startsWith('/arbitrary/JSON/'))
      .map((request) => new Headers(request.init?.headers).get('Range'));
    expect(ranges).toEqual(['bytes=0-0', `bytes=0-${SETTINGS.length - 1}`]);
    expect(posts).toEqual([]);
    expect(qortalCallsFor('SAVE_FILE')).toEqual([]);
    await expectNoAxeViolations(dialog);
  });

  it('shows the node getting the file, then the file', async () => {
    const { user } = await show(publish({}));
    const statuses = ['PUBLISHED', 'DOWNLOADING'];
    node({ statuses, meta: null, files: { '': { bytes: SETTINGS, type: 'application/json' } } });
    await user.click(screen.getByRole('button', { name: 'Open File' }));
    const dialog = await screen.findByRole('dialog', {}, T);
    await within(dialog).findByText('Getting the file to your node…', {}, T);
    expect(dialog).toHaveTextContent('1 of 4 parts (25%)');
    // It keeps asking, politely, until the node has it.
    await waitFor(() => expect(reads.status).toBeGreaterThan(3), T);
    statuses.push('READY');
    statuses.shift();
    expect(await within(dialog).findByText('The file’s JSON', {}, T)).toBeInTheDocument();
    // The first read only looks; the next ones build it.
    const statusReads = fetchCalls.filter((path) => path.startsWith('/arbitrary/resource/status/'));
    expect(statusReads[0]).not.toContain('build=true');
    expect(statusReads.slice(1).every((path) => path.endsWith('?build=true'))).toBe(true);
  });

  it('asks before the node fetches a big file', async () => {
    const { user } = await show(
      publish({ service: 500, name: 'Avery Admin', identifier: 'film', size: 60 * 1024 * 1024 })
    );
    const film = new Uint8Array([
      0,
      0,
      0,
      0x18,
      ...new TextEncoder().encode('ftypisom'),
      0,
      0,
      0,
      0,
    ]);
    node({
      statuses: ['PUBLISHED', 'PUBLISHED', 'READY'],
      meta: null,
      files: { '': { bytes: film, type: 'video/mp4' } },
    });
    await user.click(screen.getByRole('button', { name: 'Open File' }));
    const dialog = await screen.findByRole('dialog', {}, T);
    expect(await within(dialog).findByText('Get it from the network?', {}, T)).toBeInTheDocument();
    expect(dialog).toHaveTextContent('This file is 60 MB, and your node isn’t holding it yet.');
    expect(fetchCalls.some((path) => path.includes('build=true'))).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Get it' }));
    // Then it is fetched (and built), and plays from the node.
    await waitFor(() => expect(dialog.querySelector('video')).not.toBeNull(), T);
    expect(fetchCalls.some((path) => path.includes('build=true'))).toBe(true);
    expect(dialog.querySelector('video')?.getAttribute('src')).toBe(
      '/arbitrary/VIDEO/Avery%20Admin/film'
    );
  });

  it('says why a file can’t be opened', async () => {
    const { user } = await show(publish({}));
    node({ statuses: ['BLOCKED'], meta: null, files: {} });
    await user.click(screen.getByRole('button', { name: 'Open File' }));
    const dialog = await screen.findByRole('dialog', {}, T);
    expect(
      await within(dialog).findByText('Your node blocks this resource.', {}, T)
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save File' })).toBeDisabled();
  });

  it('lists a website’s files and opens one; Open in Qortal opens the site', async () => {
    const { user } = await show(
      publish({ service: 200, name: 'AA Maps', identifier: 'default', size: 380_000 })
    );
    node({
      meta: { title: 'AA Maps', files: ['index.html', 'logo.png'] },
      files: {
        'index.html': {
          bytes: new TextEncoder().encode('<!DOCTYPE html><html><script>alert(1)</script></html>'),
          type: 'text/html',
        },
      },
    });
    mockQortalRequest('OPEN_NEW_TAB', true);
    await user.click(screen.getByRole('button', { name: 'Open File' }));
    const dialog = await screen.findByRole('dialog', {}, T);
    const list = await within(dialog).findByRole('list', { name: 'Files in this resource' }, T);
    expect(
      within(list)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['index.html', 'logo.png']);
    expect(within(dialog).getByRole('button', { name: 'Save File' })).toBeDisabled();
    await user.click(within(list).getByRole('button', { name: 'index.html' }));
    expect(
      await within(dialog).findByText('The page’s source, as written. It isn’t run here.', {}, T)
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: 'index.html' })).toHaveTextContent(
      '<script>alert(1)</script>'
    );
    expect(document.querySelector('script')?.textContent ?? '').not.toContain('alert(1)');
    expect(
      fetchCalls.some((path) => path === '/arbitrary/WEBSITE/AA%20Maps/default?filepath=index.html')
    ).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Open in Qortal' }));
    expect(qortalCallsFor('OPEN_NEW_TAB')[0]).toMatchObject({
      qortalLink: 'qortal://WEBSITE/AA Maps',
    });
    await user.click(within(dialog).getByRole('button', { name: /All 2 files/ }));
    expect(
      await within(dialog).findByRole('list', { name: 'Files in this resource' }, T)
    ).toBeInTheDocument();
  });

  it('says when this transaction published an earlier version, and links the latest', async () => {
    const { user } = await show(publish({}));
    node({
      latest: 'LATESTsig',
      meta: null,
      files: { '': { bytes: SETTINGS, type: 'application/json' } },
    });
    await user.click(screen.getByRole('button', { name: 'Open File' }));
    const dialog = await screen.findByRole('dialog', {}, T);
    const note = await within(dialog).findByRole('note', {}, T);
    expect(note).toHaveTextContent(
      'This transaction published an earlier version. Your node shows the latest one'
    );
    expect(
      within(note).getByRole('link', { name: 'Open the latest version’s transaction' })
    ).toHaveAttribute('href', '/explorer/tx/LATESTsig');
  });
});

describe('Save File', () => {
  it('opens the viewer and saves once the file is ready, under its own name', async () => {
    const { user } = await show(publish({}));
    node({
      statuses: ['DOWNLOADING', 'READY'],
      meta: { files: ['settings.json'], mimeType: 'application/json' },
      files: { '': { bytes: SETTINGS, type: 'application/json' } },
    });
    mockQortalRequest('SAVE_FILE', true);
    await user.click(screen.getByRole('button', { name: 'Save File' }));
    const dialog = await screen.findByRole('dialog', {}, T);
    await waitFor(() => expect(qortalCallsFor('SAVE_FILE')).toHaveLength(1), T);
    expect(qortalCallsFor('SAVE_FILE')[0]).toMatchObject({
      filename: 'settings.json',
      mimeType: 'application/json',
    });
    expect(await within(dialog).findByText('Hub is saving it.', {}, T)).toBeInTheDocument();
  });
});

describe('an encrypted publish', () => {
  it('has neither button, and nothing about it is read', async () => {
    await show(
      publish({ service: 1901, name: 'Avery Two', identifier: 'qortal_qmail_explorer_test' })
    );
    expect(screen.queryByRole('button', { name: 'Open File' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save File' })).toBeNull();
    expect(fetchCalls.filter((path) => path.startsWith('/arbitrary'))).toEqual([]);
  });
});
