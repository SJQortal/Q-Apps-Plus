/**
 * Collections are a Q-Share+ addition (CLAUDE.md rule 1: additive data only).
 * A collection is one DOCUMENT `qshare_collection_<slug>_<uid>` whose JSON
 * body lists shares by publisher name and metadata identifier. The original
 * Q-Share never searches this prefix, so it ignores them. Edits republish the
 * same identifier and the latest publish wins; QDN has no delete, so
 * "deleting" a collection republishes it with no items.
 *
 * Since 1.0.1 a body may also have `folders` (a tree of folders, each with
 * its own items and subfolders, utils/collectionFolders.ts) and a `cover`
 * (a THUMBNAIL `qshare_cover_<uid>` under the publisher's name), and folders
 * may have covers too. A copy of someone else's collection names its source
 * in `copiedFrom`, and its markers always name the source's owner. Both are left out when unused, so a collection
 * without them is stored exactly as before. Fields this version doesn't
 * know are kept through edits.
 */
import { QSHARE_COLLECTION_BASE } from "../constants/Identifiers";
import { MAX_MARKERS, ownerAddress, stripRecipientMarkers, withRecipientMarkers } from "./recipientMarker";
import { objectToBase64 } from "./toBase64";
import { allCollectionItems } from "./collectionFolders";
import { isHubDecline } from "./hubErrors";
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
/** Covers are THUMBNAILs (Core takes up to 500 KB) with their own prefix, never searched by the app. */
export const COVER_SERVICE = "THUMBNAIL";
export const COVER_BASE = "qshare_cover_";
export const COVER_UID_LENGTH = 8;
export const FOLDER_TITLE_MAX = 50;
export const FOLDER_DESCRIPTION_MAX = 150;
export const FOLDER_ID_LENGTH = 6;
/** Folders inside folders, at most this deep (a collection's own folders are depth 1). */
export const MAX_FOLDER_DEPTH = 5;
/** Folders in one collection, all depths together. */
export const MAX_FOLDERS = 200;
/** Qortal identifiers are limited to 64 characters. */
export const QDN_IDENTIFIER_MAX = 64;

/** One share inside a collection: the publisher and the share's DOCUMENT metadata id. */
export interface CollectionItem {
  name: string;
  identifier: string;
}

/** An image published for a collection or folder: a THUMBNAIL under the collection's name. */
export interface CollectionCover {
  service: "THUMBNAIL";
  name: string;
  identifier: string;
}

/** A folder inside a collection: its own shares and subfolders. */
export interface CollectionFolder {
  /** Unique within the collection; never reused for another folder. */
  id: string;
  title: string;
  description: string;
  cover?: CollectionCover;
  items: CollectionItem[];
  folders: CollectionFolder[];
}

