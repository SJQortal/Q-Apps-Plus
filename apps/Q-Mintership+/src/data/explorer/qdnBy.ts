/**
 * What an account published on QDN, name by name: QDN resources belong to a
 * name, not an address, so each of its names is one read,
 * `/arbitrary/resources/searchsimple?name=<n>&limit=100&reverse=true`
 * (newest first, every service). One name per read: with several names and
 * no service Core scans the whole table. Rows are kept only when their name
 * is exactly the one asked for (a prefix rule must never widen it to
 * someone else's name).
 *
 * Each name is cached for the session under `xqdnname:<name>` (shared by
 * every account page and Compare), and a page reads at most 4 names at once
 * (data/qdn.ts mapLimit). Encrypted services (`*_PRIVATE`, MAIL) are kept as
 * counts only: their identifiers are dropped as the rows come in.
 */
import { getJson, query } from '../core';
import { mapLimit } from '../qdn';
import { fetchQuery } from '../query';
import { isPrivateService, serviceName } from '../../rules/explorer/qdnServices';

/** One read's rows per name: the newest this many. */
export const QDN_NAME_LIMIT = 100;
/** Names read at once. */
export const QDN_CONCURRENCY = 4;
/** Names searched without asking: the primary and the newest. */
export const QDN_AUTO_NAMES = 10;

export interface QdnResource {
  name: string;
  /** Core's service name ("APP", "MAIL_PRIVATE"). */
  service: string;
  /** Null for the default resource, and always null for an encrypted service. */
  identifier: string | null;
  size: number | null;
  created: number;
  updated?: number;
}

export interface QdnOfName {
  name: string;
  /** Newest first. */
  resources: QdnResource[];
  /** Core had the page full: the name has more than this. */
  capped: boolean;
}

export function qdnNameKey(name: string): string {
  return `xqdnname:${name}`;
}

function toResource(row: Record<string, unknown>, name: string): QdnResource | null {
  const service = serviceName(row.service);
  if (!service) return null;
  const created = Number(row.created);
  const updated = Number(row.updated);
  const identifier =
    typeof row.identifier === 'string' && row.identifier && !isPrivateService(service)
      ? row.identifier
      : null;
  return {
    name,
    service,
    identifier,
    size: typeof row.size === 'number' && Number.isFinite(row.size) ? row.size : null,
    created: Number.isFinite(created) ? created : 0,
    ...(Number.isFinite(updated) && updated > 0 ? { updated } : {}),
  };
}

/** Everything one name published (the newest 100). */
export function getQdnOfName(name: string, options: { force?: boolean } = {}): Promise<QdnOfName> {
  return fetchQuery(
    qdnNameKey(name),
    async () => {
      const body = await getJson<unknown>(
        `/arbitrary/resources/searchsimple?${query({
          name,
          limit: QDN_NAME_LIMIT,
          reverse: true,
        })}`
      );
      const raw = Array.isArray(body) ? body : [];
      const resources = raw
        .filter(
          (row): row is Record<string, unknown> =>
            Boolean(row) && typeof row === 'object' && (row as { name?: unknown }).name === name
        )
        .map((row) => toResource(row, name))
        .filter((row): row is QdnResource => row !== null)
        .sort((a, b) => b.created - a.created);
      return { name, resources, capped: raw.length >= QDN_NAME_LIMIT };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

/**
 * The names searched without asking: the primary name, then the ones
 * registered most recently (the end of Core's list), `count` in all.
 */
export function autoQdnNames(
  names: readonly string[],
  primary: string | null,
  count = QDN_AUTO_NAMES
): string[] {
  const picked: string[] = [];
  if (primary && names.includes(primary)) picked.push(primary);
  for (let i = names.length - 1; i >= 0 && picked.length < count; i--) {
    if (names[i] !== primary) picked.push(names[i]);
  }
  return picked;
}

export type QdnSearchResult = { ok: true; data: QdnOfName } | { ok: false; error: unknown };

/**
 * Read `names` 4 at a time, telling `onResult` as each one answers. Once
 * `stopped()` is true, the names not started yet are skipped (a read already
 * running finishes: Core does the work either way).
 */
export async function searchQdnNames(
  names: readonly string[],
  options: {
    onResult: (name: string, result: QdnSearchResult) => void;
    stopped?: () => boolean;
    concurrency?: number;
  }
): Promise<void> {
  await mapLimit([...names], options.concurrency ?? QDN_CONCURRENCY, async (name) => {
    if (options.stopped?.()) return;
    try {
      options.onResult(name, { ok: true, data: await getQdnOfName(name) });
    } catch (error) {
      options.onResult(name, { ok: false, error });
    }
  });
}

export interface QdnServiceCount {
  service: string;
  count: number;
  /** A name that hit the cap had some: there may be more. */
  partial: boolean;
  encrypted: boolean;
}

export interface QdnSummary {
  /** Resources found in the names read. */
  total: number;
  /** Per service, by name (APP, JSON, MAIL_PRIVATE, …). */
  counts: QdnServiceCount[];
  /** Resources that can be listed (not encrypted), newest first. */
  listed: QdnResource[];
  /** Encrypted resources: counted, never listed. */
  encrypted: number;
  /** Names with more than 100 resources: only their newest 100 are counted. */
  capped: string[];
}

/** Counts per service and the newest resources across the names read. */
export function summarizeQdn(results: readonly QdnOfName[]): QdnSummary {
  const counts = new Map<string, QdnServiceCount>();
  const listed: QdnResource[] = [];
  let total = 0;
  let encrypted = 0;
  for (const result of results) {
    for (const resource of result.resources) {
      total += 1;
      const secret = isPrivateService(resource.service);
      const entry = counts.get(resource.service) ?? {
        service: resource.service,
        count: 0,
        partial: false,
        encrypted: secret,
      };
      entry.count += 1;
      if (result.capped) entry.partial = true;
      counts.set(resource.service, entry);
      if (secret) encrypted += 1;
      else listed.push(resource);
    }
  }
  listed.sort((a, b) => b.created - a.created);
  return {
    total,
    counts: [...counts.values()].sort((a, b) => a.service.localeCompare(b.service)),
    listed,
    encrypted,
    capped: results.filter((result) => result.capped).map((result) => result.name),
  };
}

/** "240 bytes", "1.2 KB", "52 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1).replace(/\.0$/, '')} ${units[unit]}`;
}
