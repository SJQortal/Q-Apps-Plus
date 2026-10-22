import { describe, expect, it } from "vitest";
import { objectToBase64 } from "../utils/toBase64";
import {
  base64ToJson,
  buildCreateStorePublish,
  buildEditStorePublish,
  buildRecreateDataContainerPublish,
  buildReviewPublish,
  buildStatusPublish,
  jsonToBase64,
} from "./payloads";
import { ARRR_ADDRESS, SELLER, SHORT_STORE_ID, STORE_ID, viewedStore } from "../test/fixtures/shop";

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
