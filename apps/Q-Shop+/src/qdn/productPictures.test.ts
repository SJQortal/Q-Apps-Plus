import { afterEach, describe, expect, it, vi } from "vitest";
import { base64ToJson, type ProductDraft } from "./payloads";
import { isPicturesOfShop, picturesIdentifier } from "./identifiers";
import {
  CATALOGUE_PICTURES,
  StalePicturesError,
  emptiedPicturesOf,
  fetchMorePictures,
  morePicturesOf,
  needsMorePictures,
  picturesFromDoc,
  picturesSig,
  splitProductPictures,
  withPicturesLanded,
  withPicturesRef,
} from "./productPictures";
import { resetQdnCaches } from "./search";

afterEach(() => {
  vi.unstubAllGlobals();
  resetQdnCaches();
});

const PRODUCT_ID = "q-store-product-my-shop-AbCdEf1234";
const PICTURES_ID = "q-store-pictures-my-shop-AbCdEf1234";
const pics = (n: number, tag = "p") => Array.from({ length: n }, (_, i) => `data:image/webp;base64,${btoa(`${tag}${i}`)}`);
const draft = (images: string[], extra: Record<string, unknown> = {}): ProductDraft => ({
  title: "Ghee",
  created: 1,
  images,
  mainImageIndex: 0,
  id: PRODUCT_ID,
  ...extra,
});

