/** The auction's Starts: now (on publishing) or at a date (Simon, 2026-10-24). */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { renderWithProviders } from "../test/renderWithProviders";
import { AuctionFields } from "./AuctionFields";
import { defaultAuctionValues, toLocalInput, type AuctionFormValues } from "./productDraft";

const NOW = Date.now();

function Form({ start = "", onValue }: { start?: string; onValue: (v: AuctionFormValues) => void }) {
  const [value, setValue] = useState<AuctionFormValues>({ ...defaultAuctionValues(NOW), startingBid: "5", start });
  return (
    <AuctionFields
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

describe("an auction's start", () => {
  it("starts now by default; At a date offers the next full hour to change, and Now clears it", () => {
    const onValue = vi.fn();
    renderWithProviders(<Form onValue={onValue} />);
    const starts = screen.getByRole("group", { name: "Starts" });
    expect(within(starts).getByRole("button", { name: "Now" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Bidding opens as soon as you publish it.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Starts at/)).toBeNull();

    fireEvent.click(within(starts).getByRole("button", { name: "At a date" }));
    const at = screen.getByLabelText(/^Starts at/) as HTMLInputElement;
    const typed = new Date(at.value).getTime();
    expect(typed).toBeGreaterThan(Date.now());
    expect(typed - Date.now()).toBeLessThanOrEqual(3_600_000);
    expect(onValue.mock.lastCall![0].start).toBe(at.value);

    fireEvent.click(within(starts).getByRole("button", { name: "Now" }));
    expect(onValue.mock.lastCall![0].start).toBe("");
    expect(screen.queryByLabelText(/^Starts at/)).toBeNull();
  });

  it("an auction set to start later opens on its date", () => {
    const start = toLocalInput(Date.now() + 3 * 86_400_000);
    renderWithProviders(<Form start={start} onValue={() => {}} />);
    expect(within(screen.getByRole("group", { name: "Starts" })).getByRole("button", { name: "At a date" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/^Starts at/)).toHaveValue(start);
  });
});
