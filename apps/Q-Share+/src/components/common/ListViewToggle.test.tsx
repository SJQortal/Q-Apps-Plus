import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { readSettings, resetSettingsCache } from "../../utils/settings";
import { ListViewToggle } from "./ListViewToggle";

describe("ListViewToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsCache();
  });

  it("starts on the list and saves the grid choice as a setting", () => {
    renderWithProviders(<ListViewToggle />);
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(readSettings().listView).toBe("grid");
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
    // Pressing the chosen layout again keeps it.
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(readSettings().listView).toBe("grid");
  });
});
