import { describe, expect, it } from "vitest";
import { languagesOf, languagesText, MAX_LANGUAGES } from "./languages";
import { shopFormValues, toStoreFields } from "../seller/shopFields";
import { buildEditStorePublish } from "../qdn/payloads";

describe("the languages a seller answers in", () => {
  it("reads known codes only, once each, in the shop's order", () => {
    expect(languagesOf({ languages: ["pt", "en", "pt", "xx", 5] })).toEqual(["pt", "en"]);
    expect(languagesOf({ languages: "en" })).toEqual([]);
    expect(languagesOf({ languages: ["en", "es", "pt", "fr", "de", "it", "nl", "pl", "cs"] })).toHaveLength(MAX_LANGUAGES);
  });

  it("names them in their own words", () => {
    expect(languagesText(["en", "pt", "de"])).toBe("English, Português and Deutsch");
    expect(languagesText(["ja"])).toBe("日本語");
  });

  it("go from the form to the shop's JSON, and out when emptied", () => {
    const store = { id: "q-store-general-shop", title: "Shop", description: "d", location: "l", shipsTo: "Europe", logo: "x", foreignCoins: { ARRR: "" }, supportedCoins: ["QORT"], languages: ["en"] };
    const values = shopFormValues(store);
    expect(values.languages).toEqual(["en"]);
    const more = buildEditStorePublish({ name: "Seller", currentStore: store, fields: toStoreFields({ ...values, languages: ["en", "pt"] }) });
    expect(more.storeObj.languages).toEqual(["en", "pt"]);
    const none = buildEditStorePublish({ name: "Seller", currentStore: store, fields: toStoreFields({ ...values, languages: [] }) });
    expect("languages" in none.storeObj).toBe(false);
  });
});

describe("the languages with the shop's policies", () => {
  it("show on a shop that states only them", async () => {
    const { renderWithProviders } = await import("../test/renderWithProviders");
    const { PolicyLines } = await import("./PolicyLines");
    const { screen } = await import("@testing-library/react");
    renderWithProviders(<PolicyLines shop={{ languages: ["pt", "en"] }} />);
    expect(screen.getByText("Answers in Português and English")).toBeInTheDocument();
  });
});
