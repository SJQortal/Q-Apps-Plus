import { beforeEach, describe, expect, it } from "vitest";
import { DELETED_SHOPS_STORAGE_KEY } from "../constants/plus";
import {
  DELETED_SHOP_MEMORY_MS,
  forgetDeletedShop,
  isDeletedRow,
  isRecentlyDeletedShop,
  noteDeletedShop,
  resetDeletedShops,
} from "./deleted";

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
