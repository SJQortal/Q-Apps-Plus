import { describe, expect, it } from "vitest";
import {
  buildCollectionsPublish,
  collectionsPointer,
  MAX_COLLECTIONS,
  MAX_COLLECTION_TITLE,
  normalizeCollections,
  pruneCollections,
  type ShopCollection,
} from "./collections";
import { base64ToJson, type DataContainerDoc } from "./payloads";
import { DATA_CONTAINER_ID, SELLER, SHORT_STORE_ID, STORE_ID, dataContainer } from "../test/fixtures/shop";

const IMG = "data:image/webp;base64,SU1H";
const summer: ShopCollection = {
  id: "SUMMERxxx1",
  title: "Summer",
  description: "Light things",
  image: IMG,
  products: ["p1", "p2"],
  created: 10,
  updated: 20,
};

describe("collections", () => {
  it("reads only what can be shown: an id and a title each, text trimmed, image data URLs, product ids once", () => {
    const read = normalizeCollections({
      storeId: STORE_ID,
      collections: [
        { ...summer, title: "  Summer  ", products: ["p1", "p1", 7, "p2", ""] },
        { id: "NOTITLE", title: "  " },
        { id: "SUMMERxxx1", title: "A second Summer" },
        { id: "WEB", title: "Remote picture", image: "https://example.com/a.png", description: 5, created: "x" },
        "not an object",
        { id: "LONG", title: "x".repeat(200) },
      ],
    });
    expect(read).toEqual([
      summer,
      { id: "WEB", title: "Remote picture", description: "", products: [], created: 0, updated: 0 },
      { id: "LONG", title: "x".repeat(MAX_COLLECTION_TITLE), description: "", products: [], created: 0, updated: 0 },
    ]);
    expect(normalizeCollections("D")).toEqual([]);
    expect(normalizeCollections({ collections: {} })).toEqual([]);
    const many = { collections: Array.from({ length: 40 }, (_, i) => ({ id: `C${i}`, title: `C${i}` })) };
    expect(normalizeCollections(many)).toHaveLength(MAX_COLLECTIONS);
  });

  it("follows the product index's pointer only to this shop's document", () => {
    expect(collectionsPointer({ collectionsId: `q-store-collections-${SHORT_STORE_ID}` }, STORE_ID)).toBe(
      `q-store-collections-${SHORT_STORE_ID}`
    );
    expect(collectionsPointer({ collectionsId: "q-store-collections-other" }, STORE_ID)).toBeNull();
    expect(collectionsPointer({}, STORE_ID)).toBeNull();
    expect(collectionsPointer(null, STORE_ID)).toBeNull();
  });

  it("leaves out products the shop no longer lists", () => {
    expect(pruneCollections([summer], (id) => id === "p2")).toEqual([{ ...summer, products: ["p2"] }]);
  });

  it("publishes the document first, then (the first time) the product index with the pointer, its shape kept", () => {
    const index = dataContainer as unknown as DataContainerDoc;
    const first = buildCollectionsPublish({ name: SELLER, storeId: STORE_ID, collections: [summer], dataContainer: index });
    expect(first.resources.map((r) => [r.service, r.identifier, r.filename])).toEqual([
      ["DOCUMENT", `q-store-collections-${SHORT_STORE_ID}`, "collections.json"],
      ["DOCUMENT", DATA_CONTAINER_ID, "datacontainer.json"],
    ]);
    expect(base64ToJson(first.resources[0].data64)).toEqual({ storeId: STORE_ID, collections: [summer] });
    const indexSent = base64ToJson(first.resources[1].data64);
    expect(indexSent).toEqual({ ...dataContainer, collectionsId: `q-store-collections-${SHORT_STORE_ID}` });
    expect(Object.keys(indexSent).slice(0, 6)).toEqual(Object.keys(dataContainer));

    const again = buildCollectionsPublish({
      name: SELLER,
      storeId: STORE_ID,
      collections: [{ ...summer, image: undefined }],
      dataContainer: first.dataContainer,
    });
    expect(again.resources).toHaveLength(1);
    expect(base64ToJson(again.resources[0].data64).collections[0]).not.toHaveProperty("image");
  });
});
