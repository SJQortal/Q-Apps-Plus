import { describe, expect, it } from "vitest";
import { awayForPublish, awayOf, awayText, dayFromInput, dayToInput } from "./away";
import { shopFormValues, toStoreFields } from "../seller/shopFields";
import { buildEditStorePublish } from "../qdn/payloads";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

describe("a seller away", () => {
  it("holds until the end of the day the seller is back, and reads safely", () => {
    const until = day(2026, 11, 3);
    expect(awayOf({ away: { until, note: " At a fair " } }, day(2026, 11, 1))).toEqual({ until, note: "At a fair" });
    expect(awayOf({ away: { until } }, day(2026, 11, 3) + 3_600_000)).toEqual({ until });
    expect(awayOf({ away: { until } }, day(2026, 11, 4))).toBeNull();
    expect(awayOf({ away: {} }, 0)).toEqual({});
    expect(awayOf({ away: "yes" })).toBeNull();
    expect(awayOf({})).toBeNull();
  });

  it("says when orders are dispatched again", () => {
    expect(awayText({ until: day(2026, 11, 3) }, "Plus Gadgets", "en-GB")).toBe("Plus Gadgets is away until 3 November: orders are dispatched after that.");
    expect(awayText({}, "")).toBe("Away for now: orders are dispatched once the seller is back.");
  });

  it("goes from the form to the shop's JSON and back, and out when switched off", () => {
    expect(dayToInput(dayFromInput("2026-11-03"))).toBe("2026-11-03");
    expect(dayFromInput("3/11/2026")).toBeUndefined();
    expect(awayForPublish({ away: true, awayUntil: "2026-11-03", awayNote: "Fair" })).toEqual({ until: day(2026, 11, 3), note: "Fair" });
    expect(awayForPublish({ away: false, awayUntil: "2026-11-03", awayNote: "Fair" })).toBeNull();
    const store = { id: "q-store-general-shop", title: "Shop", description: "d", location: "l", shipsTo: "Europe", logo: "x", foreignCoins: { ARRR: "" }, supportedCoins: ["QORT"], away: { note: "Back soon" } };
    const values = shopFormValues(store);
    expect(values).toMatchObject({ away: true, awayUntil: "", awayNote: "Back soon" });
    const off = buildEditStorePublish({ name: "Seller", currentStore: store, fields: toStoreFields({ ...values, away: false }) });
    expect("away" in off.storeObj).toBe(false);
    const on = buildEditStorePublish({ name: "Seller", currentStore: store, fields: toStoreFields(values) });
    expect(on.storeObj.away).toEqual({ note: "Back soon" });
  });
});
