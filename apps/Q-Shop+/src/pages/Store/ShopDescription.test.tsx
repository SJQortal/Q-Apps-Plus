import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders as render } from "../../test/renderWithProviders";
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

  it("shows one written with Markdown formatted, its links opening in a new Hub tab, and Show more when long", async () => {
    sizes(600, 160);
    const request = vi.fn(async () => true);
    vi.stubGlobal("qortalRequest", request);
    render(<ShopDescription text={"## Biohackers Corner\n**Icelandic** supplements\n- Lion's Mane\n- Matcha\n\nOur [blog](qortal://APP/Q-Blog/Biohackers)"} />);
    expect(screen.getByRole("heading", { level: 2, name: "Biohackers Corner" })).toBeInTheDocument();
    expect(screen.getByText("Icelandic").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Lion's Mane", "Matcha"]);
    expect(screen.queryByText(/\*\*/)).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "blog" }));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
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

  it("makes its qortal:// addresses links that open in a new Hub tab, without the full stop after them", async () => {
    sizes(80, 160);
    const request = vi.fn(async () => true);
    vi.stubGlobal("qortalRequest", request);
    render(<ShopDescription text={"Our blog: qortal://APP/Q-Blog/Biohackers Corner. Visit soon"} />);
    const link = screen.getByRole("link", { name: "qortal://APP/Q-Blog/Biohackers" });
    expect(screen.getByText(/Corner\. Visit soon/)).toBeInTheDocument();
    fireEvent.click(link);
    await waitFor(() => expect(request).toHaveBeenCalledWith({ action: "OPEN_NEW_TAB", qortalLink: "qortal://APP/Q-Blog/Biohackers" }));
    vi.unstubAllGlobals();
  });
});
