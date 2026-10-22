import { describe, expect, it } from "vitest";
import { objectToBase64 } from "../utils/toBase64";
import {
  base64ToJson,
  buildCreateStorePublish,
  buildEditStorePublish,
  buildDeleteProductsPublish,
  buildDeleteShopPublish,
  buildRecreateDataContainerPublish,
  buildReviewPublish,
  buildStatusPublish,
  cataloguesHolding,
  jsonToBase64,
  MissingCatalogueError,
  type CatalogueDoc,
  type DataContainerDoc,
} from "./payloads";
import { ARRR_ADDRESS, SELLER, SHORT_STORE_ID, STORE_ID, viewedStore } from "../test/fixtures/shop";
import { checkStructureStore } from "../utils/checkStructure";

describe("payload encoding", () => {
  it("encodes JSON exactly like the original objectToBase64, unicode included", async () => {
    const obj = { title: "Café ☕ ΑΩ 🛒", n: 1.5, nested: { a: [1, "ü"] } };
    expect(jsonToBase64(obj)).toBe(await objectToBase64(obj));
    expect(base64ToJson(jsonToBase64(obj))).toEqual(obj);
  });
});

describe("shop publishes (the original's shapes)", () => {
  const fields = {
    title: "Seller's Shop",
    description: "D".repeat(200),
    location: "Lisbon",
    shipsTo: "Europe",
    logo: "data:image/webp;base64,TE9HTw==",
    foreignCoins: { ARRR: ARRR_ADDRESS },
    supportedCoins: ["QORT", "ARRR"],
  };

  it("creates the STORE and its empty data container in one multiple publish", () => {
    const { request, storeObj, dataContainer } = buildCreateStorePublish({
      name: SELLER,
      shortStoreId: SHORT_STORE_ID,
      fields,
      created: 1700000000000,
    });
    expect(Object.keys(storeObj)).toEqual([
      "title",
      "description",
      "location",
      "shipsTo",
      "created",
      "shortStoreId",
      "logo",
      "foreignCoins",
      "supportedCoins",
    ]);
    expect(request.action).toBe("PUBLISH_MULTIPLE_QDN_RESOURCES");
    const [store, container] = request.resources;
    expect({ ...store, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: SELLER,
      service: "STORE",
      data64: undefined,
      filename: "store.json",
      title: fields.title,
      description: "**coins:QORTtrue,ARRRtrue**" + fields.description.slice(0, 180),
      identifier: STORE_ID,
    });
    expect(base64ToJson(store.data64)).toEqual(storeObj);
    expect({ ...container, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: SELLER,
      service: "DOCUMENT",
      data64: undefined,
      identifier: `${STORE_ID}-datacontainer`,
      filename: "datacontainer.json",
    });
    expect(base64ToJson(container.data64)).toEqual({
      storeId: STORE_ID,
      shortStoreId: SHORT_STORE_ID,
      owner: SELLER,
      products: {},
    });
    expect(dataContainer.products).toEqual({});
  });

  it("adds accepted assets only when there are some (additive data)", () => {
    const withAssets = buildCreateStorePublish({
      name: SELLER,
      shortStoreId: SHORT_STORE_ID,
      fields: { ...fields, acceptedAssets: [{ id: 81, name: "Gold" }] },
      created: 1,
    });
    expect(withAssets.storeObj).toMatchObject({ acceptedAssets: [{ id: 81, name: "Gold" }] });
    const without = buildCreateStorePublish({
      name: SELLER,
      shortStoreId: SHORT_STORE_ID,
      fields: { ...fields, acceptedAssets: [] },
      created: 1,
    });
    expect("acceptedAssets" in without.storeObj).toBe(false);
  });

  it("edits by republishing the in-memory store with the new fields", () => {
    const current = { ...viewedStore, shortStoreId: undefined as unknown as string, category: "x", tags: [] };
    const { request, storeObj } = buildEditStorePublish({
      name: SELLER,
      currentStore: current,
      fields: { ...fields, supportedCoins: ["QORT"], foreignCoins: { ARRR: "" } },
    });
    expect(storeObj).toMatchObject({ id: STORE_ID, category: "x", shortStoreId: SHORT_STORE_ID, supportedCoins: ["QORT"] });
    expect({ ...request, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: SELLER,
      service: "STORE",
      data64: undefined,
      filename: "store.json",
      title: fields.title,
      description: "**coins:QORTtrue,ARRRfalse**" + fields.description.slice(0, 180),
      identifier: STORE_ID,
    });
  });

  it("recreates an empty data container without a filename, as the original's advanced setting", () => {
    const { request } = buildRecreateDataContainerPublish({ name: SELLER, storeId: STORE_ID, shortStoreId: SHORT_STORE_ID });
    expect({ ...request, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: SELLER,
      service: "DOCUMENT",
      data64: undefined,
      identifier: `${STORE_ID}-datacontainer`,
    });
  });
});

