/**
 * Collections are a Q-Share+ addition (CLAUDE.md rule 1: additive data only).
 * A collection is one DOCUMENT `qshare_collection_<slug>_<uid>` whose JSON
 * body lists shares by publisher name and metadata identifier. The original
 * Q-Share never searches this prefix, so it ignores them. Edits republish the
 * same identifier and the latest publish wins; QDN has no delete, so
 * "deleting" a collection republishes it with no items.
 */
import { QSHARE_COLLECTION_BASE } from "../constants/Identifiers";
import { MAX_MARKERS, ownerAddress, stripRecipientMarkers, withRecipientMarkers } from "./recipientMarker";
import { objectToBase64 } from "./toBase64";
import { fetchQdnResource, needsEncodedFetch } from "./fetchVideos";
import {
  QDN_PAGE,
  QDN_SEARCH_TTL_MS,
  invalidateQdnSearches,
  searchQdn,
  type QdnResourceSummary,
} from "./qdnSearch";

export const COLLECTION_SERVICE = "DOCUMENT";
export const COLLECTION_FILENAME = "collection.json";
export const COLLECTION_VERSION = 1;
export const COLLECTION_TITLE_MAX = 50;
export const COLLECTION_DESCRIPTION_MAX = 150;
export const COLLECTION_SLUG_MAX = 30;
export const COLLECTION_UID_LENGTH = 6;
/** Qortal identifiers are limited to 64 characters. */
export const QDN_IDENTIFIER_MAX = 64;

/** One share inside a collection: the publisher and the share's DOCUMENT metadata id. */
export interface CollectionItem {
  name: string;
  identifier: string;
}

/** The JSON body stored on QDN. */
export interface CollectionBody {
  version: number;
  title: string;
  description: string;
  items: CollectionItem[];
  /** ms */
  created: number;
  /** ms */
  updated: number;
}

/** A search row: what the list shows before the body is fetched. */
export interface CollectionSummary {
  name: string;
  identifier: string;
  title: string;
  description: string;
  created?: number;
  updated?: number;
}

/** A fetched body plus where it lives. */
export interface Collection extends CollectionBody {
  name: string;
  identifier: string;
  /** When this copy was read or published (ms), to spot newer publishes. */
  fetchedAt: number;
}

export interface CollectionPublishPayload {
  action: "PUBLISH_QDN_RESOURCE";
  name: string;
  service: string;
  identifier: string;
  data64: string;
  title: string;
  description: string;
  tag1: string;
  filename: string;
}

export function collectionKey(name: string, identifier: string): string {
  return `${name}/${identifier}`;
}

/** Title → `[a-z0-9-]`, spaces to dashes, collapsed, at most 30 chars, "collection" when empty. */
export function slugifyCollectionTitle(title: string): string {
  const slug = String(title ?? "")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, COLLECTION_SLUG_MAX)
    .replace(/-+$/g, "");
  return slug || "collection";
}

const UID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function newCollectionUid(): string {
  const bytes = new Uint8Array(COLLECTION_UID_LENGTH);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => UID_ALPHABET[b % UID_ALPHABET.length]).join("");
}

/** `qshare_collection_<slug≤30>_<uid>`: at most 18 + 30 + 1 + 6 = 55 characters. */
export function buildCollectionIdentifier(title: string, uid: string): string {
  return `${QSHARE_COLLECTION_BASE}${slugifyCollectionTitle(title)}_${uid}`;
}

export function isCollectionIdentifier(identifier: unknown): identifier is string {
  return typeof identifier === "string" && identifier.startsWith(QSHARE_COLLECTION_BASE);
}

export function sameItem(a: CollectionItem, b: CollectionItem): boolean {
  return a.name === b.name && a.identifier === b.identifier;
}

export function dedupeItems(items: CollectionItem[]): CollectionItem[] {
  const out: CollectionItem[] = [];
  for (const item of items) {
    if (!out.some((seen) => sameItem(seen, item))) out.push({ name: item.name, identifier: item.identifier });
  }
  return out;
}

export function hasItem(collection: { items: CollectionItem[] }, item: CollectionItem): boolean {
  return collection.items.some((existing) => sameItem(existing, item));
}