/** The collection a copy was made from. */
export interface CollectionSource {
  name: string;
  identifier: string;
  title: string;
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
  cover?: CollectionCover;
  folders?: CollectionFolder[];
  /** Set on a copy: the collection it was copied from. */
  copiedFrom?: CollectionSource;
  /** Fields of the stored JSON this version doesn't know, written back unchanged. */
  extra?: Record<string, unknown>;
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
  cover?: CollectionCover | null;
  folders?: CollectionFolder[];
  copiedFrom?: CollectionSource;
  extra?: Record<string, unknown>;
}): CollectionBody {
  const now = input.now ?? Date.now();
  const body: CollectionBody = {
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
  if (input.cover) body.cover = input.cover;
  if (input.folders && input.folders.length > 0) body.folders = input.folders;
  if (input.copiedFrom) body.copiedFrom = input.copiedFrom;
  if (input.extra && Object.keys(input.extra).length > 0) body.extra = input.extra;
  return body;
}

/**
 * The next version of a collection: the same body with `changes`, its
 * folders, cover and unknown fields carried over, `updated` set to now.
 */
export function editCollectionBody(
  current: CollectionBody,
  changes: Partial<Pick<CollectionBody, "title" | "description" | "items" | "folders">> & { cover?: CollectionCover | null } = {},
  now?: number
): CollectionBody {
  return buildCollectionBody({
    title: changes.title ?? current.title,
    description: changes.description ?? current.description,
    items: changes.items ?? current.items,
    created: current.created,
    now,
    cover: changes.cover === undefined ? current.cover : changes.cover,
    folders: changes.folders ?? current.folders,
    copiedFrom: current.copiedFrom,
    extra: current.extra,
  });
}

/**
 * A copy of someone's collection, to publish under the copier's name: its
 * shares, folders and covers (the covers stay the original's images), a
 * title and description of the copier's choosing, and `copiedFrom`.
 */
export function copyCollectionBody(
  source: Pick<Collection, "name" | "identifier" | "title" | "items" | "folders" | "cover">,
  input: { title: string; description: string; now?: number }
): CollectionBody {
  return buildCollectionBody({
    title: input.title,
    description: input.description,
    items: source.items,
    folders: source.folders,
    cover: source.cover ?? null,
    copiedFrom: { name: source.name, identifier: source.identifier, title: source.title },
    now: input.now,
  });
}

/** The JSON stored on QDN: unknown fields first, then the known ones; empty folders and no cover are left out. */
export function storedCollectionJson(body: CollectionBody): Record<string, unknown> {
  const { extra, cover, folders, copiedFrom, ...known } = body;
  return {
    ...(extra ?? {}),
    ...known,
    ...(cover ? { cover } : {}),
    ...(folders && folders.length > 0 ? { folders } : {}),
    ...(copiedFrom ? { copiedFrom } : {}),
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
    data64: await objectToBase64(storedCollectionJson(body)),
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

/** A cover read from QDN, or undefined for anything else. */
export function parseCover(raw: unknown): CollectionCover | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const cover = raw as Record<string, unknown>;
  if (cover.service !== COVER_SERVICE) return undefined;
  if (typeof cover.name !== "string" || !cover.name) return undefined;
  if (typeof cover.identifier !== "string" || !cover.identifier || cover.identifier.length > QDN_IDENTIFIER_MAX) {
    return undefined;
  }
  return { service: COVER_SERVICE, name: cover.name, identifier: cover.identifier };
}

/**
 * Folders read from QDN. Anything that isn't a folder is dropped, as are
 * repeated ids, folders deeper than MAX_FOLDER_DEPTH and any past MAX_FOLDERS.
 */
export function parseFolders(raw: unknown, depth = 1, seen = new Set<string>()): CollectionFolder[] {
  if (!Array.isArray(raw) || depth > MAX_FOLDER_DEPTH) return [];
  const out: CollectionFolder[] = [];
  for (const value of raw) {
    if (seen.size >= MAX_FOLDERS) break;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const folder = value as Record<string, unknown>;
    if (typeof folder.id !== "string" || !folder.id || seen.has(folder.id)) continue;
    if (typeof folder.title !== "string") continue;
    seen.add(folder.id);
    const cover = parseCover(folder.cover);
    out.push({
      id: folder.id,
      title: folder.title.slice(0, FOLDER_TITLE_MAX),
      description: typeof folder.description === "string" ? folder.description.slice(0, FOLDER_DESCRIPTION_MAX) : "",
      ...(cover ? { cover } : {}),
      items: dedupeItems(Array.isArray(folder.items) ? folder.items.filter(isItem) : []),
      folders: parseFolders(folder.folders, depth + 1, seen),
    });
  }
  return out;
}

const KNOWN_FIELDS = new Set(["version", "title", "description", "items", "created", "updated", "cover", "folders", "copiedFrom"]);

/** A copy's source read from QDN, or undefined for anything else. */
export function parseSource(raw: unknown): CollectionSource | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Record<string, unknown>;
  if (typeof source.name !== "string" || !source.name) return undefined;
  if (!isCollectionIdentifier(source.identifier)) return undefined;
  return {
    name: source.name,
    identifier: source.identifier,
    title: typeof source.title === "string" ? source.title.slice(0, COLLECTION_TITLE_MAX) : "",
  };
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
  const body: CollectionBody = {
    version,
    title: obj.title.slice(0, COLLECTION_TITLE_MAX),
    description: typeof obj.description === "string" ? obj.description.slice(0, COLLECTION_DESCRIPTION_MAX) : "",
    items: dedupeItems(obj.items.filter(isItem)),
    created: created ?? updated ?? 0,
    updated: updated ?? created ?? 0,
  };
  const cover = parseCover(obj.cover);
  if (cover) body.cover = cover;
  const folders = parseFolders(obj.folders);
  if (folders.length > 0) body.folders = folders;
  const copiedFrom = parseSource(obj.copiedFrom);
  if (copiedFrom) body.copiedFrom = copiedFrom;
  const extra = Object.fromEntries(Object.entries(obj).filter(([key]) => !KNOWN_FIELDS.has(key)));
  if (Object.keys(extra).length > 0) body.extra = extra;
  return body;
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
  /**
   * Words to look for: Core matches them anywhere in the name, identifier,
   * title or description, ignoring case (`query`, without `prefix`).
   */
  query?: string;
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
      query: params.query?.trim() || undefined,
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

/** A new cover's identifier: `qshare_cover_<8 random characters>` (a new one per image, so no copy is stale). */
export function newCoverIdentifier(): string {
  const bytes = new Uint8Array(COVER_UID_LENGTH);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return COVER_BASE + Array.from(bytes, (b) => UID_ALPHABET[b % UID_ALPHABET.length]).join("");
}

export interface CoverPublishPayload {
  action: "PUBLISH_QDN_RESOURCE";
  name: string;
  service: typeof COVER_SERVICE;
  identifier: string;
  file: File;
  filename: string;
  title: string;
  tag1: string;
}

/** A new cover image to publish with the collection. */
export interface NewCover {
  identifier: string;
  file: File;
}

export function buildCoverPublish(input: { name: string; cover: NewCover; title: string }): CoverPublishPayload {
  return {
    action: "PUBLISH_QDN_RESOURCE",
    name: input.name,
    service: COVER_SERVICE,
    identifier: input.cover.identifier,
    file: input.cover.file,
    filename: input.cover.file.name,
    title: input.title.slice(0, COLLECTION_TITLE_MAX),
    tag1: COVER_BASE,
  };
}

/** Where the node serves a cover. */
export function coverUrl(cover: Pick<CollectionCover, "name" | "identifier">): string {
  return `/arbitrary/${COVER_SERVICE}/${encodeURIComponent(cover.name)}/${encodeURIComponent(cover.identifier)}`;
}

/**
 * Publish (create or update) a collection. Hub shows one confirmation and
 * the usual small QDN fee applies; a new cover image goes in the same
 * request (PUBLISH_MULTIPLE_QDN_RESOURCES), before the collection, which
 * names it. Caches are invalidated and the published body is kept as the
 * current copy, so the app does not re-read it.
 */
export async function publishCollection(input: {
  name: string;
  identifier: string;
  body: CollectionBody;
  /** The items before this change; without it, the copy the app last read (or none: a new collection). */
  previousItems?: CollectionItem[];
  /** The body before this change, for its items in every folder; preferred over `previousItems`. */
  previous?: CollectionBody | null;
  /** Images the body's new covers point at, published first. */
  covers?: NewCover[];
  /** Called when the collection was published but a new cover wasn't. */
  onCoversFailed?: () => void;
}): Promise<Collection> {
  const before = input.previous ?? getCachedCollection(input.name, input.identifier);
  const previous = input.previous ? allCollectionItems(input.previous) : (input.previousItems ?? (before ? allCollectionItems(before) : []));
  // A copy always names its source's owner first, so their Q-Share+ finds it.
  const leading = input.body.copiedFrom ? [input.body.copiedFrom.name] : [];
  const recipients = await markedShareOwners(input.name, previous, allCollectionItems(input.body), leading);
  const payload = await buildCollectionPublish({ ...input, recipients });
  const covers = input.covers ?? [];
  if (covers.length > 0) {
    try {
      await qortalRequest({
        action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
        resources: [...covers.map((cover) => buildCoverPublish({ name: input.name, cover, title: input.body.title })), payload],
      });
    } catch (error) {
      // Hub names what it couldn't publish. When only a cover failed, the
      // collection is on QDN: report it saved, and let the caller say the
      // cover needs choosing again (saving again would pay for both).
      const failed: string[] = ((error as { error?: { unsuccessfulPublishes?: Array<{ identifier?: string }> } })?.error
        ?.unsuccessfulPublishes ?? [])
        .map((item) => item?.identifier ?? "")
        .filter(Boolean);
      if (failed.length === 0 || failed.includes(input.identifier) || isHubDecline(error)) throw error;
      input.onCoversFailed?.();
    }
  } else {
    await qortalRequest(payload);
  }
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
  next: CollectionItem[],
  /** Names to mark before any share owner (a copy's source). */
  leading: string[] = []
): Promise<string[]> {
  const isNew = (item: CollectionItem) => !previous.some((old) => sameItem(old, item));
  const newestFirst = [...next].reverse();
  const ordered = [...newestFirst.filter(isNew), ...newestFirst.filter((item) => !isNew(item))];
  const names = [
    ...new Map([...leading, ...ordered.map((item) => item.name)].map((name) => [name.toLowerCase(), name])).values(),
  ];
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

/** In-app route for a collection page, or one of its folders. */
export function collectionPath(name: string, identifier: string, folderId?: string | null): string {
  const base = `/collection/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
  return folderId ? `${base}/folder/${encodeURIComponent(folderId)}` : base;
}

/** For tests. */
export function resetCollectionCaches(): void {
  bodyCache.clear();
  bodyInflight.clear();
}
