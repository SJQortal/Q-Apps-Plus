import { describe, expect, it } from "vitest";
import { orderCountLabel } from "./orderCount";

describe("the order count's words", () => {
  it("says it plainly, and says when there were more than it read", () => {
    expect(orderCountLabel({ kind: "count", count: 0, capped: false })).toBe("No orders yet");
    expect(orderCountLabel({ kind: "count", count: 1, capped: false })).toBe("1 order");
    expect(orderCountLabel({ kind: "count", count: 1234, capped: false })).toBe("1,234 orders");
    expect(orderCountLabel({ kind: "count", count: 1000, capped: true })).toBe("1,000+ orders");
    expect(orderCountLabel({ kind: "shared" })).toBeNull();
  });
});
