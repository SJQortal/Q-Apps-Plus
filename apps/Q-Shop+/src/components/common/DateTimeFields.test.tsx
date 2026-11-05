/** The app's own date and time fields (components/common/DateTimeFields.tsx). */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { DateField, DateTimeField, TimeField, dateLabel, parseTime } from "./DateTimeFields";

describe("parseTime", () => {
  it("reads the ways people type a time", () => {
    expect(parseTime("9")).toBe("09:00");
    expect(parseTime("930")).toBe("09:30");
    expect(parseTime("9:30 pm")).toBe("21:30");
    expect(parseTime("17.30")).toBe("17:30");
    expect(parseTime("12am")).toBe("00:00");
    expect(parseTime("12 pm")).toBe("12:00");
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("13pm")).toBeNull();
    expect(parseTime("soon")).toBeNull();
  });
});

function Time({ onValue }: { onValue: (v: string) => void }) {
  const [value, setValue] = useState("10:00");
  return <TimeField label="From" value={value} onChange={(v) => (setValue(v), onValue(v))} />;
}

describe("TimeField", () => {
  it("picks a time from the list, or takes a typed one", async () => {
    const onValue = vi.fn();
    renderWithProviders(<Time onValue={onValue} />);
    const field = screen.getByRole("combobox", { name: "From" });
    fireEvent.mouseDown(field);
    fireEvent.click(await screen.findByRole("option", { name: "10:30 AM" }));
    expect(onValue).toHaveBeenLastCalledWith("10:30");
    fireEvent.change(field, { target: { value: "1745" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onValue).toHaveBeenLastCalledWith("17:45");
    expect(field).toHaveValue("5:45 PM");
  });
});

function Day({ onValue, initial = "" }: { onValue: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return <DateField label="Back on (optional)" value={value} onChange={(v) => (setValue(v), onValue(v))} />;
}

describe("DateField", () => {
  it("opens a calendar, picks a day, and clears it", async () => {
    const onValue = vi.fn();
    renderWithProviders(<Day onValue={onValue} initial="2026-11-03" />);
    expect(screen.getByLabelText("Back on (optional)")).toHaveValue(dateLabel("2026-11-03"));
    fireEvent.click(screen.getByRole("button", { name: "Choose: Back on (optional)" }));
    const calendar = await screen.findByRole("dialog", { name: "Back on (optional)" });
    expect(within(calendar).getByText("November 2026")).toBeInTheDocument();
    fireEvent.click(within(calendar).getByRole("button", { name: "Next month" }));
    fireEvent.click(within(calendar).getByRole("button", { name: /December 24, 2026|24 December 2026/ }));
    expect(onValue).toHaveBeenLastCalledWith("2026-12-24");
    fireEvent.click(screen.getByRole("button", { name: "Choose: Back on (optional)" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Back on (optional)" })).getByRole("button", { name: "Clear" }));
    expect(onValue).toHaveBeenLastCalledWith("");
  });
});

describe("DateTimeField", () => {
  it("keeps the time when the day changes", async () => {
    const onChange = vi.fn();
    renderWithProviders(<DateTimeField label="Ends" value="2026-11-03T18:15" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose: Ends" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Ends" })).getByRole("button", { name: /November 5, 2026|5 November 2026/ }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-05T18:15");
  });
});
