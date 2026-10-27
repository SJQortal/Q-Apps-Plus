import { describe, expect, it } from "vitest";
import COUNTRY_LIST from "./countries.json";
import STATE_LIST from "./states.json";
import {
  ALL_COUNTRY_CODES,
  EU_COUNTRIES,
  SHIPPING_REGIONS,
  countryCode,
  shippingCountriesOf,
  shippingSummary,
  shipsToCountry,
  ALL_STATE_CODES,
  LOWER_48,
  US_STATE_GROUPS,
  placeNotShipped,
  shippingFromTags,
  withShippingTags,
  shippingStatesOf,
  shippingSummaryWithStates,
  shipsToAddress,
  statesSummary,
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

describe("shipping within the United States, by state", () => {
  it("groups every state of the delivery form's list once: 50 states, DC and 8 territories", () => {
    const codes = (STATE_LIST as { value: string }[]).map((st) => st.value);
    expect([...ALL_STATE_CODES].sort()).toEqual([...codes].sort());
    expect(US_STATE_GROUPS.map((g) => g.codes.length)).toEqual([50, 1, 8]);
    expect(LOWER_48).toHaveLength(49);
    expect(LOWER_48).not.toContain("AK");
    expect(LOWER_48).toContain("DC");
  });

  it("say in words which states", () => {
    expect(statesSummary(null)).toBe("every state");
    expect(statesSummary(LOWER_48)).toBe("the lower 48 and DC");
    expect(statesSummary(ALL_STATE_CODES.filter((c) => c !== "AK" && c !== "HI"))).toBe("every state and territory except Alaska and Hawaii");
    expect(statesSummary(LOWER_48.filter((c) => c !== "TX"))).toBe("every state except Alaska, Hawaii and Texas, no territories");
    expect(statesSummary(US_STATE_GROUPS[0].codes.concat("DC"))).toBe("every state, no territories");
    expect(statesSummary([...US_STATE_GROUPS[0].codes, "DC", "PR"])).toBe("every state and 1 territory");
    expect(statesSummary(["CA", "OR", "WA"])).toBe("California, Oregon and Washington");
    expect(statesSummary(LOWER_48.slice(0, 12))).toBe("12 states");
    expect(shippingSummaryWithStates(["US"], LOWER_48)).toBe("the United States: the lower 48 and DC");
    expect(shippingSummaryWithStates(["US", "CA", "MX", "GL", "BM", "PM"], ["CA", "OR"])).toBe("North America; in the United States, California and Oregon");
    expect(shippingSummaryWithStates(["US"], null)).toBe("United States");
  });

  it("check a buyer's state against them, in the United States only, never blocking an unknown one", () => {
    const shop = { shippingCountries: ["US", "CA"], shippingStates: ["OR", "WA", "XX"] };
    expect(shippingStatesOf(shop)).toEqual(["OR", "WA"]);
    expect(shipsToAddress(shop, "United States", "Oregon")).toBe(true);
    expect(shipsToAddress(shop, "United States", "Alaska")).toBe(false);
    expect(shipsToAddress(shop, "United States", "")).toBe(true);
    expect(shipsToAddress(shop, "Canada", "Alaska")).toBe(true);
    expect(shipsToAddress(shop, "Germany", "")).toBe(false);
    expect(shipsToAddress({ shippingCountries: ["US"] }, "United States", "Alaska")).toBe(true);
    expect(placeNotShipped(shop, "United States", "Alaska")).toBe("Alaska, United States");
    expect(placeNotShipped(shop, "Germany", "")).toBe("Germany");
    expect(placeNotShipped(shop, "United States", "Oregon")).toBeNull();
  });
});

describe("ships-to as region tags (another Q-Shop build)", () => {
  // As the ppmSilver shop on QDN has it: every US state and territory, and North and Central America.
  const caribbean = ["anguilla", "antigua-and-barbuda", "aruba", "bahamas", "barbados", "belize", "bermuda", "canada", "cayman-islands"];
  const allStates = (STATE_LIST as { value: string }[]).map((st) => `state:us-${st.value.toLowerCase()}`);

  it("reads countries by their slugged names and US states by code", () => {
    const tags = shippingFromTags(["country:canada", "country:antigua-and-barbuda", "country:aland-islands", "state:us-ca", "state:us-or"]);
    expect(tags).toEqual({
      countries: ["AX", "US", "CA", "AG"],
      states: ["CA", "OR"],
      text: "Åland Islands, United States, Canada and Antigua and Barbuda; in the United States, California and Oregon",
    });
  });

  it("every state is the whole United States", () => {
    const tags = shippingFromTags([...allStates, ...caribbean.map((c) => `country:${c}`)])!;
    expect(tags.states).toBeNull();
    expect(tags.countries).toContain("US");
    expect(tags.text).not.toMatch(/in the United States/);
  });

  it("isn't tags when it is text, empty, or a tag isn't on the lists", () => {
    expect(shippingFromTags("Europe")).toBeNull();
    expect(shippingFromTags([])).toBeNull();
    expect(shippingFromTags(["country:canada", "country:atlantis"])).toBeNull();
    expect(shippingFromTags(["country:canada", "state:us-zz"])).toBeNull();
    expect(shippingFromTags(["country:canada", 5])).toBeNull();
  });

  it("gives the shop words for shipsTo and its countries, keeping a list it has", () => {
    const read = withShippingTags<Record<string, unknown>>({ title: "Shop", shipsTo: ["country:canada", "state:us-tx"] });
    expect(read).toEqual({ title: "Shop", shipsTo: "United States and Canada; in the United States, Texas", shippingCountries: ["US", "CA"], shippingStates: ["TX"] });
    expect(shipsToCountry(read, "Canada")).toBe(true);
    expect(shipsToCountry(read, "Germany")).toBe(false);
    expect(placeNotShipped(read, "United States", "Ohio")).toBe("Ohio, United States");
    const own = withShippingTags({ shipsTo: ["country:canada"], shippingCountries: ["DE"] });
    expect(own).toEqual({ shipsTo: "Canada", shippingCountries: ["DE"] });
    const text = { shipsTo: "Europe" };
    expect(withShippingTags(text)).toBe(text);
  });
});