/** Pure: a copy with `item` added when absent, removed when present. */
export function toggleItem<T extends { items: CollectionItem[] }>(collection: T, item: CollectionItem): T {
  const items = hasItem(collection, item)
    ? collection.items.filter((existing) => !sameItem(existing, item))
    : [...dedupeItems(collection.items), { name: item.name, identifier: item.identifier }];
  return { ...collection, items };
}

export function buildCollectionBody(input: {
  title: string;
  description?: string;
  items?: CollectionItem[];
  created?: number;
  now?: number;
}): CollectionBody {
  const now = input.now ?? Date.now();
  return {
    version: COLLECTION_VERSION,
    title: String(input.title ?? "")
      .trim()
      .slice(0, COLLECTION_TITLE_MAX),
    description: String(input.description ?? "")
      .trim()
      .slice(0, COLLECTION_DESCRIPTION_MAX),
    items: dedupeItems(input.items ?? []),
    created: typeof input.created === "number" && input.created > 0 ? input.created : now,
    updated: now,
  };
}

/** The PUBLISH_QDN_RESOURCE payload; Hub asks the user to confirm it. */
export async function buildCollectionPublish(input: {
  name: string;
  identifier: string;
  body: CollectionBody;
  /** Owners (addresses) of shares this publish adds, for their notifications (recipientMarker.ts). */
  recipients?: string[];
}): Promise<CollectionPublishPayload> {
  const { name, identifier, body, recipients = [] } = input;
  return {
    action: "PUBLISH_QDN_RESOURCE",
    name,
    service: COLLECTION_SERVICE,
    identifier,
    data64: await objectToBase64(body),
    title: body.title.slice(0, COLLECTION_TITLE_MAX),
    description: withRecipientMarkers(body.description.slice(0, COLLECTION_DESCRIPTION_MAX), recipients),
    tag1: QSHARE_COLLECTION_BASE,
    filename: COLLECTION_FILENAME,
  };
}

function toTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function isItem(value: unknown): value is CollectionItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.name === "string" &&
    item.name.length > 0 &&
    typeof item.identifier === "string" &&
    item.identifier.length > 0
  );
}

/**
 * Validate a body read from QDN (an object, or its JSON text). Returns null
 * for anything that is not a collection; items with a missing name or
 * identifier are dropped rather than failing the whole collection.
 */
export function parseCollection(raw: unknown): CollectionBody | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.title !== "string" || !Array.isArray(obj.items)) return null;
  const version = toTimestamp(obj.version);
  if (version === null || version < 1) return null;
  const created = toTimestamp(obj.created);
  const updated = toTimestamp(obj.updated);
  return {
    version,
    title: obj.title.slice(0, COLLECTION_TITLE_MAX),
    description: typeof obj.description === "string" ? obj.description.slice(0, COLLECTION_DESCRIPTION_MAX) : "",
    items: dedupeItems(obj.items.filter(isItem)),
    created: created ?? updated ?? 0,
    updated: updated ?? created ?? 0,
  };
}

export function summaryToCollection(row: QdnResourceSummary): CollectionSummary {
  return {
    name: row.name,
    identifier: row.identifier,
    title: row.metadata?.title ?? "",
    description: stripRecipientMarkers(row.metadata?.description ?? ""),
    created: row.created,
    updated: row.updated,
  };
}

export interface SearchCollectionsParams {
  /** Only this publisher's collections (exact name). */
  name?: string;
  offset?: number;
  /** Defaults to a page of 20; never 0. */
  limit?: number;
  fresh?: boolean;
}

/** One paged search, merged and cached by searchQdn. Same style as the `qshare_file_` search. */
export async function searchCollections(params: SearchCollectionsParams = {}): Promise<CollectionSummary[]> {
  const rows = await searchQdn(
    {
      service: COLLECTION_SERVICE,
      identifier: QSHARE_COLLECTION_BASE,
      name: params.name || undefined,
      includemetadata: true,
      limit: params.limit ?? QDN_PAGE,
      offset: params.offset ?? 0,
    },
    { fresh: params.fresh }
  );
  return rows.filter((row) => isCollectionIdentifier(row.identifier)).map(summaryToCollection);
}

export const COLLECTION_BODY_TTL_MS = QDN_SEARCH_TTL_MS;
const bodyCache = new Map<string, { collection: Collection; expires: number }>();
const bodyInflight = new Map<string, Promise<Collection | null>>();

