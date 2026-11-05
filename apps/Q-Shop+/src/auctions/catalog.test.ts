import { describe, expect, it } from "vitest";
import { base64ToJson, type CatalogueDoc, type DataContainerDoc, type PublishResource } from "../qdn/payloads";
import { auctionRowOf, rowAuctionPhase, withAuctionRows } from "./catalog";

const LIST = "q-store-datacontainer-my-shop";
const terms = { v: 1, start: 1000, end: 5000, startingBid: 2, extendMinutes: 5 };

function built(products: Record<string, Record<string, unknown>>) {
  const dataContainer = { id: LIST, storeId: "q-store-general-my-shop", products } as unknown as DataContainerDoc;
  const resources: PublishResource[] = [
    { name: "Seller", service: "DOCUMENT", identifier: "q-store-catalogue-my-shop-AAA", data64: "e30=" } as PublishResource,
    { name: "Seller", service: "DOCUMENT", identifier: LIST, data64: "e30=" } as PublishResource,
  ];
  return { dataContainer, resources, catalogues: [] as CatalogueDoc[] };
}

describe("auctions in the product list", () => {
  it("rows of auctions say when they run and keep the product's status; the list's publish carries them", () => {
    const before = built({
      P1: { created: 1, priceQort: 2, category: "Art", catalogueId: "C", status: "AVAILABLE" },
      P2: { created: 2, priceQort: 9, category: "Art", catalogueId: "C", status: "AVAILABLE", auction: { start: 1, end: 2 } },
      P3: { created: 3, priceQort: 1, category: "Art", catalogueId: "C", status: "AVAILABLE" },
    });
    const after = withAuctionRows(before, {
      P1: { id: "P1", status: "OUT_OF_STOCK", auction: terms } as never,
      P2: { id: "P2", status: "AVAILABLE" } as never,
    });
    expect(after.dataContainer.products).toEqual({
      P1: { created: 1, priceQort: 2, category: "Art", catalogueId: "C", status: "OUT_OF_STOCK", auction: { start: 1000, end: 5000 } },
      P2: { created: 2, priceQort: 9, category: "Art", catalogueId: "C", status: "AVAILABLE" },
      P3: { created: 3, priceQort: 1, category: "Art", catalogueId: "C", status: "AVAILABLE" },
    });
    const list = after.resources.find((r) => r.identifier === LIST)!;
    expect(base64ToJson(list.data64)).toEqual(after.dataContainer);
    expect(after.resources[0]).toBe(before.resources[0]);
  });

  it("leave a list without auctions exactly as the original builds it", () => {
    const before = built({ P1: { created: 1, priceQort: 2, category: "Art", catalogueId: "C", status: "AVAILABLE" } });
    expect(withAuctionRows(before, { P1: { id: "P1", status: "AVAILABLE" } as never })).toBe(before);
  });

  it("read the times from a row, and the phase they give", () => {
    expect(auctionRowOf({ auction: { start: 1, end: 2 } })).toEqual({ start: 1, end: 2 });
    expect(auctionRowOf({ auction: { start: 2, end: 2 } })).toBeNull();
    expect(auctionRowOf({ auction: "soon" })).toBeNull();
    expect(auctionRowOf(null)).toBeNull();
    expect([500, 1000, 4999, 5000].map((now) => rowAuctionPhase({ auction: terms }, now))).toEqual(["upcoming", "live", "live", "ended"]);
    expect(rowAuctionPhase({}, 1)).toBeNull();
  });
});
