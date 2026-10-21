/**
 * Open File in the Explorer (Simon, 2026-10-17): what kind of file a public
 * QDN resource is, so the viewer shows it the right way. Pure; the reads
 * are data/explorer/qdnFile.ts, the views components/explorer/file.
 *
 * Decided from what is known before the file is read (the publisher's
 * type and file name from Core's metadata, the type Core serves it with,
 * the service), then checked against its first bytes, which win where
 * they are certain (a PDF published as a DOCUMENT is a PDF; a "VIDEO"
 * whose bytes are text is text). Nothing here runs a file: HTML and SVG
 * source show as text or through <img>, which runs no script.
 */
import { isPrivateService, serviceName } from './qdnServices';

export type FileKind =
  'image' | 'video' | 'audio' | 'pdf' | 'json' | 'csv' | 'text' | 'html' | 'zip' | 'binary';

/** Kinds read as text (the first part of the file, with a cap). */
export const TEXT_KINDS: ReadonlySet<FileKind> = new Set(['json', 'csv', 'text', 'html']);

const IMAGE_EXT = [
  'png',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'gif',
  'webp',
  'avif',
  'bmp',
  'ico',
  'svg',
  'apng',
];
const VIDEO_EXT = ['mp4', 'm4v', 'webm', 'ogv', 'mov', 'mkv', '3gp'];
const AUDIO_EXT = ['mp3', 'm4a', 'm4b', 'aac', 'wav', 'ogg', 'oga', 'opus', 'weba', 'flac'];
const TEXT_EXT = [
  'txt',
  'text',
  'md',
  'markdown',
  'log',
  'xml',
  'rss',
  'atom',
  'js',
  'mjs',
  'cjs',
  'jsx',
  'ts',
  'tsx',
  'css',
  'scss',
  'less',
  'py',
  'java',
  'kt',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'yml',
  'yaml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'sql',
  'lua',
  'dart',
  'swift',
  'r',
  'pl',
  'scala',
  'vue',
  'svelte',
  'tex',
  'srt',
  'vtt',
  'rtf',
  'asc',
  'pem',
  'gitignore',
];

const BY_EXTENSION: Readonly<Record<string, FileKind>> = {
  ...Object.fromEntries(IMAGE_EXT.map((ext) => [ext, 'image'])),
  ...Object.fromEntries(VIDEO_EXT.map((ext) => [ext, 'video'])),
  ...Object.fromEntries(AUDIO_EXT.map((ext) => [ext, 'audio'])),
  ...Object.fromEntries(TEXT_EXT.map((ext) => [ext, 'text'])),
  pdf: 'pdf',
  json: 'json',
  geojson: 'json',
  webmanifest: 'json',
  csv: 'csv',
  tsv: 'csv',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  zip: 'zip',
  jar: 'zip',
};

/** Types by extension, for a file Core or its publisher gave no type: Hub refuses a save without one. */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  apng: 'image/apng',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  weba: 'audio/webm',
  flac: 'audio/flac',
  pdf: 'application/pdf',
  json: 'application/json',
  geojson: 'application/geo+json',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  html: 'text/html',
  htm: 'text/html',
  xml: 'application/xml',
  txt: 'text/plain',
  md: 'text/markdown',
  js: 'text/javascript',
  css: 'text/css',
  zip: 'application/zip',
  jar: 'application/java-archive',
  gz: 'application/gzip',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  tar: 'application/x-tar',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  epub: 'application/epub+zip',
  apk: 'application/vnd.android.package-archive',
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

/**
 * The common extension for a type, for a file saved without a name of its
 * own: the first extension listed for it above.
 */
const EXTENSION_BY_MIME: Readonly<Record<string, string>> = Object.entries(
  MIME_BY_EXTENSION
).reduce<Record<string, string>>((out, [ext, mime]) => {
  if (!(mime in out)) out[mime] = ext;
  return out;
}, {});

/** What a type is in words, for files the viewer can't show (before "Save File"). */
const MIME_WORDS: Readonly<Record<string, string>> = {
  'application/msword': 'A Word document (DOC)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'A Word document (DOCX)',
  'application/vnd.ms-excel': 'An Excel spreadsheet (XLS)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'An Excel spreadsheet (XLSX)',
  'application/vnd.ms-powerpoint': 'A PowerPoint presentation (PPT)',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'A PowerPoint presentation (PPTX)',
  'application/vnd.oasis.opendocument.text': 'An OpenDocument text (ODT)',
  'application/vnd.oasis.opendocument.spreadsheet': 'An OpenDocument spreadsheet (ODS)',
  'application/vnd.oasis.opendocument.presentation': 'An OpenDocument presentation (ODP)',
  'application/epub+zip': 'An e-book (EPUB)',
  'application/vnd.android.package-archive': 'An Android app (APK)',
  'application/gzip': 'A gzip archive',
  'application/x-7z-compressed': 'A 7-Zip archive',
  'application/vnd.rar': 'A RAR archive',
  'application/x-tar': 'A tar archive',
  'font/ttf': 'A font (TTF)',
  'font/otf': 'A font (OTF)',
  'font/woff': 'A web font (WOFF)',
  'font/woff2': 'A web font (WOFF2)',
};

