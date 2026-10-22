import { beforeEach, describe, expect, it } from "vitest";
import { DELETED_SHOPS_STORAGE_KEY } from "../constants/plus";
import { afterEach, vi } from "vitest";
import {
  DELETED_SHOP_MEMORY_MS,
  forgetDeletedShop,
  isDeletedRow,
  isJsonFromBeforeDelete,
  isRecentlyDeletedShop,
  isRowFromBeforeDelete,
  isShopDeleted,
  noteDeletedShop,
  resetDeletedShops,
} from "./deleted";
import { resetQdnCaches } from "./search";

beforeEach(() => resetDeletedShops());

describe("deleted shops", () => {
  it("tells a search row a Q-Shop+ delete wrote from a shop's", () => {
    expect(isDeletedRow({ metadata: { title: "deleted", description: "deleted", tags: ["deleted"] } })).toBe(true);
    expect(isDeletedRow({ metadata: { title: "deleted", tags: ["deleted"] } })).toBe(true);
    expect(isDeletedRow({ metadata: { title: "deleted", description: "**coins:QORTtrue,ARRRfalse**Old things" } })).toBe(false);
    expect(isDeletedRow({ metadata: { title: "Seller's Shop", description: "deleted", tags: ["deleted"] } })).toBe(false);
    expect(isDeletedRow({})).toBe(false);
    expect(isDeletedRow(null)).toBe(false);
  });

  it("remembers this browser's deletes for an hour, per owner and shop id, across reloads", () => {
    noteDeletedShop("Seller Name", "q-store-general-my-shop", 1000);
    expect(isRecentlyDeletedShop("Seller Name", "q-store-general-my-shop", 2000)).toBe(true);
    expect(isRecentlyDeletedShop("Other Name", "q-store-general-my-shop", 2000)).toBe(false);
    expect(isRecentlyDeletedShop("Seller Name", "q-store-general-my-shop", 1000 + DELETED_SHOP_MEMORY_MS + 1)).toBe(false);
    expect(JSON.parse(localStorage.getItem(DELETED_SHOPS_STORAGE_KEY)!)).toEqual({ "Seller Name\nq-store-general-my-shop": 1000 });
  });

  it("forgets a shop created again under the id, and old deletes as new ones are noted", () => {
    noteDeletedShop("Seller Name", "q-store-general-my-shop", 1000);
    forgetDeletedShop("Seller Name", "q-store-general-my-shop");
    expect(isRecentlyDeletedShop("Seller Name", "q-store-general-my-shop", 1001)).toBe(false);
    noteDeletedShop("Seller Name", "q-store-general-old", 1000);
    noteDeletedShop("Seller Name", "q-store-general-new", 1000 + DELETED_SHOP_MEMORY_MS + 5);
    expect(Object.keys(JSON.parse(localStorage.getItem(DELETED_SHOPS_STORAGE_KEY)!))).toEqual(["Seller Name\nq-store-general-new"]);
  });
});

describe("the memory only explains what is older than the delete", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetQdnCaches();
  });

  it("hides a search row or a shop JSON from before the delete, never a newer one", () => {
    resetDeletedShops();
    const at = Date.now() - 1000;
    noteDeletedShop("Seller Name", "q-store-general-my-shop", at);
    const row = { name: "Seller Name", identifier: "q-store-general-my-shop", created: 1, updated: at - 5 };
    expect(isRowFromBeforeDelete(row)).toBe(true);
    expect(isRowFromBeforeDelete({ ...row, updated: at + 5 })).toBe(false);
    expect(isJsonFromBeforeDelete("Seller Name", "q-store-general-my-shop", { created: 1 })).toBe(true);
    expect(isJsonFromBeforeDelete("Seller Name", "q-store-general-my-shop", { created: at + 5 })).toBe(false);
    expect(isJsonFromBeforeDelete("Other Name", "q-store-general-my-shop", { created: 1 })).toBe(false);
  });

  it("never lets a shop be created over a live, newer one: the node is read first", async () => {
    resetDeletedShops();
    resetQdnCaches();
    const at = Date.now() - 1000;
    noteDeletedShop("Seller Name", "q-store-general-my-shop", at);
    const serve = (text: string, status = 200) =>
      vi.stubGlobal("fetch", vi.fn(async () => ({ ok: status === 200, status, text: async () => text })));
    serve(JSON.stringify({ title: "Made again on my phone", created: at + 500 }));
    expect(await isShopDeleted("Seller Name", "q-store-general-my-shop")).toBe(false);
    serve(JSON.stringify({ title: "The old one", created: 1 }));
    expect(await isShopDeleted("Seller Name", "q-store-general-my-shop")).toBe(true);
    serve(JSON.stringify({ deleted: true, title: "Deleted shop" }));
    expect(await isShopDeleted("Seller Name", "q-store-general-other")).toBe(true);
    serve("{}", 500);
    expect(await isShopDeleted("Seller Name", "q-store-general-my-shop")).toBe(true);
    expect(await isShopDeleted("Seller Name", "q-store-general-other")).toBe(false);
  });
});