describe("a product's pictures past the third", () => {
  it("live in a document named after the product, one per product of the shop", () => {
    expect(picturesIdentifier(PRODUCT_ID)).toBe(PICTURES_ID);
    expect(PICTURES_ID.length).toBeLessThanOrEqual(64);
    // The longest shop id the original allows (25) still fits Core's 64 characters.
    expect(picturesIdentifier(`q-store-product-${"s".repeat(25)}-AbCdEf1234`).length).toBeLessThanOrEqual(64);
    expect(isPicturesOfShop(PICTURES_ID, "my-shop")).toBe(true);
    expect(isPicturesOfShop("q-store-pictures-my-shop-2-AbCdEf1234", "my-shop")).toBe(false);
  });

  it("leave a product with 3 pictures or fewer exactly as it is", () => {
    const one = draft(pics(3));
    const split = splitProductPictures("Seller", { [PRODUCT_ID]: one });
    expect(split.drafts[PRODUCT_ID]).toBe(one);
    expect(split.resources).toEqual([]);
    expect(withPicturesRef(one)).toBe(one);
  });

  it("go into their own document, the first 3 staying in the catalogue with a pointer", () => {
    const images = pics(7);
    const split = splitProductPictures("Seller", { [PRODUCT_ID]: withPicturesRef(draft(images)) });
    const product = split.drafts[PRODUCT_ID];
    expect(product.images).toEqual(images.slice(0, CATALOGUE_PICTURES));
    expect(product.morePictures).toEqual({ id: PICTURES_ID, count: 4, sig: picturesSig(images.slice(3)) });
    expect(split.resources).toHaveLength(1);
    const [resource] = split.resources;
    expect({ ...resource, data64: undefined }).toEqual({ name: "Seller", service: "DOCUMENT", identifier: PICTURES_ID, filename: "pictures.json", data64: undefined });
    expect(base64ToJson(resource.data64!)).toEqual({ productId: PRODUCT_ID, images: images.slice(3) });
    expect(split.labels[PICTURES_ID]).toBe("More pictures · Ghee");
  });

  it("aren't published again by an edit that leaves them as they were", () => {
    const images = pics(5);
    const published = { id: PICTURES_ID, count: 2, sig: picturesSig(images.slice(3)) };
    const edited = withPicturesRef(draft(images, { morePictures: published, title: "Ghee, new title" }));
    const split = splitProductPictures("Seller", { [PRODUCT_ID]: edited });
    expect(split.resources).toEqual([]);
    expect(split.drafts[PRODUCT_ID].morePictures).toEqual(published);
    // One changed: the document goes again with its new fingerprint.
    const changed = splitProductPictures("Seller", { [PRODUCT_ID]: withPicturesRef(draft([...images.slice(0, 4), "data:image/webp;base64,TkVX"], { morePictures: published })) });
    expect(changed.resources).toHaveLength(1);
    expect(changed.drafts[PRODUCT_ID].morePictures).not.toEqual(published);
  });

  it("are emptied when an edit goes back to 3, and the pointer leaves the product", () => {
    const published = { id: PICTURES_ID, count: 2, sig: "2-x-y" };
    const edited = withPicturesRef(draft(pics(3), { morePictures: published }));
    // The form's draft says there are none left, so it won't read them again.
    expect(edited.morePictures).toEqual({ ...published, count: 0 });
    expect(needsMorePictures(edited)).toBe(false);
    const split = splitProductPictures("Seller", { [PRODUCT_ID]: edited });
    expect("morePictures" in split.drafts[PRODUCT_ID]).toBe(false);
    expect(split.resources.map((r) => [r.identifier, base64ToJson(r.data64!)])).toEqual([[PICTURES_ID, { productId: PRODUCT_ID, images: [] }]]);
    // Never published (a new product trimmed before publishing): nothing to empty.
    const fresh = splitProductPictures("Seller", { [PRODUCT_ID]: withPicturesRef(draft(pics(2), { morePictures: { id: PICTURES_ID, count: 2 } })) });
    expect(fresh.resources).toEqual([]);
  });

  it("are read for a published product (3 in the catalogue and a pointer), not for a draft that holds them", () => {
    expect(needsMorePictures(draft(pics(3), { morePictures: { id: PICTURES_ID, count: 4, sig: "s" } }))).toBe(true);
    expect(needsMorePictures(draft(pics(7), { morePictures: { id: PICTURES_ID, count: 4, sig: "s" } }))).toBe(false);
    expect(needsMorePictures(draft(pics(3)))).toBe(false);
    expect(morePicturesOf({ morePictures: { id: "", count: 3 } })).toBeNull();
    expect(morePicturesOf({ morePictures: { id: PICTURES_ID, count: 99 } })).toEqual({ id: PICTURES_ID, count: 7 });
  });

  it("are taken only from a document naming the product, and only as pictures", () => {
    const doc = { productId: PRODUCT_ID, images: [...pics(2), "https://tracker.example/pixel.png", 5, ...pics(8, "q")] };
    const read = picturesFromDoc(doc, PRODUCT_ID);
    expect(read).toHaveLength(7);
    expect(read.every((i) => i.startsWith("data:image/"))).toBe(true);
    expect(picturesFromDoc(doc, "q-store-product-my-shop-Other00000")).toEqual([]);
    expect(picturesFromDoc("D", PRODUCT_ID)).toEqual([]);
  });

  it("are emptied with the products deleted, for those that published some", () => {
    const resources = emptiedPicturesOf("Seller", [
      { id: PRODUCT_ID, morePictures: { id: PICTURES_ID, count: 2, sig: "s" } },
      { id: "q-store-product-my-shop-Plain00000" },
    ]);
    expect(resources.map((r) => [r.identifier, base64ToJson(r.data64!)])).toEqual([[PICTURES_ID, { productId: PRODUCT_ID, images: [] }]]);
  });

  it("stay as they are when the edit form couldn't read them (3 pictures and a pointer counting more)", () => {
    const kept = draft(pics(3), { morePictures: { id: PICTURES_ID, count: 4, sig: "4-a-b" } });
    const split = splitProductPictures("Seller", { [PRODUCT_ID]: kept });
    expect(split.drafts[PRODUCT_ID]).toBe(kept);
    expect(split.resources).toEqual([]);
  });

  it("note what landed on the draft, so publishing again doesn't send them twice", () => {
    const images = pics(5);
    const split = splitProductPictures("Seller", { [PRODUCT_ID]: withPicturesRef(draft(images)) });
    expect(split.sent[PICTURES_ID]).toEqual({ draftKey: PRODUCT_ID, sig: picturesSig(images.slice(3)) });
    const landed = withPicturesLanded(withPicturesRef(draft(images)), split.sent[PICTURES_ID].sig);
    expect(splitProductPictures("Seller", { [PRODUCT_ID]: landed }).resources).toEqual([]);
    // An emptied one that landed: the pointer forgets its fingerprint, and the next publish just drops it.
    const emptied = withPicturesLanded(draft(pics(3), { morePictures: { id: PICTURES_ID, count: 0, sig: "s" } }), null);
    const again = splitProductPictures("Seller", { [PRODUCT_ID]: emptied });
    expect(again.resources).toEqual([]);
    expect("morePictures" in again.drafts[PRODUCT_ID]).toBe(false);
  });

  it("are taken by the edit form only as published (their fingerprint)", async () => {
    const images = pics(2);
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ productId: PRODUCT_ID, images }) }));
    expect(await fetchMorePictures("Seller", PRODUCT_ID, PICTURES_ID, { sig: picturesSig(images) })).toEqual(images);
    await expect(fetchMorePictures("Seller", PRODUCT_ID, PICTURES_ID, { sig: "2-other-x", fresh: true })).rejects.toBeInstanceOf(StalePicturesError);
    // The product page takes them as they are.
    expect(await fetchMorePictures("Seller", PRODUCT_ID, PICTURES_ID)).toEqual(images);
  });
});