const KIND_WORDS: Readonly<Record<FileKind, string>> = {
  image: 'An image',
  video: 'A video',
  audio: 'Audio',
  pdf: 'A PDF document',
  json: 'JSON data',
  csv: 'A table (CSV)',
  text: 'Text',
  html: 'A web page (HTML)',
  zip: 'A ZIP archive',
  binary: 'Binary data',
};

/**
 * Extensions of files the viewer names but doesn't show (a DOCX, an EPUB, a
 * 7-Zip archive): some are ZIPs inside, never listed as one.
 */
const NAMED_BINARY_EXT: Readonly<Record<string, true>> = Object.fromEntries(
  Object.entries(MIME_BY_EXTENSION)
    .filter(([, mime]) => mime in MIME_WORDS)
    .map(([ext]) => [ext, true])
);

/** The extension of a file name, lower case, without the dot ("" when it has none). */
export function extensionOf(filename: string | null | undefined): string {
  if (!filename) return '';
  const base = filename.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1 ? base.slice(dot + 1).toLowerCase() : '';
}

/** A type without its parameters, lower case ("text/plain; charset=utf-8" → "text/plain"). */
export function bareMime(mime: string | null | undefined): string {
  return (mime ?? '').split(';')[0].trim().toLowerCase();
}

/** The kind a type says, or null when it says nothing (none, or octet-stream). */
export function kindFromMime(mime: string | null | undefined): FileKind | null {
  const type = bareMime(mime);
  if (!type || type === 'application/octet-stream' || type === 'binary/octet-stream') return null;
  if (type === 'application/pdf') return 'pdf';
  if (type === 'application/json' || type.endsWith('+json')) return 'json';
  if (type === 'text/csv' || type === 'text/tab-separated-values') return 'csv';
  if (type === 'text/html' || type === 'application/xhtml+xml') return 'html';
  if (
    type === 'application/zip' ||
    type === 'application/x-zip-compressed' ||
    type === 'application/java-archive'
  )
    return 'zip';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (
    type.startsWith('text/') ||
    type === 'application/xml' ||
    type.endsWith('+xml') ||
    type === 'application/javascript' ||
    type === 'application/x-sh' ||
    type === 'application/x-yaml' ||
    type === 'application/toml' ||
    type === 'application/sql'
  )
    return 'text';
  return 'binary';
}

/** The kind a file name's extension says, or null for an extension it doesn't know. */
export function kindFromExtension(filename: string | null | undefined): FileKind | null {
  const ext = extensionOf(filename);
  if (!ext) return null;
  if (ext in NAMED_BINARY_EXT) return 'binary';
  return BY_EXTENSION[ext] ?? null;
}

/** The kind a QDN service suggests when nothing else does. */
export function kindFromService(service: string | null | undefined): FileKind | null {
  switch (service) {
    case 'IMAGE':
    case 'THUMBNAIL':
    case 'QCHAT_IMAGE':
      return 'image';
    case 'VIDEO':
      return 'video';
    case 'AUDIO':
    case 'PODCAST':
    case 'VOICE':
    case 'QCHAT_AUDIO':
    case 'QCHAT_VOICE':
      return 'audio';
    case 'JSON':
    case 'METADATA':
    case 'LIST':
    case 'PLAYLIST':
      return 'json';
    default:
      return null;
  }
}

/** A file's type for its extension, when there is one we know. */
export function mimeForExtension(filename: string | null | undefined): string | null {
  return MIME_BY_EXTENSION[extensionOf(filename)] ?? null;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], at = 0): boolean {
  if (bytes.length < at + signature.length) return false;
  return signature.every((byte, i) => bytes[at + i] === byte);
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let out = '';
  for (let i = from; i < Math.min(to, bytes.length); i++) out += String.fromCharCode(bytes[i]);
  return out;
}

export interface Sniffed {
  kind: FileKind;
  mime: string;
}

/**
 * What the first bytes say for certain, by the signatures of the formats a
 * browser shows (and archives), or null when they match none.
 */
