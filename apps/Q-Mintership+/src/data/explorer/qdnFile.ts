/**
 * Open File and Save File's reads (Simon, 2026-10-17): the public QDN
 * resource a transaction published, read only once one of them is
 * pressed. All GET, relative to the node like every Explorer read; never
 * an encrypted resource (rules/explorer/qdnFiles.ts openableResource).
 *
 * - Its metadata, `/arbitrary/metadata/{service}/{name}/{identifier}`: the
 *   publisher's title, description, file names and type (Core fetches the
 *   small metadata file from peers when it hasn't got it). Key
 *   `xqdnmeta:<service>/<name>/<identifier>`, kept 10 minutes; none (404)
 *   is an answer, not an error.
 * - Where it stands on the node, `/arbitrary/resource/status/…`: first as
 *   it is, then with `build=true` while the node gets it (a resource whose
 *   parts are all there is put together before Core answers; without it,
 *   it can stay DOWNLOADED: docs/QORTAL.md). Never cached.
 * - Its latest version, one `searchsimple` page for its name and service
 *   (`xqdnlatest:…`, 3 minutes): a transaction may have published an
 *   earlier one, and Core serves the latest.
 * - The file, `/arbitrary/{service}/{name}/{identifier}[?filepath=…]`, in
 *   byte ranges: one byte for its size and type, its first bytes for its
 *   kind, a text's first 512 KB, a ZIP's last bytes. Core doesn't hold a
 *   range's end to the file's size (a longer one breaks the answer), so
 *   every range after the first is cut to the size. Images, video and
 *   audio get the URL and stream.
 */
import { CoreHttpError, coreUrl, safeText } from '../../qortal/client';
import type { QdnResourceRef } from '../../rules/explorer/qdnFiles';
import { getJson, query, seg } from '../core';
import { searchQdn } from '../qdn';
import { fetchQuery } from '../query';

export type { QdnResourceRef };

/** One resource, as a key part: `IMAGE/igorcoin/x_p` (`default` for its default identifier). */
export function resourceKey(ref: QdnResourceRef): string {
  return `${ref.service}/${ref.name}/${ref.identifier ?? 'default'}`;
}

/** The resource's path on the node (`default` stands for its default identifier, as Core reads it). */
export function resourcePath(ref: QdnResourceRef): string {
  return `/arbitrary/${seg(ref.service)}/${seg(ref.name)}/${seg(ref.identifier ?? 'default')}`;
}

/** The file's URL: the resource's own file, or `filepath` inside a resource of several files. */
export function fileUrl(ref: QdnResourceRef, filepath?: string | null): string {
  return coreUrl(filepath ? `${resourcePath(ref)}?${query({ filepath })}` : resourcePath(ref));
}