describe("review and status publishes", () => {
  it("builds the review with the rating in the identifier", () => {
    const built = buildReviewPublish({
      name: "Buyer",
      shortStoreId: SHORT_STORE_ID,
      uid: "uid0000001",
      rating: 3,
      title: "T".repeat(70),
      description: "D".repeat(200),
      created: 5,
    });
    expect(built.identifier).toBe(`q-store-review-${SHORT_STORE_ID}-uid0000001-30`);
    expect(built.request.title).toHaveLength(60);
    expect(built.request.description).toHaveLength(150);
    expect(base64ToJson(built.request.data64)).toEqual({
      title: "T".repeat(70),
      description: "D".repeat(200),
      rating: 3,
      created: 5,
    });
  });

  it("encrypts the status to the buyer then the seller", () => {
    const req = buildStatusPublish({
      orderId: "q-store-order-my-shop-abc",
      seller: SELLER,
      status: "Refunded",
      note: "",
      buyerPublicKey: "B",
      sellerPublicKey: "S",
    });
    expect(req.identifier).toBe("q-store-status-order-my-shop-abc");
    expect(req.filename).toBe("q-store-order-my-shop-abc_status.json");
    expect(req.publicKeys).toEqual(["B", "S"]);
    expect(base64ToJson(req.data64)).toEqual({ status: "Refunded", note: "" });
  });
});