export function sniffBytes(head: Uint8Array): Sniffed | null {
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { kind: 'pdf', mime: 'application/pdf' };
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { kind: 'image', mime: 'image/png' };
  if (startsWith(head, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg' };
  if (ascii(head, 0, 6) === 'GIF87a' || ascii(head, 0, 6) === 'GIF89a')
    return { kind: 'image', mime: 'image/gif' };
  if (ascii(head, 0, 4) === 'RIFF') {
    const form = ascii(head, 8, 12);
    if (form === 'WEBP') return { kind: 'image', mime: 'image/webp' };
    if (form === 'WAVE') return { kind: 'audio', mime: 'audio/wav' };
    if (form === 'AVI ') return { kind: 'binary', mime: 'video/x-msvideo' };
  }
  if (ascii(head, 4, 8) === 'ftyp') {
    const brand = ascii(head, 8, 12);
    if (brand === 'avif' || brand === 'avis') return { kind: 'image', mime: 'image/avif' };
    if (['heic', 'heix', 'mif1', 'msf1', 'hevc'].includes(brand))
      return { kind: 'binary', mime: 'image/heic' };
    if (brand === 'M4A ' || brand === 'M4B ') return { kind: 'audio', mime: 'audio/mp4' };
    if (brand === 'qt  ') return { kind: 'video', mime: 'video/quicktime' };
    return { kind: 'video', mime: 'video/mp4' };
  }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'video', mime: 'video/webm' };
  if (ascii(head, 0, 4) === 'OggS') return { kind: 'audio', mime: 'audio/ogg' };
  if (ascii(head, 0, 4) === 'fLaC') return { kind: 'audio', mime: 'audio/flac' };
  if (ascii(head, 0, 3) === 'ID3') return { kind: 'audio', mime: 'audio/mpeg' };
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0 && (head[1] & 0x06) !== 0)
    return { kind: 'audio', mime: 'audio/mpeg' };
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06]))
    return { kind: 'zip', mime: 'application/zip' };
  if (startsWith(head, [0x1f, 0x8b])) return { kind: 'binary', mime: 'application/gzip' };
  if (startsWith(head, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))
    return { kind: 'binary', mime: 'application/x-7z-compressed' };
  if (ascii(head, 0, 4) === 'Rar!') return { kind: 'binary', mime: 'application/vnd.rar' };
  if (ascii(head, 0, 4) === 'wOFF') return { kind: 'binary', mime: 'font/woff' };
  if (ascii(head, 0, 4) === 'wOF2') return { kind: 'binary', mime: 'font/woff2' };
  return null;
}

/**
 * The first bytes as text, when they are text: UTF-8 (a character cut at
 * the end of what was read is fine), no NUL and hardly any other control
 * characters. Null for binary data.
 */
export function textOf(head: Uint8Array): string | null {
  if (head.length === 0) return '';
  let bytes = head;
  // A UTF-8 byte order mark.
  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) bytes = bytes.subarray(3);
  let text: string | null = null;
  // Up to three bytes of a character cut at the end of the read.
  for (let cut = 0; cut <= 3 && text === null && cut < bytes.length + 1; cut++) {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(0, bytes.length - cut)
      );
    } catch {
      text = null;
    }
  }
  if (text === null) return null;
  let control = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0) return null;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13 && code !== 12) control += 1;
  }
  return control > Math.max(2, text.length / 100) ? null : text;
}

