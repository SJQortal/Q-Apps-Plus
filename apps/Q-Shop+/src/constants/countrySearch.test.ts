import { describe, expect, it } from "vitest";
import { ALL_COUNTRY_CODES, countryName } from "./shipping";
import { matchCountries } from "./countrySearch";

const all = [...ALL_COUNTRY_CODES].sort((a, b) => countryName(a).localeCompare(countryName(b)));
const find = (q: string) => matchCountries(all, q, countryName, (c) => c).slice(0, 3);

describe("finding a country", () => {
  it("by its everyday names first: us, usa, states, america, uk, holland", () => {
    for (const q of ["us", "US", "usa", "states", "america", "u.s.a."]) expect(find(q)[0]).toBe("US");
    expect(find("uk")[0]).toBe("GB");
    expect(find("england")[0]).toBe("GB");
    expect(find("holland")[0]).toBe("NL");
    expect(find("korea")[0]).toBe("KR");
  });

  it("by its name in its own language, without the accents", () => {
    expect(find("polska")[0]).toBe("PL");
    expect(find("deutschland")[0]).toBe("DE");
    expect(find("espana")[0]).toBe("ES");
    expect(find("ísland")[0]).toBe("IS");
    expect(find("Sverige")[0]).toBe("SE");
  });

  it("keeps a word inside a name: Tanzania for united", () => {
    const united = matchCountries(all, "unit", countryName, (c) => c);
    expect(united.slice(0, 4)).toEqual(["AE", "GB", "US", "UM"]);
    expect(united).toContain("TZ");
  });
});

describe("the delivery form's formal names", () => {
  it("still find a country the app shows by its plain name (Simon, 2026-10-27)", () => {
    const codes = ["IR", "SY", "PS", "IQ"];
    const found = (q: string) => matchCountries(codes, q, countryName, (c) => c);
    expect(found("syrian arab")).toEqual(["SY"]);
    expect(found("islamic republic")).toEqual(["IR"]);
    expect(found("occupied")).toEqual(["PS"]);
    expect(found("palestine")).toEqual(["PS"]);
  });
});