describe("deletes", () => {
  const P = (n: number) => `q-store-product-${SHORT_STORE_ID}-P${String(n).padStart(9, "0")}`;
  const C1 = `q-store-catalogue-${SHORT_STORE_ID}-CAT0000001`;
  const C2 = `q-store-catalogue-${SHORT_STORE_ID}-CAT0000002`;
  const entry = (n: number, catalogueId: string) => ({ created: 1700000000000 + n, priceQort: n, category: "Art", catalogueId, status: "AVAILABLE" });
  const product = (n: number, catalogueId: string) => ({ id: P(n), title: `Product ${n}`, catalogueId, price: [{ currency: "qort", value: n }] });
  const index = (): DataContainerDoc => ({
    storeId: STORE_ID,
    shortStoreId: SHORT_STORE_ID,
    owner: SELLER,
    products: { [P(1)]: entry(1, C1), [P(2)]: entry(2, C1), [P(3)]: entry(3, C2) },
    catalogues: [
      { id: C1, products: { [P(1)]: true, [P(2)]: true } },
      { id: C2, products: { [P(3)]: true } },
    ],
    id: `${STORE_ID}-datacontainer`,
  });
  const catalogues = (): Record<string, CatalogueDoc> => ({
    [C1]: { id: C1, products: { [P(1)]: product(1, C1), [P(2)]: product(2, C1) } },
    [C2]: { id: C2, products: { [P(3)]: product(3, C2) } },
  });

  it("deletes a shop with tombstones the original can parse: the shop first, then its product list, then each catalogue once", () => {
    const { resources } = buildDeleteShopPublish({ name: SELLER, storeId: STORE_ID, catalogueIds: [C1, C2, C1] });
    const marked = { title: "deleted", description: "deleted", tags: ["deleted"] };
    expect(resources.map(({ data64: _data, ...rest }) => rest)).toEqual([
      { name: SELLER, service: "STORE", identifier: STORE_ID, filename: "store.json", ...marked },
      { name: SELLER, service: "DOCUMENT", identifier: `${STORE_ID}-datacontainer`, filename: "datacontainer.json", ...marked },
      { name: SELLER, service: "DOCUMENT", identifier: C1, filename: "catalogue.json", ...marked },
      { name: SELLER, service: "DOCUMENT", identifier: C2, filename: "catalogue.json", ...marked },
    ]);
    expect(resources.map((r) => base64ToJson(r.data64))).toEqual([
      // Fails the original's checkStructureStore (no description, ships-to…): its home leaves it out.
      { deleted: true, title: "Deleted shop" },
      // The original's own boot reads this as an empty product list.
      { storeId: STORE_ID, shortStoreId: SHORT_STORE_ID, owner: SELLER, products: {}, deleted: true },
      { id: C1, products: {}, deleted: true },
      { id: C2, products: {}, deleted: true },
    ]);
    // The original's own check (utils/checkStructure is its copy) rejects the shop's tombstone.
    expect(checkStructureStore(base64ToJson(resources[0].data64))).toBe(false);
  });

  it("deletes a shop's collections after its product list, when it has them", () => {
    const { resources } = buildDeleteShopPublish({
      name: SELLER,
      storeId: STORE_ID,
      catalogueIds: [C1],
      collectionsId: `q-store-collections-${SHORT_STORE_ID}`,
    });
    expect(resources.map((r) => r.identifier)).toEqual([STORE_ID, `${STORE_ID}-datacontainer`, `q-store-collections-${SHORT_STORE_ID}`, C1]);
    expect(base64ToJson(resources[2].data64)).toEqual({ storeId: STORE_ID, collections: [], deleted: true });
    expect(resources.every((r) => base64ToJson(r.data64).deleted === true)).toBe(true);
  });

  it("finds the catalogues holding products: their own, and any the index lists them under", () => {
    const dc = index();
    dc.catalogues![1].products[P(1)] = true;
    expect(cataloguesHolding(dc, [P(1)])).toEqual([C1, C2]);
    expect(cataloguesHolding(dc, [P(3)])).toEqual([C2]);
    expect(cataloguesHolding(dc, ["q-store-product-unknown"])).toEqual([]);
  });

  it("deletes products: the index first without them, then only the catalogues that held them", () => {
    const built = buildDeleteProductsPublish({ name: SELLER, dataContainer: index(), productIds: [P(2)], catalogues: catalogues(), deletedAt: 99 });
    expect(built.removed).toEqual([P(2)]);
    expect(built.resources.map((r) => [r.service, r.identifier, r.filename])).toEqual([
      ["DOCUMENT", `${STORE_ID}-datacontainer`, "datacontainer.json"],
      ["DOCUMENT", C1, "catalogue.json"],
    ]);
    // The index keeps the original's shape and key order, minus the product, and records the delete (additive).
    const dc = base64ToJson(built.resources[0].data64);
    expect(Object.keys(dc)).toEqual(["storeId", "shortStoreId", "owner", "products", "catalogues", "id", "deletedProducts"]);
    expect(dc.deletedProducts).toEqual({ [P(2)]: 99 });
    expect(Object.keys(dc.products)).toEqual([P(1), P(3)]);
    expect(dc.products[P(1)]).toEqual(entry(1, C1));
    expect(dc.catalogues).toEqual([
      { id: C1, products: { [P(1)]: true } },
      { id: C2, products: { [P(3)]: true } },
    ]);
    // The catalogue keeps everything else as read.
    expect(base64ToJson(built.resources[1].data64)).toEqual({ id: C1, products: { [P(1)]: product(1, C1) } });
  });

  it("adds to the deletions the index already records, keeping the newest 1000", async () => {
    const { MAX_DELETED_PRODUCTS } = await import("./payloads");
    const older = Object.fromEntries(Array.from({ length: MAX_DELETED_PRODUCTS }, (_, i) => [`old-${i}`, i + 1]));
    const built = buildDeleteProductsPublish({
      name: SELLER,
      dataContainer: { ...index(), deletedProducts: { ...older, junk: "x" } },
      productIds: [P(2)],
      catalogues: catalogues(),
      deletedAt: 5000,
    });
    const recorded = built.dataContainer.deletedProducts as Record<string, number>;
    expect(Object.keys(recorded)).toHaveLength(MAX_DELETED_PRODUCTS);
    expect(recorded[P(2)]).toBe(5000);
    expect(recorded).not.toHaveProperty("old-0");
    expect(recorded).not.toHaveProperty("junk");
  });

  it("keeps an emptied catalogue as a valid, empty one the next products can fill", () => {
    const built = buildDeleteProductsPublish({ name: SELLER, dataContainer: index(), productIds: [P(3)], catalogues: catalogues(), deletedAt: 99 });
    expect(base64ToJson(built.resources[1].data64)).toEqual({ id: C2, products: {} });
    expect(built.dataContainer.catalogues).toEqual([
      { id: C1, products: { [P(1)]: true, [P(2)]: true } },
      { id: C2, products: {} },
    ]);
  });

  it("deletes several across catalogues in one publish, and skips ids the index doesn't list", () => {
    const built = buildDeleteProductsPublish({
      name: SELLER,
      dataContainer: index(),
      productIds: [P(1), P(3), P(1), "q-store-product-elsewhere"],
      catalogues: catalogues(),
      deletedAt: 99,
    });
    expect(built.removed).toEqual([P(1), P(3)]);
    expect(built.resources.map((r) => r.identifier)).toEqual([`${STORE_ID}-datacontainer`, C1, C2]);
    expect(Object.keys(built.dataContainer.products)).toEqual([P(2)]);
  });

  it("doesn't touch the inputs, and needs every catalogue holding one", () => {
    const dc = index();
    const cats = catalogues();
    buildDeleteProductsPublish({ name: SELLER, dataContainer: dc, productIds: [P(1)], catalogues: cats, deletedAt: 99 });
    expect(dc).toEqual(index());
    expect(cats).toEqual(catalogues());
    expect(() => buildDeleteProductsPublish({ name: SELLER, dataContainer: index(), productIds: [P(3)], catalogues: { [C1]: catalogues()[C1] }, deletedAt: 99 })).toThrow(
      MissingCatalogueError
    );
  });

  it("doesn't republish a catalogue that turned out not to hold the product", () => {
    const cats = catalogues();
    delete cats[C2].products[P(3)];
    const built = buildDeleteProductsPublish({ name: SELLER, dataContainer: index(), productIds: [P(3)], catalogues: cats, deletedAt: 99 });
    expect(built.resources.map((r) => r.identifier)).toEqual([`${STORE_ID}-datacontainer`]);
  });
});