function remember(collection: Collection): Collection {
  bodyCache.set(collectionKey(collection.name, collection.identifier), {
    collection,
    expires: Date.now() + COLLECTION_BODY_TTL_MS,
  });
  return collection;
}

export function getCachedCollection(name: string, identifier: string): Collection | null {
  const hit = bodyCache.get(collectionKey(name, identifier));
  return hit && hit.expires > Date.now() ? hit.collection : null;
}

/**
 * Read one collection body (FETCH_QDN_RESOURCE), cached for the session and
 * merged while in flight. Resolves null when the resource is not a valid
 * collection; rejects when the node cannot serve it.
 */
export async function fetchCollection(
  name: string,
  identifier: string,
  options: { fresh?: boolean } = {}
): Promise<Collection | null> {
  const key = collectionKey(name, identifier);
  if (!options.fresh) {
    const cached = getCachedCollection(name, identifier);
    if (cached) return cached;
    const pending = bodyInflight.get(key);
    if (pending) return pending;
  } else {
    bodyCache.delete(key);
  }
  const request = (async () => {
    // q-apps.js doesn't encode the name, so a name with "/" would read Core's error page.
    const raw = needsEncodedFetch(name)
      ? await fetchQdnResource(COLLECTION_SERVICE, name, identifier)
      : await qortalRequest({ action: "FETCH_QDN_RESOURCE", name, service: COLLECTION_SERVICE, identifier });
    const body = parseCollection(raw);
    if (!body) return null;
    return remember({ ...body, name, identifier, fetchedAt: Date.now() });
  })();
  bodyInflight.set(key, request);
  const forget = () => {
    if (bodyInflight.get(key) === request) bodyInflight.delete(key);
  };
  request.then(forget, forget);
  return request;
}

/** Drop cached bodies and cached collection searches, e.g. after a publish. */
export function invalidateCollectionCaches(): void {
  bodyCache.clear();
  invalidateQdnSearches((url) => url.includes(`identifier=${QSHARE_COLLECTION_BASE}`));
}

/**
 * Publish (create or update) a collection. Hub shows one confirmation and
 * the usual small QDN fee applies. Caches are invalidated and the published
 * body is kept as the current copy, so the app does not re-read it.
 */
export async function publishCollection(input: {
  name: string;
  identifier: string;
  body: CollectionBody;
  /** The items before this change; without it, the copy the app last read (or none: a new collection). */
  previousItems?: CollectionItem[];
}): Promise<Collection> {
  const previous = input.previousItems ?? getCachedCollection(input.name, input.identifier)?.items ?? [];
  const recipients = await markedShareOwners(input.name, previous, input.body.items);
  const payload = await buildCollectionPublish({ ...input, recipients });
  await qortalRequest(payload);
  invalidateCollectionCaches();
  return remember({ ...input.body, name: input.name, identifier: input.identifier, fetchedAt: Date.now() });
}

/**
 * The accounts a publish of `next` names in its markers: the owners of the
 * shares it adds to `previous` (newest first), then of the newest shares
 * already in it, so a marker stays through later publishes until four newer
 * owners push it out (an owner whose app was closed meanwhile still finds it;
 * what was already read is never reported twice). Never the publisher's own
 * account; at most MAX_MARKERS. A name Core can't resolve is skipped.
 */
export async function markedShareOwners(
  publisher: string,
  previous: CollectionItem[],
  next: CollectionItem[]
): Promise<string[]> {
  const isNew = (item: CollectionItem) => !previous.some((old) => sameItem(old, item));
  const newestFirst = [...next].reverse();
  const ordered = [...newestFirst.filter(isNew), ...newestFirst.filter((item) => !isNew(item))];
  const names = [...new Map(ordered.map((item) => [item.name.toLowerCase(), item.name])).values()];
  if (!names.length) return [];
  const own = await ownerAddress(publisher);
  const addresses: string[] = [];
  // One lookup at a time (remembered for the session), stopping at four owners.
  for (const name of names) {
    const address = await ownerAddress(name);
    if (address && address !== own && !addresses.includes(address)) addresses.push(address);
    if (addresses.length >= MAX_MARKERS) break;
  }
  return addresses;
}

/** In-app route for a collection page. */
export function collectionPath(name: string, identifier: string): string {
  return `/collection/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

/** For tests. */
export function resetCollectionCaches(): void {
  bodyCache.clear();
  bodyInflight.clear();
}
