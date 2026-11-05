import { describe, expect, it } from "vitest";
import { PENDING_DELETES_STORAGE_KEY } from "../constants/plus";
import { clearPendingCatalogues, notePendingDelete, pendingDeleteFor, resetPendingDeletes } from "./pendingDeletes";

describe("unfinished product deletes", () => {
  it("are kept per name and shop, merged, and cleared catalogue by catalogue", () => {
    resetPendingDeletes();
    notePendingDelete({ name: "Seller", storeId: "s1", productIds: ["p1"], catalogueIds: ["c1"] }, 5);
    notePendingDelete({ name: "Seller", storeId: "s1", productIds: ["p2"], catalogueIds: ["c1", "c2"] }, 6);
    notePendingDelete({ name: "Other", storeId: "s1", productIds: ["x"], catalogueIds: ["cx"] }, 7);
    expect(pendingDeleteFor("Seller", "s1")).toEqual({ name: "Seller", storeId: "s1", productIds: ["p1", "p2"], catalogueIds: ["c1", "c2"], at: 6 });
    expect(JSON.parse(localStorage.getItem(PENDING_DELETES_STORAGE_KEY)!)).toHaveLength(2);
    clearPendingCatalogues("Seller", "s1", ["c1"]);
    expect(pendingDeleteFor("Seller", "s1")?.catalogueIds).toEqual(["c2"]);
    clearPendingCatalogues("Seller", "s1", ["c2"]);
    expect(pendingDeleteFor("Seller", "s1")).toBeNull();
    expect(pendingDeleteFor("Other", "s1")).not.toBeNull();
  });
});
