/**
 * QDN services for the Explorer. An ARBITRARY transaction's JSON carries its
 * service as Core's number (`"service": 800`); searchsimple answers it as a
 * name (`"service": "DOCUMENT"`). The list is Core's own enum
 * (org.qortal.arbitrary.misc.Service, Core 6.1.4–6.1.9).
 *
 * Encrypted services are shown as counts only: never an identifier, a
 * title or a link to what is inside.
 */

/** Core's service numbers and names. */
export const QDN_SERVICES: Readonly<Record<number, string>> = {
  1: 'AUTO_UPDATE',
  100: 'ARBITRARY_DATA',
  120: 'QCHAT_ATTACHMENT',
  121: 'QCHAT_ATTACHMENT_PRIVATE',
  130: 'ATTACHMENT',
  131: 'ATTACHMENT_PRIVATE',
  140: 'FILE',
  141: 'FILE_PRIVATE',
  150: 'FILES',
  160: 'CHAIN_DATA',
  200: 'WEBSITE',
  300: 'GIT_REPOSITORY',
  400: 'IMAGE',
  401: 'IMAGE_PRIVATE',
  410: 'THUMBNAIL',
  420: 'QCHAT_IMAGE',
  500: 'VIDEO',
  501: 'VIDEO_PRIVATE',
  600: 'AUDIO',
  601: 'AUDIO_PRIVATE',
  610: 'QCHAT_AUDIO',
  620: 'QCHAT_VOICE',
  630: 'VOICE',
  631: 'VOICE_PRIVATE',
  640: 'PODCAST',
  700: 'BLOG',
  777: 'BLOG_POST',
  778: 'BLOG_COMMENT',
  800: 'DOCUMENT',
  801: 'DOCUMENT_PRIVATE',
  900: 'LIST',
  910: 'PLAYLIST',
  1000: 'APP',
  1100: 'METADATA',
  1110: 'JSON',
  1200: 'GIF_REPOSITORY',
  1300: 'STORE',
  1310: 'PRODUCT',
  1330: 'OFFER',
  1340: 'COUPON',
  1400: 'CODE',
  1410: 'PLUGIN',
  1420: 'EXTENSION',
  1500: 'GAME',
  1510: 'ITEM',
  1600: 'NFT',
  1700: 'DATABASE',
  1710: 'SNAPSHOT',
  1800: 'COMMENT',
  1810: 'CHAIN_COMMENT',
  1900: 'MAIL',
  1901: 'MAIL_PRIVATE',
  1910: 'MESSAGE',
  1911: 'MESSAGE_PRIVATE',
};

const KNOWN_NAMES: ReadonlySet<string> = new Set(Object.values(QDN_SERVICES));

/**
 * A service's name from a transaction's number (or a numeric string), or a
 * name that is already one. Null when it isn't a service Core knows; an
 * unknown number reads "SERVICE_<n>" so a new service still shows something.
 */
export function serviceName(value: unknown): string | null {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return null;
    return QDN_SERVICES[n] ?? `SERVICE_${n}`;
  }
  if (typeof value === 'string' && /^[A-Z][A-Z0-9_]*$/.test(value)) return value;
  return null;
}

/** Is this a service Core lists (by name)? */
export function isKnownService(name: string): boolean {
  return KNOWN_NAMES.has(name);
}

/**
 * Services whose data is encrypted: Core marks every `*_PRIVATE` one as
 * private, and Q-Mail's older MAIL resources are encrypted too.
 */
export function isPrivateService(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.endsWith('_PRIVATE') || name === 'MAIL';
}

const WORDS: Readonly<Record<string, string>> = {
  AUTO_UPDATE: 'a Core update',
  ARBITRARY_DATA: 'data',
  QCHAT_ATTACHMENT: 'a Q-Chat attachment',
  ATTACHMENT: 'an attachment',
  FILE: 'a file',
  FILES: 'files',
  CHAIN_DATA: 'chain data',
  WEBSITE: 'a website',
  GIT_REPOSITORY: 'a Git repository',
  IMAGE: 'an image',
  THUMBNAIL: 'a thumbnail',
  QCHAT_IMAGE: 'a Q-Chat image',
  VIDEO: 'a video',
  AUDIO: 'audio',
  QCHAT_AUDIO: 'Q-Chat audio',
  QCHAT_VOICE: 'a Q-Chat voice message',
  VOICE: 'a voice recording',
  PODCAST: 'a podcast',
  BLOG: 'a blog',
  BLOG_POST: 'a blog post',
  BLOG_COMMENT: 'a blog comment',
  DOCUMENT: 'a document',
  LIST: 'a list',
  PLAYLIST: 'a playlist',
  APP: 'an app',
  METADATA: 'metadata',
  JSON: 'JSON data',
  GIF_REPOSITORY: 'a GIF collection',
  STORE: 'a store',
  PRODUCT: 'a product',
  OFFER: 'an offer',
  COUPON: 'a coupon',
  CODE: 'code',
  PLUGIN: 'a plugin',
  EXTENSION: 'an extension',
  GAME: 'a game',
  ITEM: 'an item',
  NFT: 'an NFT',
  DATABASE: 'a database',
  SNAPSHOT: 'a snapshot',
  COMMENT: 'a comment',
  CHAIN_COMMENT: 'a chain comment',
  MESSAGE: 'a message',
};

/**
 * What was published, in words, to follow "Published": "an app",
 * "a video", "an encrypted resource" (every encrypted service alike).
 */
export function serviceWords(name: string | null | undefined): string {
  if (isPrivateService(name)) return 'an encrypted resource';
  return (name && WORDS[name]) || 'a QDN resource';
}
