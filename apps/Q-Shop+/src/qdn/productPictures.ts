/**
 * Up to 10 pictures a product (Simon, 2026-10-22). The original keeps a
 * product's pictures, at most 3, as data URLs inside its catalogue, and every
 * shop page and list reads catalogues whole: ten pictures there would make
 * each catalogue (10 products) several times bigger for every buyer. So:
 *
 * - the first 3 stay where the original keeps them (`images`): lists, carts,
 *   orders and the original app show them as before;
 * - pictures 4–10 go into one DOCUMENT per product,
 *   `q-store-pictures-<shortStoreId>-<uid10>` (qdn/identifiers.ts), JSON
 *   `{productId, images: [data URL…]}`, `filename: "pictures.json"`, read
 *   only by the product page and the edit form;
 * - the product points at it with an additive
 *   `morePictures: {id, count, sig}`; `sig` fingerprints the pictures as
 *   published, so an edit that leaves them alone doesn't publish them again.
 *
 * Drafts hold all of a product's pictures in `images`; the split happens
 * when they are published (`splitProductPictures`), before the original's
 * builder, which stays as it is. A product whose extra pictures go (an edit
 * down to 3, or a delete) has its document republished empty, as nothing on
 * QDN can be erased.
 */
import { picturesIdentifier } from "./identifiers";
import { jsonToBase64, type ProductDraft, type PublishResource } from "./payloads";
import { fetchQdnJson } from "./search";

/** Pictures kept in the catalogue, as the original allows. */
export const CATALOGUE_PICTURES = 3;
export const MAX_PRODUCT_PICTURES = 10;
const MAX_MORE_PICTURES = MAX_PRODUCT_PICTURES - CATALOGUE_PICTURES;

export interface MorePictures {
  id: string;
  count: number;
  /** The published pictures' fingerprint; none while they haven't been published. */
  sig?: string;
}

export interface PicturesDoc {
  productId: string;
  images: string[];
}

/** The product's pointer to its extra pictures, when it has a usable one. */
export function morePicturesOf(product: unknown): MorePictures | null {
  const ref = (product as { morePictures?: unknown } | null)?.morePictures as Partial<MorePictures> | undefined;
  if (!ref || typeof ref !== "object" || typeof ref.id !== "string" || !ref.id) return null;
  const count = typeof ref.count === "number" && Number.isFinite(ref.count) ? Math.max(0, Math.min(MAX_MORE_PICTURES, Math.floor(ref.count))) : 0;
  return { id: ref.id, count, ...(typeof ref.sig === "string" && ref.sig && { sig: ref.sig }) };
}

/** A fingerprint of a list of pictures (FNV-1a over every character, with the count and length). */
export function picturesSig(images: string[]): string {
  let hash = 0x811c9dc5;
  let length = 0;
  for (const image of images) {
    for (let i = 0; i < image.length; i++) {
      hash ^= image.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    hash ^= 0x1f;
    hash = Math.imul(hash, 0x01000193);
    length += image.length;
  }
  return `${images.length}-${length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

function picturesOf(product: object): string[] {
  const { images } = product as { images?: unknown };
  return Array.isArray(images) ? images.filter((i): i is string => typeof i === "string" && !!i) : [];
}

/**
 * A draft's pointer brought in line with its pictures, when the form saves
 * it: how many there are past the third, the published fingerprint kept (the
 * publish compares it). A draft with no pointer and at most 3 pictures is
 * returned as it is.
 */
export function withPicturesRef<T extends { id: string; images?: unknown }>(draft: T): T {
  const count = Math.max(0, Math.min(MAX_MORE_PICTURES, picturesOf(draft).length - CATALOGUE_PICTURES));
  const old = morePicturesOf(draft);
  if (count === 0 && !old) return draft;
  const ref: MorePictures = { id: old?.id ?? picturesIdentifier(draft.id), count, ...(old?.sig && { sig: old.sig }) };
  return { ...draft, morePictures: ref };
}

/**
 * Whether the edit form still has to read a product's extra pictures: it
 * points at some, and its `images` hold only the catalogue's (a draft saved
 * from the form already holds them all).
 */
export function needsMorePictures(product: unknown): boolean {
  const ref = morePicturesOf(product);
  return !!ref && ref.count > 0 && picturesOf(product ?? {}).length <= CATALOGUE_PICTURES;
}

function picturesResource(name: string, id: string, doc: PicturesDoc): PublishResource {
  return { name, service: "DOCUMENT", identifier: id, filename: "pictures.json", data64: jsonToBase64(doc) };
}

/**
 * The drafts as they are published: at most 3 pictures in each, the rest in
 * its pictures document, which is in `resources` only when it changed (or
 * goes empty). A draft with at most 3 pictures and no pointer is unchanged.
 */
export function splitProductPictures(name: string, drafts: Record<string, ProductDraft>) {
  const out: Record<string, ProductDraft> = {};
  const resources: PublishResource[] = [];
  const labels: Record<string, string> = {};
  for (const [key, draft] of Object.entries(drafts)) {
    const images = picturesOf(draft);
    const old = morePicturesOf(draft);
    const title = typeof draft.title === "string" && draft.title.trim() ? draft.title.trim() : "Product";
    if (images.length > CATALOGUE_PICTURES) {
      const extra = images.slice(CATALOGUE_PICTURES, MAX_PRODUCT_PICTURES);
      const sig = picturesSig(extra);
      const id = old?.id ?? picturesIdentifier(draft.id);
      out[key] = { ...draft, images: images.slice(0, CATALOGUE_PICTURES), morePictures: { id, count: extra.length, sig } };
      if (old?.sig !== sig) {
        resources.push(picturesResource(name, id, { productId: draft.id, images: extra }));
        labels[id] = `More pictures · ${title}`;
      }
    } else if (old) {
      const rest = { ...draft };
      delete rest.morePictures;
      out[key] = rest;
      // Published before: emptied, so the pictures taken off the product are no longer served.
      if (old.sig) {
        resources.push(picturesResource(name, old.id, { productId: draft.id, images: [] }));
        labels[old.id] = `More pictures · ${title}`;
      }
    } else out[key] = draft;
  }
  return { drafts: out, resources, labels };
}

/** The emptied pictures documents of products being deleted (those that point at one). */
export function emptiedPicturesOf(name: string, products: { id: string; morePictures?: unknown }[]): PublishResource[] {
  const resources: PublishResource[] = [];
  for (const product of products) {
    const ref = morePicturesOf(product);
    if (ref?.sig) resources.push(picturesResource(name, ref.id, { productId: product.id, images: [] }));
  }
  return resources;
}

/**
 * A product's extra pictures from its document: only data-URL images, at
 * most 7, and only from a document that names this product (another product
 * of the same publisher can't lend its pictures).
 */
export function picturesFromDoc(doc: unknown, productId: string): string[] {
  const body = doc as Partial<PicturesDoc> | null;
  if (!body || typeof body !== "object" || body.productId !== productId || !Array.isArray(body.images)) return [];
  return body.images.filter((i): i is string => typeof i === "string" && i.startsWith("data:image/")).slice(0, MAX_MORE_PICTURES);
}

/** Read a product's extra pictures (cached for the session). */
export async function fetchMorePictures(owner: string, productId: string, picturesId: string, options: { fresh?: boolean } = {}): Promise<string[]> {
  const doc = await fetchQdnJson("DOCUMENT", owner, picturesId, options);
  return picturesFromDoc(doc, productId);
}
