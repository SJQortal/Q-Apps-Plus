import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ShopDescription } from "./ShopHeader";

/** jsdom has no layout: the description is as tall as `height` while clamped to `clamp`. */
function sizes(height: number, clamp: number) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(height);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(Math.min(height, clamp));
}

afterEach(() => vi.restoreAllMocks());

describe("ShopDescription", () => {
  it("shows a short description whole, without Show more", () => {
    sizes(80, 160);
    render(<ShopDescription text="Hand-thrown mugs from Lisbon." />);
    expect(screen.getByText("Hand-thrown mugs from Lisbon.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("shows a long one's first lines, with Show more and Show less", () => {
    sizes(600, 160);
    render(<ShopDescription text={"A long story about the shop. ".repeat(40)} />);
    const more = screen.getByRole("button", { name: "Show more" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(more);
    const less = screen.getByRole("button", { name: "Show less" });
    expect(less).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(less);
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });
});
