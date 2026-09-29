/**
 * Every read this app makes against the node, in one place: paged (never
 * `limit=0`), identical requests merged while in flight, and results kept for
 * the session where they rarely change (docs/QORTAL.md). The write actions
 * (register, update, sell, buy, publish avatar) stay where the original app
 * has them, unchanged.
 */
import type { Names, NamesForSale } from '../state/global/names';

export const FOR_SALE_PAGE = 100;
/** Hard ceiling: 50 pages × 100 = 5 000 names for sale. Logged when hit. */
export const FOR_SALE_MAX_PAGES = 50;
export const ACCOUNT_NAMES_PAGE = 100;
export const ACCOUNT_NAMES_MAX_PAGES = 10;
/** Core's searchsimple takes several `name=` params; keep each request modest. */
export const AVATAR_BATCH = 50;
export const AVATAR_IDENTIFIER = 'qortal_avatar';
const AVATAR_TTL_MS = 5 * 60_000;

export interface PagedLoad<T> {
  /** Called after each page with everything loaded so far, so the UI can paint early. */
  onPage?: (rows: T[], done: boolean) => void;
}

/**
 * GET /names/forsale, a page at a time (Core orders by name). Resolves with
 * the whole list, and calls `onPage` as each page arrives.
 */
export async function fetchNamesForSale(
  options: PagedLoad<NamesForSale> = {}
): Promise<NamesForSale[]> {
  const rows: NamesForSale[] = [];
  for (let page = 0; page < FOR_SALE_MAX_PAGES; page++) {
    const res = await fetch(
      `/names/forsale?limit=${FOR_SALE_PAGE}&offset=${page * FOR_SALE_PAGE}&reverse=false`
    );
    if (!res.ok) throw new Error(`names/forsale failed: ${res.status}`);
    const batch = (await res.json()) as unknown;
    if (!Array.isArray(batch)) throw new Error('names/forsale: unexpected response');
    rows.push(...(batch as NamesForSale[]));
    const done = batch.length < FOR_SALE_PAGE;
    options.onPage?.(rows.slice(), done);
    if (done) return rows;
  }
  console.warn(`names/forsale: stopped after ${FOR_SALE_MAX_PAGES} pages`);
  return rows;
}

/** GET_ACCOUNT_NAMES in pages of 100 (the original asked for `limit: 0`). */
export async function fetchAccountNames(address: string): Promise<Names[]> {
  const byName = new Map<string, Names>();
  for (let page = 0; page < ACCOUNT_NAMES_MAX_PAGES; page++) {
    const batch = (await qortalRequest({
      action: 'GET_ACCOUNT_NAMES',
      address,
      limit: ACCOUNT_NAMES_PAGE,
      offset: page * ACCOUNT_NAMES_PAGE,
      reverse: false,
    })) as unknown;
    if (!Array.isArray(batch)) break;
    for (const row of batch as Names[]) byName.set(row.name, row);
    if (batch.length < ACCOUNT_NAMES_PAGE) break;
  }
  return [...byName.values()];
}

const feeCache = new Map<string, Promise<number>>();

/** GET /transactions/unitfee?txType=…, in QORT, fetched once per type per session. */
export function getUnitFee(txType: string): Promise<number> {
  let pending = feeCache.get(txType);
  if (!pending) {
    pending = fetch(`/transactions/unitfee?txType=${encodeURIComponent(txType)}`).then(
      async (res) => {
        if (!res.ok) throw new Error(`unitfee ${txType} failed: ${res.status}`);
        const fee = Number(await res.text());
        if (!Number.isFinite(fee)) throw new Error(`unitfee ${txType}: not a number`);
        return Number((fee / 1e8).toFixed(8));
      }
    );
    pending.catch(() => feeCache.delete(txType));
    feeCache.set(txType, pending);
  }
  return pending;
}

const avatarCache = new Map<string, { has: boolean; expires: number }>();
const avatarInflight = new Map<string, Promise<boolean>>();

/** What the session already knows about a name's avatar, or null. */
export function knownAvatar(name: string): boolean | null {
  const hit = avatarCache.get(name);
  return hit && hit.expires > Date.now() ? hit.has : null;
}

export function rememberAvatar(name: string, has: boolean): void {
  avatarCache.set(name, { has, expires: Date.now() + AVATAR_TTL_MS });
}

export function forgetAvatar(name: string): void {
  avatarCache.delete(name);
}

async function fetchAvatarBatch(names: string[]): Promise<Set<string>> {
  // Exact matches: without `prefix` or `caseInsensitive`, Core compares
  // identifier and each name with `=` (HSQLDBArbitraryRepository.searchArbitraryResourcesSimple).
  const query =
    `service=THUMBNAIL&identifier=${AVATAR_IDENTIFIER}&limit=${names.length}` +
    names.map((name) => `&name=${encodeURIComponent(name)}`).join('');
  const res = await fetch(`/arbitrary/resources/searchsimple?${query}`);
  if (!res.ok) throw new Error(`avatar search failed: ${res.status}`);
  const rows = (await res.json()) as Array<{ name?: string }>;
  return new Set(rows.map((row) => row.name).filter((name): name is string => !!name));
}

/**
 * Which of these names have an avatar published, with one search per 50
 * names instead of one per name. Cached for 5 minutes; concurrent callers
 * share the same request.
 */
export async function checkAvatars(names: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const waits: Promise<unknown>[] = [];
  const missing: string[] = [];
  for (const name of new Set(names)) {
    const known = knownAvatar(name);
    if (known !== null) {
      result.set(name, known);
      continue;
    }
    const inflight = avatarInflight.get(name);
    if (inflight) {
      waits.push(inflight.then((has) => result.set(name, has)));
      continue;
    }
    missing.push(name);
  }
  for (let i = 0; i < missing.length; i += AVATAR_BATCH) {
    const batch = missing.slice(i, i + AVATAR_BATCH);
    const request = fetchAvatarBatch(batch);
    for (const name of batch) {
      const one = request
        .then((found) => {
          const has = found.has(name);
          rememberAvatar(name, has);
          return has;
        })
        .finally(() => avatarInflight.delete(name));
      avatarInflight.set(name, one);
      waits.push(one.then((has) => result.set(name, has)));
    }
  }
  await Promise.all(waits);
  return result;
}

/** Test hook: drop every session cache. */
export function resetNamesApiCaches(): void {
  feeCache.clear();
  avatarCache.clear();
  avatarInflight.clear();
}
