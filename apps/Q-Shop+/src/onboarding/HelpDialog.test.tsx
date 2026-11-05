import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { HELP, HelpDialog } from "./HelpDialog";

describe("help", () => {
  it("answers buyers' and sellers' first questions, one open at a time", () => {
    renderWithProviders(<HelpDialog onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Help" });
    expect(within(dialog).getAllByRole("heading", { level: 3 })).toHaveLength(HELP.flatMap((g) => g.items).length);
    fireEvent.click(within(dialog).getByRole("button", { name: "How do I pay?" }));
    expect(within(dialog).getByText(/Q-Shop\+ never holds your money/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "How do I start?" }));
    expect(within(dialog).getByRole("button", { name: "How do I pay?" })).toHaveAttribute("aria-expanded", "false");
  });
});