export interface QdnMeta {
  title: string | null;
  description: string | null;
  tags: string[];
  category: string | null;
  /** The files it holds, as their publisher listed them; null when the metadata doesn't say. */
  files: string[] | null;
  /** The type its publisher gave. */
  mimeType: string | null;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

/** getQdnMeta's key. */
export function qdnMetaKey(ref: QdnResourceRef): string {
  return `xqdnmeta:${resourceKey(ref)}`;
}

/** The resource's metadata, or null when it has none (Core's 404). */
export function getQdnMeta(
  ref: QdnResourceRef,
  options: { force?: boolean } = {}
): Promise<QdnMeta | null> {
  return fetchQuery(
    qdnMetaKey(ref),
    async () => {
      try {
        const body = await getJson<Record<string, unknown>>(
          `/arbitrary/metadata/${seg(ref.service)}/${seg(ref.name)}/${seg(ref.identifier ?? 'default')}`
        );
        const files = Array.isArray(body?.files)
          ? body.files.filter((file): file is string => typeof file === 'string' && file !== '')
          : null;
        return {
          title: text(body?.title),
          description: text(body?.description),
          tags: Array.isArray(body?.tags)
            ? body.tags.filter((tag): tag is string => typeof tag === 'string')
            : [],
          category: text(body?.categoryName) ?? text(body?.category),
          files: files && files.length ? files : null,
          mimeType: text(body?.mimeType),
        };
      } catch (error) {
        if (error instanceof CoreHttpError && error.status === 404) return null;
        throw error;
      }
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

/** Core's statuses that won't change by waiting. */
export const FINAL_STATUSES: ReadonlySet<string> = new Set([
  'NOT_PUBLISHED',
  'BLOCKED',
  'UNSUPPORTED',
  'BUILD_FAILED',
]);

export interface QdnStatus {
  /** Core's status: READY, DOWNLOADING, MISSING_DATA, … */
  status: string;
  /** How much of it the node holds, 0–100, when Core says. */
  percent: number | null;
  /** Its parts on the node and in all, when Core says. */
  chunks: { local: number; total: number } | null;
}

/** Where the resource stands on the node; `build` puts it together when it can (and starts fetching it). */
export async function getQdnStatus(
  ref: QdnResourceRef,
  options: { build?: boolean } = {}
): Promise<QdnStatus> {
  const path = `/arbitrary/resource/status/${seg(ref.service)}/${seg(ref.name)}/${seg(ref.identifier ?? 'default')}`;
  const body = await getJson<Record<string, unknown>>(options.build ? `${path}?build=true` : path);
  const status = typeof body?.status === 'string' ? body.status : 'UNKNOWN';
  const number = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const local = number(body?.localChunkCount);
  const total = number(body?.totalChunkCount);
  const percent = number(body?.percentLoaded);
  return {
    status,
    percent: percent === null ? null : Math.max(0, Math.min(100, percent)),
    chunks: local !== null && total !== null && total > 0 ? { local, total } : null,
  };
}

export interface QdnVersion {
  /** The signature of the transaction that published its latest version. */
  signature: string;
  /** When the resource was first published, and last updated (ms). */
  created: number | null;
  updated: number | null;
}

/** getQdnLatest's key. */
export function qdnLatestKey(ref: QdnResourceRef): string {
  return `xqdnlatest:${resourceKey(ref)}`;
}

/**
 * The resource's latest version as Core's index has it: an exact search of
 * its name and service (and identifier), one page; null when it isn't in
 * that page (a default identifier among more than 20 of one name).
 */
export function getQdnLatest(
  ref: QdnResourceRef,
  options: { force?: boolean } = {}
): Promise<QdnVersion | null> {
  return fetchQuery(
    qdnLatestKey(ref),
    async () => {
      const page = await searchQdn(
        {
          service: ref.service,
          names: [ref.name],
          // No identifier asks for every one of this name and service (an empty one is left out).
          identifier: ref.identifier ?? '',
          prefix: false,
          maxPages: 1,
          pageSize: ref.identifier ? 1 : 20,
        },
        options
      );
      const row = page.rows.find((candidate) =>
        ref.identifier
          ? candidate.identifier === ref.identifier
          : !candidate.identifier || candidate.identifier === 'default'
      );
      if (!row?.latestSignature) return null;
      return {
        signature: row.latestSignature,
        created: typeof row.created === 'number' ? row.created : null,
        updated: typeof row.updated === 'number' ? row.updated : null,
      };
    },
    { ttlMs: 3 * 60_000, force: options.force }
  );
}

/** What reading the file failed on, beyond a plain HTTP error. */
export type FileReadProblem = 'several' | 'notFound';

export class QdnFileError extends Error {
  readonly problem: FileReadProblem | null;
  readonly status: number;
  constructor(status: number, message: string, problem: FileReadProblem | null) {
    super(message);
    this.name = 'QdnFileError';
    this.status = status;
    this.problem = problem;
  }
}

async function failure(response: Response): Promise<QdnFileError> {
  const body = await safeText(response);
  let message = body;
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed?.message === 'string') message = parsed.message;
  } catch {
    // Plain text.
  }
  const problem: FileReadProblem | null = /filepath is required/i.test(message)
    ? 'several'
    : response.status === 404 || /file not found|no file exists/i.test(message)
      ? 'notFound'
      : null;
  return new QdnFileError(
    response.status,
    `Core ${response.status} for the file${message ? `: ${message}` : ''}`,
    problem
  );
}

export interface FileProbe {
  /** The file's size in bytes, when the node said. */
  size: number | null;
  /** The type the node serves it with (by its extension), when it said. */
  contentType: string | null;
}

/** Up to `max` bytes of a response's body; the rest is never read. */
async function readUpTo(
  response: Response,
  max: number
): Promise<{ bytes: Uint8Array; more: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const all = new Uint8Array(await response.arrayBuffer());
    return { bytes: all.subarray(0, max), more: all.length > max };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  let more = false;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  if (total >= max) {
    more = total > max;
    if (!more) {
      // Exactly `max` so far: one more read tells whether the file goes on.
      const next = await reader.read();
      more = !next.done && (next.value?.length ?? 0) > 0;
    }
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(Math.min(total, max));
  let at = 0;
  for (const chunk of chunks) {
    if (at >= bytes.length) break;
    const part = chunk.subarray(0, bytes.length - at);
    bytes.set(part, at);
    at += part.length;
  }
  return { bytes, more };
}

/**
 * The file's size and type, from its first byte (a range of one byte: the
 * answer's Content-Range carries the size). A node that ignores ranges
 * answers the whole file: only its headers are read. A page on another
 * origin than the node (the dev server) can't read Content-Range (Core
 * doesn't expose it), so there the size stays unknown and reads are capped
 * as they stream instead; Hub and GO serve the app from the node itself.
 */
export async function probeFile(ref: QdnResourceRef, filepath?: string | null): Promise<FileProbe> {
  const url = fileUrl(ref, filepath);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  } catch (error) {
    // An empty file breaks a one-byte range on Core (it promises a byte it hasn't got).
    response = await fetch(url).catch(() => {
      throw error;
    });
  }
  if (!response.ok) throw await failure(response);
  const contentType = response.headers.get('Content-Type');
  let size: number | null = null;
  const range = /\/(\d+)\s*$/.exec(response.headers.get('Content-Range') ?? '');
  if (range) size = Number(range[1]);
  else if (response.status === 200) {
    const length = Number(response.headers.get('Content-Length'));
    if (Number.isFinite(length) && length >= 0 && response.headers.has('Content-Length'))
      size = length;
  }
  // The one byte asked for is read; a whole file (a node that ignored the range) is not.
  if (response.status === 206) await response.arrayBuffer().catch(() => undefined);
  else await response.body?.cancel().catch(() => undefined);
  return { size, contentType: contentType && contentType.trim() ? contentType : null };
}

/**
 * Bytes `from` to `to` (inclusive) of the file, cut to its `size` when
 * known (Core needs that). Without a size, or from a node that ignores
 * ranges, the file is read from its start and only what is needed kept.
 */
export async function readFileRange(
  ref: QdnResourceRef,
  filepath: string | null | undefined,
  range: { from: number; to: number; size: number | null }
): Promise<Uint8Array> {
  const last = range.size === null ? range.to : Math.min(range.to, range.size - 1);
  if (last < range.from) return new Uint8Array(0);
  const url = fileUrl(ref, filepath);
  const response =
    range.size === null
      ? await fetch(url)
      : await fetch(url, { headers: { Range: `bytes=${range.from}-${last}` } });
  if (!response.ok) throw await failure(response);
  if (response.status === 206) return new Uint8Array(await response.arrayBuffer());
  const { bytes } = await readUpTo(response, last + 1);
  return bytes.subarray(range.from);
}

/** The file's first `max` bytes, and whether there is more. */
export async function readFileStart(
  ref: QdnResourceRef,
  filepath: string | null | undefined,
  max: number,
  size: number | null
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (size !== null) {
    const bytes = await readFileRange(ref, filepath, { from: 0, to: max - 1, size });
    return { bytes, truncated: size > bytes.length };
  }
  const response = await fetch(fileUrl(ref, filepath));
  if (!response.ok) throw await failure(response);
  const { bytes, more } = await readUpTo(response, max);
  return { bytes, truncated: more };
}

/** The whole file as a Blob of type `mime` (a PDF for the reader, a file for Save File). */
export async function readFileBlob(
  ref: QdnResourceRef,
  filepath: string | null | undefined,
  mime: string
): Promise<Blob> {
  const response = await fetch(fileUrl(ref, filepath));
  if (!response.ok) throw await failure(response);
  const blob = await response.blob();
  return blob.type === mime ? blob : blob.slice(0, blob.size, mime);
}
