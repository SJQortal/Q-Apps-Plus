import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { UpcomingOptions } from "./UpcomingOptions";

let doc: unknown = null;
vi.mock("../../delivery/checkoutDelivery", () => ({ loadShopDelivery: vi.fn(async () => ({ doc, pricing: null })) }));

describe("delivery options ahead", () => {
  it("names the options the buyer picks next", async () => {
    doc = { base: { name: "Standard" }, options: [{ id: "exp", name: "Express" }, { id: "pick", name: "Local pickup" }] };
    renderWithProviders(<UpcomingOptions owner="Shop+Plus" storeId="q-store-general-shop-1" />);
    expect(await screen.findByText("Next, you choose how it comes: Standard, Express or Local pickup, each priced for this address.")).toBeInTheDocument();
  });

  it("says nothing for a shop without options", async () => {
    doc = { general: { zones: [] } };
    const view = renderWithProviders(<UpcomingOptions owner="Shop+Plus" storeId="q-store-general-shop-1" />);
    await waitFor(() => expect(view.container.textContent).toBe(""));
  });
});
