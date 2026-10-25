import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { ShellContext, type ShellActions } from "../components/layout/shellState";
import { openWalkthrough, SELLER_GUIDE_KEY, suppressFirstRunForTests, useSellerGuideOnce, WALKTHROUGH_KEY, WalkthroughHost } from "./Walkthrough";
import { TOURS } from "./tours";

function SellerPage({ ready }: { ready: boolean }) {
  useSellerGuideOnce(ready);
  return null;
}

function renderHost(ready = true, sellerPage?: boolean) {
  const actions: ShellActions = { signIn: vi.fn(), reloadOwnShops: vi.fn(), authenticating: false };
  return renderWithProviders(
    <ShellContext.Provider value={actions}>
      <WalkthroughHost ready={ready} />
      {sellerPage !== undefined && <SellerPage ready={sellerPage} />}
    </ShellContext.Provider>
  );
}

beforeEach(() => {
  localStorage.clear();
  suppressFirstRunForTests(false);
});
afterEach(() => suppressFirstRunForTests(true));

describe("the walkthrough", () => {
  it("opens Welcome on a first visit once the notice is answered, steps through, and isn't shown again", async () => {
    const view = renderHost(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    view.unmount();
    renderHost(true);
    const dialog = await screen.findByRole("dialog", { name: "Welcome to Q-Shop+" });
    expect(within(dialog).getByRole("heading", { name: "Every Qortal shop in one place" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("heading", { name: "Find what you want" })).toBeInTheDocument();
    // The dots jump to any step.
    fireEvent.click(within(dialog).getByRole("button", { name: `Step ${TOURS.welcome.steps.length}: Already have a shop?` }));
    expect(within(dialog).getByRole("heading", { name: "Already have a shop?" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Skip" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Start" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(WALKTHROUGH_KEY)).toBe("1");
  });

  it("Skip closes it for good", async () => {
    renderHost(true);
    const dialog = await screen.findByRole("dialog", { name: "Welcome to Q-Shop+" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem(WALKTHROUGH_KEY)).toBe("1");
  });

  it("opens the seller guide from anywhere, even after Welcome was seen", async () => {
    localStorage.setItem(WALKTHROUGH_KEY, "1");
    renderHost(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => openWalkthrough("seller"));
    const dialog = await screen.findByRole("dialog", { name: "How selling works" });
    expect(within(dialog).getByRole("heading", { name: "1. Add your products" })).toBeInTheDocument();
    for (let i = 1; i < TOURS.seller.steps.length; i++) fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("heading", { name: "6. Grow your shop" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens the seller guide by itself once, when the seller's own shop is ready", async () => {
    localStorage.setItem(WALKTHROUGH_KEY, "1");
    const view = renderHost(true, false);
    expect(screen.queryByRole("dialog")).toBeNull();
    view.unmount();
    const again = renderHost(true, true);
    const dialog = await screen.findByRole("dialog", { name: "How selling works" });
    expect(localStorage.getItem(SELLER_GUIDE_KEY)).toBe("1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    again.unmount();
    renderHost(true, true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
