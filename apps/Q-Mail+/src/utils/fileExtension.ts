/**
 * File extension for an attachment without one in its name (replaces the
 * 38 kB `mime` database, Bundle §5.5). The publish path always prefers the
 * filename's own extension; this table only covers the types browsers hand
 * out for files that have none (camera captures, pasted blobs, GO shares).
 */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/tiff': 'tiff',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/3gpp': '3gp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/webm': 'weba',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/gzip': 'gz',
  'application/x-7z-compressed': '7z',
  'application/x-rar-compressed': 'rar',
  'application/json': 'json',
  'application/xml': 'xml',
  'application/javascript': 'js',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'application/epub+zip': 'epub',
  'application/rtf': 'rtf',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/css': 'css',
  'text/csv': 'csv',
  'text/markdown': 'md',
  'text/calendar': 'ics',
  'text/xml': 'xml',
  'text/javascript': 'js',
};

/** The extension for a MIME type (no leading dot), or null when unknown. */
export function extensionFromMimeType(type: string | null | undefined): string | null {
  if (!type) return null;
  const base = type.split(';')[0].trim().toLowerCase();
  if (EXTENSION_BY_TYPE[base]) return EXTENSION_BY_TYPE[base];
  // text/x-foo, application/x-foo → foo for simple one-word subtypes.
  const match = /^(?:text|application|image|audio|video)\/(?:x-)?([a-z0-9]{1,8})$/.exec(base);
  return match ? match[1] : null;
}

/** The extension in a filename (no leading dot), or '' when it has none. */
export function extensionFromFilename(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot === trimmed.length - 1) return '';
  return trimmed.slice(dot + 1);
}
