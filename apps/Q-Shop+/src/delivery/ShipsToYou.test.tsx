import { afterEach, describe, expect, it } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { ShipsToYou } from "./ShipsToYou";
import { setBuyerPlace } from "./buyerPlace";

afterEach(() => act(() => setBuyerPlace(null)));

describe("ships to the buyer", () => {
  it("says so from the shop's list, or its typed words when they name the place", () => {
    act(() => setBuyerPlace({ country: "Portugal", state: "" }));
    const said = (shop: object) => {
      const view = renderWithProviders(<ShipsToYou shop={shop} />);
      const text = view.container.textContent;
      view.unmount();
      return text;
    };
    expect(said({ shippingCountries: ["PT", "ES"] })).toBe("Ships to Portugal");
    expect(said({ shippingCountries: ["ES"] })).toBe("Doesn't ship to Portugal");
    expect(said({ shipsTo: "Worldwide" })).toBe("Ships to Portugal");
    // Words that don't name it say nothing either way.
    expect(said({ shipsTo: "Domestic" })).toBe("");
  });

  it("says nothing before the buyer has a country", () => {
    renderWithProviders(<ShipsToYou shop={{ shippingCountries: ["PT"] }} />);
    expect(screen.queryByText(/Portugal/)).toBeNull();
  });
});
