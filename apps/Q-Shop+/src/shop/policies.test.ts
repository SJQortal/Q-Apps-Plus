import { describe, expect, it } from "vitest";
import { dispatchText, policiesForPublish, policiesOf, returnsText } from "./policies";

describe("shop policies", () => {
  it("reads only well-formed parts, from any shop JSON", () => {
    expect(policiesOf({ policies: { dispatchDays: 2, returnDays: 14, returns: "  Unused only ", terms: "" } })).toEqual({ dispatchDays: 2, returnDays: 14, returns: "Unused only" });
    expect(policiesOf({ policies: { dispatchDays: 0, returnDays: -1, returns: 5, terms: ["x"] } })).toBeNull();
    expect(policiesOf({ policies: { dispatchDays: 2.5, returnDays: "14" } })).toBeNull();
    expect(policiesOf({ policies: "returns ok" })).toBeNull();
    expect(policiesOf({})).toBeNull();
    expect(policiesOf(null)).toBeNull();
    expect(policiesOf({ policies: { terms: "x".repeat(1200) } })?.terms).toHaveLength(1000);
  });

  it("says them in plain words", () => {
    expect(dispatchText({ dispatchDays: 1 })).toBe("Dispatched within 1 working day");
    expect(dispatchText({ dispatchDays: 5 })).toBe("Dispatched within 5 working days");
    expect(dispatchText({})).toBeNull();
    expect(returnsText({ returnDays: 0 })).toBe("No returns");
    expect(returnsText({ returnDays: 30 })).toBe("Returns within 30 days of delivery");
    expect(returnsText(null)).toBeNull();
  });

  it("publishes what the form says, and nothing when it says nothing", () => {
    expect(policiesForPublish({ dispatchDays: 3, returnDays: 0, returns: "", terms: " Made to order " })).toEqual({ dispatchDays: 3, returnDays: 0, terms: "Made to order" });
    expect(policiesForPublish({ dispatchDays: null, returnDays: null, returns: " ", terms: "" })).toBeUndefined();
  });
});
