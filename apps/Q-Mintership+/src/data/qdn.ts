/**
 * QDN reads: paged `searchsimple` and small JSON bodies.
 *
 * Bodies are keyed by name + identifier + latest signature, so a republish
 * is read again and an old copy is never shown under a new version
 * (docs/QORTAL.md → Hub & GO pitfalls 15). A body that isn't on the node yet
 * is retried at 2, 4, 8 and 16 s, then reported as unavailable.
 */
import { coreGet } from '../qortal/client';
import { getPaged, query, seg, type PagedResult } from './core';
import { fetchQuery } from './query';
import type { QdnRow } from './types';

export interface QdnSearch {
  service: string;
  identifier: string;
  /** Match identifiers starting with `identifier` (default true). */
  prefix?: boolean;
  /** Only these publishers. */
  names?: string[];
  /** Newest first (default true). */
  reverse?: boolean;
  /** Only resources created after this time (ms). */
  after?: number;
  /** Pages of 100; default 10 (1,000 rows). */
  maxPages?: number;
  pageSize?: number;
}

/** `GET /arbitrary/resources/searchsimple`, paged and cached for 3 minutes. */
export function searchQdn(
  params: QdnSearch,
  options: { force?: boolean } = {}
): Promise<PagedResult<QdnRow>> {
  const base = {
    service: params.service,
    identifier: params.identifier,
    prefix: params.prefix ?? true,
    name: params.names,
    reverse: params.reverse ?? true,
    after: params.after,
  };
  const key = `qdnsearch:${query({ ...base, maxPages: params.maxPages, pageSize: params.pageSize })}`;
  return fetchQuery(
    key,
    () =>
      getPaged<QdnRow>(
        (offset, limit) => `/arbitrary/resources/searchsimple?${query({ ...base, limit, offset })}`,
        { maxPages: params.maxPages ?? 10, pageSize: params.pageSize }
      ),
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

/** The newest timestamp of a search row. */
export function rowTime(row: Pick<QdnRow, 'created' | 'updated'>): number {
  return row.updated ?? row.created;
}

export class QdnUnavailableError extends Error {
  constructor(public readonly ref: string) {
    super('Not available on your node right now');
    this.name = 'QdnUnavailableError';
  }
}

export class QdnDeletedError extends Error {
  constructor(public readonly ref: string) {
    super('This item was deleted by its publisher');
    this.name = 'QdnDeletedError';
  }
}

const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000];
let retryDelays = RETRY_DELAYS_MS;

/** Tests shorten the retry delays. */
export function setQdnRetryDelays(delays: number[]): void {
  retryDelays = delays;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The raw text of a resource, retrying while the node fetches it from peers. */
export async function fetchQdnText(
  service: string,
  name: string,
  identifier: string
): Promise<string> {
  const path = `/arbitrary/${seg(service)}/${seg(name)}/${seg(identifier)}`;
  for (let attempt = 0; ; attempt++) {
    let response: Response | null = null;
    try {
      response = await coreGet(path, 'text/plain, application/json');
    } catch {
      response = null;
    }
    if (response?.ok) {
      const text = await response.text();
      if (text.trim() === 'D') throw new QdnDeletedError(path);
      return text;
    }
    if (attempt >= retryDelays.length) throw new QdnUnavailableError(path);
    await wait(retryDelays[attempt]);
  }
}

/**
 * A JSON body, cached for the session per version. `version` should be the
 * search row's latest signature (or its newest timestamp).
 */
export function fetchQdnJson<T = unknown>(
  service: string,
  name: string,
  identifier: string,
  version: string | number
): Promise<T> {
  return fetchQuery(
    `qdnbody:${service}:${name}:${identifier}:${version}`,
    async () => JSON.parse(await fetchQdnText(service, name, identifier)) as T,
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/** Run `work` over `items`, at most `limit` at a time (Hub/GO queue politely). */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}
