import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { NextSteps } from "./NextSteps";

const steps = () => within(screen.getByRole("list", { name: "What happens next" })).getAllByRole("listitem").map((li) => li.textContent);

describe("what happens next", () => {
  it("names the shop's dispatch time, then where to follow it", () => {
    renderWithProviders(<NextSteps shop={{ title: "Plus Gadgets", policies: { dispatchDays: 2 } }} digital={false} />);
    expect(steps()).toEqual([
      "Dispatched within 2 working days.",
      "My orders shows its status, and the tracking number when the seller adds one.",
      "When it arrives, mark it delivered, then review the shop.",
    ]);
  });

  it("says when an away seller sends it, and a digital order's own steps", () => {
    const view = renderWithProviders(<NextSteps shop={{ title: "Ålund Ceramics", away: { note: "Fair" } }} digital={false} />);
    expect(steps()[0]).toBe("Ålund Ceramics is away for now: orders are dispatched once the seller is back.");
    view.unmount();
    renderWithProviders(<NextSteps shop={{ owner: "Seller" }} digital />);
    expect(steps()).toEqual(["Seller sends it as the shop says (by Q-Mail, often).", "Mark it received in My orders once you have it, then review the shop."]);
  });
});
