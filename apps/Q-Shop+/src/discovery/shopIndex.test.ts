import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptsArrrFromDescription,
  HIDDEN_TEST_SHOP_OWNER,
  loadShopIndex,
  matchesShopQuery,
  peekShopIndex,
  resetShopIndexMemory,
  searchShopsPage,
  shopEntryFromRow,
  shopKey,
} from "./shopIndex";
import type { QdnResourceSummary } from "../qdn/search";

function storeRow(owner: string, short: string, extra: Partial<QdnResourceSummary> = {}): QdnResourceSummary {
  return {
    name: owner,
    service: "STORE",
    identifier: `q-store-general-${short}`,
    created: 1000,
    updated: 2000,
    metadata: { title: `Title ${short}`, description: `**coins:QORTtrue,ARRRfalse**About ${short}` },
    ...extra,
  };
}

function stubFetch(answer: (url: string) => unknown) {
  const fetchMock = vi.fn(async (input: string) => {
    const body = answer(String(input));
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const paramsOf = (url: string) => new URLSearchParams(url.split("?")[1]);

beforeEach(() => {
  resetShopIndexMemory();
  vi.unstubAllGlobals();
});

describe("shop entries from search rows", () => {
  it("takes title and description from the metadata, without the coins marker", () => {
    const entry = shopEntryFromRow(
      storeRow("Seller Name", "my-shop", {
        metadata: { title: "  Mugs & more ", description: "**coins:QORTtrue,ARRRtrue**Hand-made mugs" },
      })
    );
    expect(entry).toEqual({
      key: shopKey("Seller Name", "q-store-general-my-shop"),
      owner: "Seller Name",
      id: "q-store-general-my-shop",
      shortStoreId: "my-shop",
      title: "Mugs & more",
      description: "Hand-made mugs",
      created: 1000,
      updated: 2000,
      acceptsArrr: true,
    });
  });

  it("falls back to the short id for a title, and to created for updated", () => {
    const entry = shopEntryFromRow(storeRow("A", "plain", { metadata: undefined, updated: undefined }));
    expect(entry?.title).toBe("plain");
    expect(entry?.description).toBe("");
    expect(entry?.updated).toBe(1000);
    expect(entry?.acceptsArrr).toBe(false);
  });

  it("drops rows that aren't shops, and the original's hidden test shop", () => {
    expect(shopEntryFromRow(storeRow(HIDDEN_TEST_SHOP_OWNER, "test"))).toBeNull();
    expect(shopEntryFromRow({ ...storeRow("A", "x"), identifier: "q-store-general-" })).toBeNull();
    expect(shopEntryFromRow({ ...storeRow("A", "x"), identifier: "my-q-store-general-x" })).toBeNull();
    expect(shopEntryFromRow({ ...storeRow("A", "x"), name: "" })).toBeNull();
  });

  it("reads the ARRR marker only at the start of the description", () => {
    expect(acceptsArrrFromDescription("**coins:QORTtrue,ARRRtrue**x")).toBe(true);
    expect(acceptsArrrFromDescription("**coins:QORTtrue,ARRRfalse**x")).toBe(false);
    expect(acceptsArrrFromDescription("We take ARRRtrue")).toBe(false);
    expect(acceptsArrrFromDescription(undefined)).toBe(false);
  });

  it("matches a search in the owner, short id, title or plain description, case-insensitively", () => {
    const entry = shopEntryFromRow(storeRow("Seller Name", "my-shop"))!;
    expect(matchesShopQuery(entry, "seller")).toBe(true);
    expect(matchesShopQuery(entry, "MY-SHOP")).toBe(true);
    expect(matchesShopQuery(entry, "about")).toBe(true);
    // Only in the parts every shop has, which Core also matched.
    expect(matchesShopQuery(entry, "arrrfalse")).toBe(false);
    expect(matchesShopQuery(entry, "coins")).toBe(false);
    expect(matchesShopQuery(entry, "store-general")).toBe(false);
  });
});

describe("the shop index", () => {
  it("is one paged search of STORE rows with metadata, blocked names left out", async () => {
    const fetchMock = stubFetch(() => [storeRow("A", "one"), storeRow("B", "two"), storeRow("A", "one")]);
    const index = await loadShopIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const params = paramsOf(fetchMock.mock.calls[0][0]);
    expect(params.get("service")).toBe("STORE");
    expect(params.get("identifier")).toBe("q-store-general-");
    expect(params.get("prefix")).toBe("true");
    expect(params.get("includemetadata")).toBe("true");
    expect(params.get("excludeblocked")).toBe("true");
    expect(params.get("mode")).toBe("ALL");
    expect(params.get("reverse")).toBe("true");
    expect(params.get("limit")).toBe("100");
    expect(params.get("offset")).toBe("0");
    expect(params.get("query")).toBeNull();
    expect(index.complete).toBe(true);
    expect(index.shops.map((s) => s.shortStoreId)).toEqual(["one", "two"]);
    expect(peekShopIndex()).toBe(index);
  });

  it("stops at five pages of 100 and says it isn't complete", async () => {
    const fetchMock = stubFetch((url) => {
      const offset = Number(paramsOf(url).get("offset"));
      return Array.from({ length: 100 }, (_, i) => storeRow(`Owner ${offset + i}`, `s${offset + i}`));
    });
    const index = await loadShopIndex();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.map((c) => paramsOf(c[0]).get("offset"))).toEqual(["0", "100", "200", "300", "400"]);
    expect(index.complete).toBe(false);
    expect(index.shops).toHaveLength(500);
  });

  it("is cached for the session; fresh asks again", async () => {
    const fetchMock = stubFetch(() => [storeRow("A", "one")]);
    await loadShopIndex();
    await loadShopIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await loadShopIndex({ fresh: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("the shop search", () => {
  it("sends the text as Core's query, without prefix (which would make it starts-with), 20 a page", async () => {
    const fetchMock = stubFetch(() => [storeRow("Mug Maker", "mugs")]);
    const page = await searchShopsPage("  mug ", 40);
    const params = paramsOf(fetchMock.mock.calls[0][0]);
    expect(params.get("service")).toBe("STORE");
    expect(params.get("query")).toBe("mug");
    expect(params.get("identifier")).toBe("q-store-general-");
    expect(params.get("prefix")).toBeNull();
    expect(params.get("includemetadata")).toBe("true");
    expect(params.get("excludeblocked")).toBe("true");
    expect(params.get("limit")).toBe("20");
    expect(params.get("offset")).toBe("40");
    expect(page.shops.map((s) => s.owner)).toEqual(["Mug Maker"]);
    expect(page.hasMore).toBe(false);
  });

  it("drops rows whose identifier only contains the shop prefix, or that matched only the coins marker", async () => {
    const rows = [
      storeRow("A", "arrr-shop"),
      { ...storeRow("B", "x"), identifier: "copy-of-q-store-general-x" },
      storeRow("C", "plain"),
    ];
    stubFetch(() => rows);
    const page = await searchShopsPage("arrr", 0);
    expect(page.shops.map((s) => s.owner)).toEqual(["A"]);
    // The next page still starts after every row Core sent.
    expect(page.rowCount).toBe(3);
  });

  it("has more when a full page came back", async () => {
    stubFetch(() => Array.from({ length: 20 }, (_, i) => storeRow(`O${i}`, `match-${i}`)));
    const page = await searchShopsPage("match", 0);
    expect(page.hasMore).toBe(true);
    expect(page.shops).toHaveLength(20);
  });
});
