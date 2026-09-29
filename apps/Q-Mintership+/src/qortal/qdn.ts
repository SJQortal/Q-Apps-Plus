/**
 * QDN reads and writes (legacy QortalApi.js "QDN data calls"). Searches use
 * Core's `/arbitrary/resources/searchsimple` and `/arbitrary/resources/search`
 * exactly as the original did; publishing and decryption go through Hub.
 */
import { coreGet, coreJson, coreUrl, qortal, safeText } from './client';
import { DEFAULT_PAGE_SIZE } from './constants';
import { base64ToBlob, base64ToBlobUrl, base64ToObject, trimString } from './util';

export type QdnService =
  | 'BLOG_POST'
  | 'MAIL_PRIVATE'
  | 'FILE'
  | 'FILE_PRIVATE'
  | 'DOCUMENT'
  | 'DOCUMENT_PRIVATE'
  | 'THUMBNAIL'
  | 'JSON'
  | (string & {});

/** One row from a QDN search. */
export interface QdnResource {
  name: string;
  service: QdnService;
  identifier: string;
  created?: number;
  updated?: number;
  size?: number;
  status?: { status?: string; percentLoaded?: number; [key: string]: unknown };
  metadata?: { title?: string; description?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface QdnResourceRef {
  name: string;
  service: QdnService;
  identifier: string;
}

export interface SearchSimpleParams {
  service: QdnService;
  identifier?: string;
  name?: string;
  /** Page size; never 0 (docs/QORTAL.md). */
  limit?: number;
  offset?: number;
  /** The legacy "room" argument; when set the full query form is used. */
  room?: string;
  reverse?: boolean;
  prefixOnly?: boolean;
  /** Only resources created after this timestamp; null and NaN mean 0. */
  after?: number | null;
}

/**
 * The query string `searchSimple` sends, kept identical to the legacy app's
 * three forms so Core sees the same requests. Exported for tests.
 */
export function buildSearchSimpleQuery(params: SearchSimpleParams): string | null {
  const service = params.service;
  const identifier = params.identifier ?? '';
  const name = params.name ?? '';
  const room = params.room ?? '';
  const limit = normalizeLimit(params.limit);
  const offset = params.offset ?? 0;
  const reverse = params.reverse ?? true;
  const prefixOnly = params.prefixOnly ?? true;
  const afterRaw = params.after;
  const after =
    afterRaw === null || afterRaw === undefined || Number.isNaN(afterRaw) ? 0 : afterRaw;

  if (name && !identifier && !room) {
    return `service=${service}&name=${name}&limit=${limit}&prefix=true&reverse=${reverse}&after=${after}`;
  }
  if (!name && identifier && !room) {
    return `service=${service}&identifier=${identifier}&limit=${limit}&prefix=true&reverse=${reverse}&after=${after}`;
  }
  if (!name && !identifier && !room) return null;
  return `service=${service}&identifier=${identifier}&name=${name}&prefix=true&limit=${limit}&offset=${offset}&reverse=${reverse}&prefix=${prefixOnly}&after=${after}`;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit === 'number' && limit > 0) return limit;
  return DEFAULT_PAGE_SIZE;
}

/**
 * `/arbitrary/resources/searchsimple`. Always returns an array (empty for no
 * results; the legacy function returned null). Throws on a network error.
 * Needs a name or an identifier.
 */
export async function searchSimple(params: SearchSimpleParams): Promise<QdnResource[]> {
  const query = buildSearchSimpleQuery(params);
  if (query === null) throw new Error('searchSimple needs a name or an identifier');
  const response = await coreGet(`/arbitrary/resources/searchsimple?${query}`);
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as QdnResource[]) : [];
}

/** The first match, or null (the legacy `limit === 1` behaviour). */
export async function searchSimpleOne(
  params: Omit<SearchSimpleParams, 'limit'>
): Promise<QdnResource | null> {
  const rows = await searchSimple({ ...params, limit: 1 });
  return rows[0] ?? null;
}

export interface SearchQdnParams {
  service: QdnService;
  query?: string;
  identifier?: string;
  name?: string;
  names?: string[];
  limit?: number;
  offset?: number;
  prefix?: boolean;
  reverse?: boolean;
  exactMatchNames?: boolean;
  includeMetadata?: boolean;
  includeStatus?: boolean;
  mode?: 'ALL' | 'LATEST';
  after?: number;
}

