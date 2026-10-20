import { APP_NAME } from '../constants/plus';
/**
 * Who a reply answers, in the reply's QDN description (Simon, 2026-10-19: "if
 * there is a new reply to the comment I would like to see the notification
 * that there is a reply to your comment"). Hub can only match a published
 * resource by its service, identifier and metadata, never its body, so a
 * reply says whose comment it answers where Hub and a QDN search can see it,
 * the way Quitter marks its replies (docs/apps/Q-Mintership+.md → Data
 * contract).
 *
 * Marker `~qmpre<16 hex>~`: the FNV-1a 64-bit hash of the replied-to name
 * (trimmed, lower case, as UTF-8), so the description has a fixed shape
 * whatever the name holds. It opens the description, since Core matches a
 * description from its start when a search or a Hub rule asks for a prefix;
 * words for anyone browsing QDN follow it.
 *
 * Anyone can write any description, so a marker only says where to look:
 * the reply itself is read and shown as usual.
 */

export const REPLY_MARKER_START = '~qmpre';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK = (1n << 64n) - 1n;

/** FNV-1a 64 of the text's UTF-8 bytes, as 16 hex digits. */
export function fnv1a64(text: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, '0');
}

/** The hash a name is marked by. */
export function nameMark(name: string): string {
  return fnv1a64(name.trim().toLowerCase());
}

/** `~qmpre<hash>~` for replies to `name`'s comments. */
export function replyMarker(name: string): string {
  return `${REPLY_MARKER_START}${nameMark(name)}~`;
}

/** A reply's QDN description: the marker first, then words. */
export function replyDescription(name: string): string {
  return `${replyMarker(name)} A reply in ${APP_NAME}`;
}

/**
 * The description for a reply by `author` to `repliedTo`'s comment, or
 * undefined when there is nobody else to tell (not a reply, or one's own).
 */
export function replyDescriptionFor(
  author: string,
  repliedTo: string | null | undefined
): string | undefined {
  if (!repliedTo?.trim()) return undefined;
  if (repliedTo.trim().toLowerCase() === author.trim().toLowerCase()) return undefined;
  return replyDescription(repliedTo);
}
