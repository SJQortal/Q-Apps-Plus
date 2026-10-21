/**
 * What an attachment is, from the hints the mail JSON carries (data contract
 * §6): `type` (a MIME string or null), `originalFilename`/`filename` and the
 * optional `size`. No Qortal calls here; pure helpers shared by the cache, the
 * cards and the preview dialog.
 */

export type AttachmentKind = 'image' | 'pdf' | 'text' | 'audio' | 'video' | 'archive' | 'other';

/** The attachment reference as written by NewMessage/NewThread (§6). */
export interface AttachmentRef {
  name: string;
  service: string;
  identifier: string;
  filename?: string;
  originalFilename?: string;
  type?: string | null;
  size?: number;
  /** Older readers pass `type` under this key. */
  mimeTypeSaved?: string | null;
}

const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'opus', 'weba'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'];
const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'webm', 'ogv', '3gp', 'mkv'];
const TEXT_EXT = [
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'tsv',
  'log',
  'xml',
  'yaml',
  'yml',
  'ini',
  'cfg',
  'conf',
  'toml',
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'ts',
  'tsx',
  'jsx',
  'py',
  'sh',
  'rs',
  'go',
  'java',
  'c',
  'h',
  'cpp',
  'hpp',
  'sql',
];
const ARCHIVE_EXT = ['zip', 'rar', '7z', 'gz', 'tar', 'tgz', 'bz2', 'xz', 'apk'];

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  gz: 'application/gzip',
  tgz: 'application/gzip',
  tar: 'application/x-tar',
  bz2: 'application/x-bzip2',
  xz: 'application/x-xz',
  apk: 'application/vnd.android.package-archive',
  json: 'application/json',
  xml: 'application/xml',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  log: 'text/plain',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  epub: 'application/epub+zip',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  opus: 'audio/opus',
  weba: 'audio/webm',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
  '3gp': 'video/3gpp',
  mkv: 'video/x-matroska',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon',
};

export const OCTET_STREAM = 'application/octet-stream';

export function fileExtension(filename: string | undefined | null): string {
  const name = String(filename || '').trim();
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

/** MIME type guessed from the file extension; `application/octet-stream` when unknown. */
export function mimeFromFilename(filename: string | undefined | null): string {
  const ext = fileExtension(filename);
  if (!ext) return OCTET_STREAM;
  if (EXT_MIME[ext]) return EXT_MIME[ext];
  if (TEXT_EXT.includes(ext)) return 'text/plain';
  return OCTET_STREAM;
}

/** The name to show and to save under: `originalFilename`, else `filename`. */
export function attachmentDisplayName(ref: Partial<AttachmentRef> | null | undefined): string {
  const original = String(ref?.originalFilename || '').trim();
  if (original) return original;
  const stored = String(ref?.filename || '').trim();
  if (stored) return stored;
  return 'attachment';
}

function cleanMime(value: unknown): string {
  const mime = String(value || '')
    .trim()
    .toLowerCase();
  if (!mime || mime === 'null' || mime === 'undefined') return '';
  return mime;
}

/**
 * Resolve the MIME type in this order: the reference's `type`, then the type
 * reported by GET_QDN_RESOURCE_PROPERTIES, then the file extension.
 */
export function resolveMimeType(ref: Partial<AttachmentRef> | null | undefined, propertiesMime?: unknown): string {
  const fromRef = cleanMime(ref?.type) || cleanMime(ref?.mimeTypeSaved);
  if (fromRef && fromRef !== OCTET_STREAM) return fromRef;
  const fromProps = cleanMime(propertiesMime);
  if (fromProps && fromProps !== OCTET_STREAM) return fromProps;
  const fromName = mimeFromFilename(attachmentDisplayName(ref));
  if (fromName !== OCTET_STREAM) return fromName;
  return fromRef || fromProps || OCTET_STREAM;
}

export function attachmentKind(ref: Partial<AttachmentRef> | null | undefined, mimeType?: string): AttachmentKind {
  const mime = cleanMime(mimeType) || cleanMime(resolveMimeType(ref));
  const ext = fileExtension(attachmentDisplayName(ref));
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') || IMAGE_EXT.includes(ext)) return 'image';
  if (mime.startsWith('video/') || VIDEO_EXT.includes(ext)) return 'video';
  if (mime.startsWith('audio/') || AUDIO_EXT.includes(ext)) return 'audio';
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/yaml' ||
    TEXT_EXT.includes(ext)
  ) {
    return 'text';
  }
  if (ARCHIVE_EXT.includes(ext) || mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) {
    return 'archive';
  }
  return 'other';
}

/** "1.2 MB" style size; empty when unknown. */
export function formatFileSize(bytes: number | undefined | null): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** The size hint the reference carries (NewMessage writes it, NewThread does not). */
export function attachmentSizeHint(ref: Partial<AttachmentRef> | null | undefined): number | undefined {
  const n = Number(ref?.size);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