/** SEARCH_QDN_RESOURCES through Hub, always with a limit. */
export async function searchQdnResources(params: SearchQdnParams): Promise<QdnResource[]> {
  const limit = normalizeLimit(params.limit);
  const request: Record<string, unknown> = { action: 'SEARCH_QDN_RESOURCES', ...params, limit };
  const data = await qortal<unknown>(request as { action: string } & Record<string, unknown>);
  return Array.isArray(data) ? (data as QdnResource[]) : [];
}

/**
 * The legacy forum search (`searchAllWithOffset`): BLOG_POST for public rooms,
 * MAIL_PRIVATE for the admins room, `mode: "ALL"`, oldest first. Empty on error.
 */
export async function searchAllWithOffset(
  service: QdnService | '' | undefined,
  query: string,
  limit: number,
  offset: number,
  room?: string
): Promise<QdnResource[]> {
  try {
    if (room === 'admins') {
      return await searchQdnResources({
        service: service || 'MAIL_PRIVATE',
        query,
        limit,
        offset,
        mode: 'ALL',
        reverse: false,
      });
    }
    if (!service || service === 'BLOG_POST') {
      return await searchQdnResources({
        service: 'BLOG_POST',
        query,
        limit,
        offset,
        mode: 'ALL',
        reverse: false,
      });
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Count matches by paging through them (legacy `searchAllCountOnly`). This is
 * a fetch-all loop; the + app pages with "load more" instead, so only call it
 * where a total is really needed. `maxPages` stops a runaway loop.
 */
export async function countSearchSimple(
  service: QdnService,
  identifierPrefix: string,
  room = '',
  pageSize = 100,
  maxPages = 50
): Promise<number> {
  let offset = 0;
  let total = 0;
  for (let page = 0; page < maxPages; page++) {
    const rows = await searchSimple({
      service,
      identifier: identifierPrefix,
      name: '',
      limit: pageSize,
      offset,
      room,
      reverse: false,
    });
    if (rows.length === 0) break;
    total += rows.length;
    offset = total;
    if (rows.length < pageSize) break;
  }
  return total;
}

/** `/arbitrary/resources/search?query=…&includemetadata=true` (legacy searchResourcesWithMetadata). */
export async function searchResourcesWithMetadata(
  query: string,
  limit = 200
): Promise<QdnResource[]> {
  const safeLimit = limit && limit >= 10 ? limit : 200;
  return coreJson<QdnResource[]>(
    `/arbitrary/resources/search?query=${query}&mode=ALL&includestatus=true&includemetadata=true&limit=${safeLimit}&reverse=true`
  );
}

/** `/arbitrary/resources/search?query=…&after=…` without metadata (legacy searchAllResources). */
export async function searchAllResources(
  query: string,
  limit = 200,
  after = 0,
  reverse = false
): Promise<QdnResource[]> {
  const safeLimit = limit && limit >= 10 ? limit : 200;
  return coreJson<QdnResource[]>(
    `/arbitrary/resources/search?query=${query}&mode=ALL&after=${after ?? 0}&includestatus=false&includemetadata=false&limit=${safeLimit}&reverse=${reverse}`
  );
}

/**
 * `/arbitrary/resources/search?service=DOCUMENT&identifier=…` for every
 * version of a resource (legacy searchLatestDataByIdentifier, which had no
 * limit). Null on failure.
 */
export async function searchLatestDataByIdentifier(
  identifier: string,
  limit = DEFAULT_PAGE_SIZE
): Promise<QdnResource[] | null> {
  try {
    return await coreJson<QdnResource[]>(
      `/arbitrary/resources/search?service=DOCUMENT&identifier=${identifier}&includestatus=true&mode=ALL&limit=${normalizeLimit(limit)}&reverse=true`
    );
  } catch {
    return null;
  }
}

/** Search with status and keep only local or only not-yet-downloaded rows (legacy searchResourcesWithStatus). */
export async function searchResourcesWithStatus(
  query: string,
  limit = 200,
  status: 'local' | 'notLocal' | '' = 'local'
): Promise<QdnResource[]> {
  const safeLimit = limit && limit >= 10 ? limit : 200;
  const data = await coreJson<QdnResource[]>(
    `/arbitrary/resources/search?query=${query}&includestatus=true&limit=${safeLimit}&reverse=true`
  );
  if (status === 'notLocal') return data.filter((r) => r.status?.status === 'published');
  if (status === 'local') {
    return data.filter((r) => Boolean(r.status?.status) && r.status?.status !== 'published');
  }
  return data;
}

/** `/arbitrary/metadata/{service}/{name}/{identifier}`. */
export async function getResourceMetadata(ref: QdnResourceRef): Promise<Record<string, unknown>> {
  return coreJson<Record<string, unknown>>(
    `/arbitrary/metadata/${ref.service}/${ref.name}/${ref.identifier}`
  );
}

export interface QdnStatus {
  status: string;
  percentLoaded?: number;
  localChunkCount?: number;
  totalChunkCount?: number;
  [key: string]: unknown;
}

/** GET_QDN_RESOURCE_STATUS: download progress for a resource not yet held locally. */
export async function getResourceStatus(ref: QdnResourceRef): Promise<QdnStatus> {
  return qortal<QdnStatus>({ action: 'GET_QDN_RESOURCE_STATUS', ...ref });
}

/**
 * FETCH_QDN_RESOURCE. Public JSON comes back parsed; pass `encoding: 'base64'`
 * for encrypted data (the admin room and boards) and decrypt it afterwards.
 */
export async function fetchQdnResource<T = unknown>(
  ref: QdnResourceRef,
  options: { encoding?: 'base64' } = {}
): Promise<T> {
  return qortal<T>({
    action: 'FETCH_QDN_RESOURCE',
    name: ref.name,
    service: ref.service,
    identifier: ref.identifier,
    ...(options.encoding ? { encoding: options.encoding } : {}),
  });
}

/** DECRYPT_DATA on base64 input; Hub returns the decrypted payload as base64. */
export async function decryptObject(encryptedData: string): Promise<string> {
  return qortal<string>({ action: 'DECRYPT_DATA', encryptedData });
}

/** Decrypt base64 and parse the JSON inside (legacy decryptAndParseObject). */
export async function decryptAndParseObject<T = unknown>(base64Data: string): Promise<T> {
  return base64ToObject<T>(await decryptObject(base64Data));
}

export interface PublishResourceInput {
  name: string;
  service: QdnService;
  identifier: string;
  data64?: string;
  base64?: string;
  file?: File | Blob;
  filename?: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
}

/** PUBLISH_MULTIPLE_QDN_RESOURCES, optionally encrypted to a list of public keys. Null on failure. */
export async function publishMultipleResources(
  resources: PublishResourceInput[],
  publicKeys: string[] | null = null,
  isPrivate = false
): Promise<unknown> {
  const request: Record<string, unknown> = { action: 'PUBLISH_MULTIPLE_QDN_RESOURCES', resources };
  if (isPrivate && publicKeys) {
    request.encrypt = true;
    request.publicKeys = publicKeys;
  }
  try {
    return await qortal(request as { action: string } & Record<string, unknown>);
  } catch {
    return null;
  }
}

/** PUBLISH_QDN_RESOURCE for one JSON resource, plain or encrypted to public keys. */
export async function publishResource(
  input: PublishResourceInput & { encrypt?: boolean; publicKeys?: string[] }
): Promise<unknown> {
  return qortal({ action: 'PUBLISH_QDN_RESOURCE', ...input });
}

/** The URL a public file is served from (images in the forum use this directly). */
export function resourceUrl(ref: QdnResourceRef): string {
  return coreUrl(
    `/arbitrary/${encodeURIComponent(ref.service)}/${encodeURIComponent(ref.name)}/${encodeURIComponent(ref.identifier)}`
  );
}

/** The avatar URL for a name. */
export function avatarUrl(name: string): string {
  return coreUrl(`/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar`);
}

/** The base64 text of a file resource (legacy fetchFileBase64), or null when Core has no data. */
export async function fetchFileBase64(ref: QdnResourceRef): Promise<string | null> {
  const response = await coreGet(
    `/arbitrary/${ref.service}/${ref.name}/${ref.identifier}/?encoding=base64`,
    'text/plain'
  );
  if (!response.ok) return null;
  return response.text();
}

/**
 * The decrypted base64 of an encrypted file (legacy fetchEncryptedImageBase64);
 * null when the file is missing or fails to decrypt.
 */
export async function fetchEncryptedFileBase64(ref: QdnResourceRef): Promise<string | null> {
  try {
    const response = await coreGet(
      `/arbitrary/${ref.service}/${ref.name}/${ref.identifier}?encoding=base64&async=true&attempts=5`,
      'text/plain'
    );
    if (!response.ok) return null;
    return await decryptObject(await response.text());
  } catch {
    return null;
  }
}

/**
 * An object URL for an inline image attachment (legacy loadInLineImageHtml).
 * Admin-room attachments are FILE_PRIVATE and encrypted; the rest are read as-is.
 */
export async function fetchInlineImageUrl(
  ref: QdnResourceRef,
  mimeType: string,
  room = 'admins'
): Promise<string | null> {
  const isEncrypted = room === 'admins';
  const service = ref.service === 'MAIL_PRIVATE' && isEncrypted ? 'FILE_PRIVATE' : ref.service;
  try {
    const response = await coreGet(
      `/arbitrary/${service}/${ref.name}/${ref.identifier}?encoding=base64`,
      'text/plain'
    );
    const data64 = await response.text();
    const base64 = isEncrypted ? await decryptObject(data64) : data64;
    return base64ToBlobUrl(base64, mimeType);
  } catch {
    return null;
  }
}

/**
 * Download an attachment through Hub's SAVE_FILE (legacy fetchAndSaveAttachment).
 * MAIL_PRIVATE attachments are really FILE_PRIVATE and need decrypting first.
 */
export async function fetchAndSaveAttachment(
  ref: QdnResourceRef,
  filename: string,
  mimeType: string
): Promise<void> {
  if (!filename || !mimeType) throw new Error('Filename and mimeType are required');
  const service = ref.service === 'MAIL_PRIVATE' ? 'FILE_PRIVATE' : ref.service;
  const base = `/arbitrary/${service}/${ref.name}/${ref.identifier}?async=true&attempts=5`;
  if (service === 'FILE_PRIVATE') {
    const url = `${base}&encoding=base64`;
    const response = await coreGet(url, 'text/plain');
    if (!response.ok) throw new Error(`File not found (HTTP ${response.status}): ${url}`);
    const decrypted = await decryptObject(await response.text());
    await qortal({ action: 'SAVE_FILE', blob: base64ToBlob(decrypted, mimeType), filename, mimeType });
    return;
  }
  const response = await coreGet(base, 'text/plain');
  if (!response.ok) throw new Error(`File not found (HTTP ${response.status}): ${base}`);
  await qortal({ action: 'SAVE_FILE', blob: await response.blob(), filename, mimeType });
}

/**
 * `/render/{service}/{name}?identifier=` parsed as JSON (legacy renderData).
 * Returns the legacy "still being obtained" message string on failure.
 */
export const RENDER_DATA_PENDING_MESSAGE =
  'Requested data is either missing or still being obtained from QDN... please try again in a short time.';

export async function renderData<T = unknown>(ref: QdnResourceRef): Promise<T | string> {
  try {
    const response = await fetch(
      coreUrl(`/render/${ref.service}/${ref.name}?identifier=${ref.identifier}`),
      { method: 'GET', headers: { accept: '*/*' } }
    );
    if (!response.ok) throw new Error('Error rendering data');
    const text = await safeText(response);
    if (text.includes('<!DOCTYPE')) throw new Error('Received HTML response');
    return JSON.parse(text) as T;
  } catch {
    return RENDER_DATA_PENDING_MESSAGE;
  }
}

export function isQdnResource(value: unknown): value is QdnResource {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as QdnResource).identifier === 'string' &&
    typeof (value as QdnResource).name === 'string'
  );
}

export function resourceKey(ref: QdnResourceRef): string {
  return `${ref.service}:${trimString(ref.name)}:${trimString(ref.identifier)}`;
}
