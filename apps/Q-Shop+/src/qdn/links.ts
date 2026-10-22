/**
 * In-app routes and `qortal://` deep links for shops and products, after
 * Q-Share+'s `utils/qortalLinks.ts` (docs/QORTAL.md → Deep links):
 * - the app name is written with a literal `+` (Hub never decodes it);
 * - every path segment after it is encoded, so names with spaces, `+` or `/`
 *   survive; React Router decodes them once, and `decodeParam` never throws.
 *
 * Copied links point at this build's published name (constants/plus.ts):
 * Simon's decision for night 1 is that Q-Shop+ links open Q-Shop+.
 * The route shapes are the original's: `/<owner>/<storeId>` and
 * `/<owner>/<storeId>/<productId>/<catalogueId>`, so links copied from the
 * original Q-Shop also open here.
 */
import { LINK_APP_NAME, MAIL_APP_NAME } from "../constants/plus";

const seg = encodeURIComponent;

function appSegment(): string {
  return LINK_APP_NAME.replace(/ /g, "%20");
}

export function storePath(owner: string, storeId: string): string {
  return `/${seg(owner)}/${seg(storeId)}`;
}

export function productPath(owner: string, storeId: string, productId: string, catalogueId: string): string {
  return `/${seg(owner)}/${seg(storeId)}/${seg(productId)}/${seg(catalogueId)}`;
}

export function storeLink(owner: string, storeId: string): string {
  return `qortal://APP/${appSegment()}${storePath(owner, storeId)}`;
}

/** The shop opened on one of its collections (qdn/collections.ts): a query, so the shop route is unchanged. */
export function collectionPath(owner: string, storeId: string, collectionId: string): string {
  return `${storePath(owner, storeId)}?collection=${seg(collectionId)}`;
}

export function collectionLink(owner: string, storeId: string, collectionId: string): string {
  return `qortal://APP/${appSegment()}${collectionPath(owner, storeId, collectionId)}`;
}

export function productLink(owner: string, storeId: string, productId: string, catalogueId: string): string {
  return `qortal://APP/${appSegment()}${productPath(owner, storeId, productId, catalogueId)}`;
}

/** Opens the mail app (Q-Mail+) at a new message to `name`. */
export function mailToLink(name: string): string {
  return `qortal://APP/${MAIL_APP_NAME.replace(/ /g, "%20")}/to/${seg(name)}`;
}

export function avatarUrl(name: string): string {
  return `/arbitrary/THUMBNAIL/${seg(name)}/qortal_avatar`;
}

/** A route param as typed: React Router decodes once, and a stray `%` must not throw. */
export function decodeParam(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
