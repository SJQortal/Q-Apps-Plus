import { describe, expect, it } from "vitest";
import COUNTRY_LIST from "./countries.json";
import {
  ALL_COUNTRY_CODES,
  EU_COUNTRIES,
  SHIPPING_REGIONS,
  countryCode,
  shippingCountriesOf,
  shippingSummary,
  shipsToCountry,
} from "./shipping";

const region = (id: string) => SHIPPING_REGIONS.find((r) => r.id === id)!.codes;

describe("shipping regions", () => {
  it("hold every country of the delivery form's list, each in one region", () => {
    const codes = (COUNTRY_LIST as { value: string }[]).map((c) => c.value);
    expect([...ALL_COUNTRY_CODES].sort()).toEqual([...codes].sort());
    expect(new Set(ALL_COUNTRY_CODES).size).toBe(ALL_COUNTRY_CODES.length);
    expect(EU_COUNTRIES.every((c) => region("europe").includes(c))).toBe(true);
  });

  it("say in words what a shop ships to", () => {
    expect(shippingSummary([])).toBe("");
    expect(shippingSummary(ALL_COUNTRY_CODES)).toBe("Worldwide");
    expect(shippingSummary(ALL_COUNTRY_CODES.filter((c) => !["AQ", "BV", "TF", "HM", "GS"].includes(c)))).toBe("Worldwide");
    expect(shippingSummary(ALL_COUNTRY_CODES.filter((c) => c !== "RU" && c !== "BY"))).toBe("Worldwide except Belarus and Russian Federation");
    expect(shippingSummary(EU_COUNTRIES)).toBe("the European Union");
    expect(shippingSummary(region("europe"))).toBe("Europe");
    expect(shippingSummary([...region("europe").filter((c) => c !== "RU"), ...region("north-america")])).toBe("Europe (except Russian Federation) and North America");
    expect(shippingSummary([...EU_COUNTRIES, ...region("north-america")])).toBe("the European Union and North America");
    expect(shippingSummary(["IS", "NO", "SE"])).toBe("Iceland, Norway and Sweden");
    expect(shippingSummary(region("asia").slice(0, 6))).toBe("6 countries in Asia");
    expect(shippingSummary(region("europe").slice(0, 40))).toMatch(/^Europe \(except .+ and 9 more\)$/);
  });

  it("check a buyer's country against a shop's list, and say nothing for a shop without one", () => {
    const shop = { shippingCountries: ["IS", "NO", "XX", 5] };
    expect(shippingCountriesOf(shop)).toEqual(["IS", "NO"]);
    expect(shipsToCountry(shop, "Iceland")).toBe(true);
    expect(shipsToCountry(shop, "germany")).toBe(false);
    expect(shipsToCountry({}, "Germany")).toBe(true);
    expect(shipsToCountry({ shippingCountries: [] }, "Germany")).toBe(true);
    expect(countryCode("United States")).toBe("US");
  });
});
