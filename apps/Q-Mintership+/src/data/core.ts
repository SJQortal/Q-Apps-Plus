/**
 * GET-only access to Core's REST API, with paging that never asks for
 * everything at once (CLAUDE.md rule 4: no `limit=0`, page every list).
 *
 * The app never POSTs to the node: every write goes through Hub
 * (qortalRequest), which shows the user what will be signed.
 */
import { coreJson, coreText } from '../qortal/client';

/** Core's own page cap for most list endpoints is far above this; 100 is what Core answers fast. */
export const PAGE_SIZE = 100;

export interface PagedResult<T> {
  rows: T[];
  /** True when `maxPages` stopped the read before Core ran out of rows. */
  truncated: boolean;
  pages: number;
}

/** Join query parameters; arrays repeat the key (`txType=A&txType=B`). */
export function query(
  params: Record<
    string,
    string | number | boolean | undefined | null | readonly (string | number)[]
  >
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value)
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join('&');
}

/** Encode one path segment (names can hold spaces, `+`, `/` and non-ASCII). */
export function seg(value: string | number): string {
  return encodeURIComponent(String(value));
}

export async function getJson<T>(path: string): Promise<T> {
  return coreJson<T>(path);
}

export async function getText(path: string): Promise<string> {
  return coreText(path);
}

/**
 * Read a paged list `pageSize` rows at a time until a short page, never more
 * than `maxPages` pages. `path(offset, limit)` builds each page's URL.
 */
export async function getPaged<T>(
  path: (offset: number, limit: number) => string,
  options: { pageSize?: number; maxPages?: number; pick?: (body: unknown) => T[] } = {}
): Promise<PagedResult<T>> {
  const pageSize = Math.max(1, Math.min(options.pageSize ?? PAGE_SIZE, 100));
  const maxPages = Math.max(1, options.maxPages ?? 10);
  const pick = options.pick ?? ((body: unknown) => (Array.isArray(body) ? (body as T[]) : []));
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const body = await getJson<unknown>(path(page * pageSize, pageSize));
    const chunk = pick(body);
    rows.push(...chunk);
    if (chunk.length < pageSize) return { rows, truncated: false, pages: page + 1 };
  }
  return { rows, truncated: true, pages: maxPages };
}