/** Text that starts as JSON does (an object or an array). */
export function looksLikeJson(text: string): boolean {
  return /^\s*[[{]/.test(text);
}

function looksLikeHtml(text: string): boolean {
  return /^\s*(<!doctype html|<html[\s>])/i.test(text);
}

function looksLikeSvg(text: string): boolean {
  return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(
    text
  );
}

export interface FileFacts {
  /** The QDN service, as a name ("IMAGE"). */
  service: string | null;
  /** The type the publisher gave (Core's metadata) or Core serves it with. */
  mimeType?: string | null;
  /** The file's name, from the metadata or the path picked. */
  filename?: string | null;
  /** Its first bytes, when read. */
  head?: Uint8Array | null;
}

export interface FileKindFound {
  kind: FileKind;
  /** The type to show it with and save it as ("application/octet-stream" when unknown). */
  mime: string;
}

/** What was declared before any byte was read: the type, then the name, then the service. */
export function declaredKind(facts: Omit<FileFacts, 'head'>): FileKind | null {
  return (
    kindFromMime(facts.mimeType) ??
    kindFromExtension(facts.filename) ??
    kindFromService(facts.service)
  );
}

/**
 * The kind to show a file as. Bytes that match a format's signature win;
 * text stays text whatever was declared (an SVG is an image, JSON is JSON
 * when it was declared or starts like it, a page starting <!doctype html
 * is HTML); unknown binary bytes keep a declared picture, video or sound
 * (formats with no signature here), anything else is binary.
 */
export function resolveFileKind(facts: FileFacts): FileKindFound {
  const declared = declaredKind(facts);
  const declaredMime = bareMime(facts.mimeType);
  const extMime = mimeForExtension(facts.filename);
  const usable = (mime: string | null) =>
    mime && mime !== 'application/octet-stream' ? mime : null;
  const fallbackMime = usable(declaredMime) ?? extMime ?? 'application/octet-stream';
  const head = facts.head;
  if (!head) return { kind: declared ?? 'binary', mime: fallbackMime };

  const sniffed = sniffBytes(head);
  // A DOCX, an XLSX or an EPUB is a ZIP inside: named for what it is, not listed.
  const named =
    declaredMime in MIME_WORDS ? declaredMime : extMime && extMime in MIME_WORDS ? extMime : null;
  if (sniffed?.kind === 'zip' && named) return { kind: 'binary', mime: named };
  if (sniffed) {
    // A declared type of the same kind is more exact (image/svg+xml, audio/x-m4a).
    const mime = declared === sniffed.kind ? (usable(declaredMime) ?? sniffed.mime) : sniffed.mime;
    return { kind: sniffed.kind, mime };
  }
  const text = textOf(head);
  if (text !== null) {
    if (looksLikeSvg(text)) return { kind: 'image', mime: 'image/svg+xml' };
    if (declared === 'csv') return { kind: 'csv', mime: fallbackMime };
    if (declared === 'json' || (declared !== 'html' && looksLikeJson(text)))
      return { kind: 'json', mime: declared === 'json' ? fallbackMime : 'application/json' };
    if (declared === 'html' || looksLikeHtml(text))
      return { kind: 'html', mime: declared === 'html' ? fallbackMime : 'text/html' };
    return {
      kind: 'text',
      mime: kindFromMime(fallbackMime) === 'text' ? fallbackMime : 'text/plain',
    };
  }
  if (declared === 'image' || declared === 'video' || declared === 'audio')
    return { kind: declared, mime: fallbackMime };
  return { kind: 'binary', mime: fallbackMime };
}

/** What a file is, in words: "A PDF document", "A Word document (DOCX)", "Binary data". */
export function fileTypeWords(kind: FileKind, mime: string): string {
  return MIME_WORDS[bareMime(mime)] ?? KIND_WORDS[kind];
}

/**
 * The name to save a file as: its own name, else the identifier (or the
 * name, for a resource without one) with the type's extension. Characters
 * a file system refuses become "_"; never empty (Hub refuses a save
 * without a name).
 */
export function saveFilename(options: {
  filename?: string | null;
  identifier?: string | null;
  name: string;
  mime?: string | null;
}): string {
  const clean = (value: string) =>
    value
      .replace(/[\\/:*?"<>|]/g, '_')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim();
  const own = options.filename ? clean(options.filename.split(/[\\/]/).pop() ?? '') : '';
  if (own && own !== '.' && own !== '..') return own.slice(0, 120);
  const base =
    clean(options.identifier && options.identifier !== 'default' ? options.identifier : '') ||
    clean(options.name) ||
    'file';
  const ext = EXTENSION_BY_MIME[bareMime(options.mime)] ?? (bareMime(options.mime) ? 'bin' : '');
  const stem = base.slice(0, 100);
  return ext && extensionOf(stem) !== ext ? `${stem}.${ext}` : stem;
}

/** A public QDN publish that names its resource: what Open File and Save File need. */
export interface QdnResourceRef {
  service: string;
  name: string;
  /** Null for the resource's default identifier. */
  identifier: string | null;
}

/**
 * The resource a transaction published, when the Explorer may open it: a
 * QDN publish with a name and a service that isn't encrypted (encrypted
 * resources are counted only, never opened, not even their identifier).
 */
export function openableResource(tx: {
  type?: unknown;
  service?: unknown;
  name?: unknown;
  identifier?: unknown;
}): QdnResourceRef | null {
  if (tx.type !== 'ARBITRARY') return null;
  const service = serviceName(tx.service);
  if (!service || isPrivateService(service)) return null;
  const name = typeof tx.name === 'string' ? tx.name : '';
  if (!name.trim()) return null;
  const identifier =
    typeof tx.identifier === 'string' && tx.identifier && tx.identifier !== 'default'
      ? tx.identifier
      : null;
  return { service, name, identifier };
}

/** Services whose resources run as a site or an app in Qortal: Open in Qortal, for their default identifier. */
const RUNNABLE = new Set(['APP', 'WEBSITE']);

/**
 * `qortal://APP/<name>` for an app or website published under its default
 * identifier, else null. The name goes in as written: Hub never decodes an
 * app's name in a link (docs/QORTAL.md → Deep links), so `Q-Mintership+`
 * stays `+` and a space stays a space; a name holding `/`, `?` or `#` would
 * be read as more than a name, so it gets no link.
 */
export function qortalLinkFor(ref: QdnResourceRef): string | null {
  if (!RUNNABLE.has(ref.service) || ref.identifier !== null) return null;
  if (/[/?#]/.test(ref.name)) return null;
  return `qortal://${ref.service}/${ref.name}`;
}
