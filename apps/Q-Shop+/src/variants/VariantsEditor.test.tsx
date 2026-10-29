import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { VariantsEditor, moved } from "./VariantsEditor";
import type { VariantFormValues } from "./drafts";

const form: VariantFormValues = {
  options: [{ name: "Round", values: [{ name: "Pale" }, { name: "Orange" }, { name: "Red" }], picture: null }],
  display: "bundle",
  rows: {},
};
vi.mock("../components/common/ImageUploader", async (load) => ({
  ...(await load<typeof import("../components/common/ImageUploader")>()),
  compressImage: async () => "data:image/webp;base64,ROUND",
}));

const pointer = (type: string, x: number) => Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 0 }), { pointerId: 1, pointerType: "mouse" });

describe("the variants editor", () => {
  it("adds a variant's new picture to the product's pictures too", async () => {
    const onChange = vi.fn();
    const onAddImage = vi.fn();
    renderWithProviders(<VariantsEditor value={form} onChange={onChange} onAddImage={onAddImage} images={[]} unit="QORT" basePrice="10" />);
    const button = screen.getByRole("button", { name: "Add a picture of Round" });
    const input = button.parentElement!.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(["x"], "round.png", { type: "image/png" })] } });
    await waitFor(() => expect(onAddImage).toHaveBeenCalledWith("data:image/webp;base64,ROUND"));
    expect(onChange).toHaveBeenLastCalledWith({ ...form, options: [{ ...form.options[0], picture: "data:image/webp;base64,ROUND" }] });
  });

  it("moves a value where it is dragged", () => {
    const onChange = vi.fn();
    renderWithProviders(<VariantsEditor value={form} onChange={onChange} images={[]} unit="QORT" basePrice="10" />);
    const chips = within(screen.getByRole("list", { name: "Round: values" })).getAllByRole("listitem");
    // A mouse drags Red over Pale (hooks/usePointerReorder.ts).
    document.elementFromPoint = (() => chips[0]) as never;
    fireEvent(chips[2], pointer("pointerdown", 0));
    fireEvent(window, pointer("pointermove", 100));
    expect(onChange).toHaveBeenLastCalledWith({ ...form, options: [{ ...form.options[0], values: [{ name: "Red" }, { name: "Pale" }, { name: "Orange" }] }] });
    expect(moved(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moved(["a"], 0, 3)).toEqual(["a"]);
  });

  it("gives a value a colour, and takes it away", async () => {
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(<VariantsEditor value={form} onChange={onChange} images={[]} unit="QORT" basePrice="10" />);
    fireEvent.click(screen.getByRole("button", { name: "Give Orange a colour" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Colour of Orange" })).getByRole("button", { name: "Amber" }));
    const coloured = onChange.mock.lastCall![0] as VariantFormValues;
    expect(coloured.options[0].values[1]).toEqual({ name: "Orange", color: "#f59e0b" });
    rerender(<VariantsEditor value={coloured} onChange={onChange} images={[]} unit="QORT" basePrice="10" />);
    // The item shows its colour; the chip's button says it has one.
    fireEvent.click(screen.getByRole("button", { name: "Colour of Orange: change" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Colour of Orange" })).getByRole("button", { name: "No colour" }));
    expect((onChange.mock.lastCall![0] as VariantFormValues).options[0].values[1]).toEqual({ name: "Orange" });
  });

  it("gives each item a price in the shop's Q-Asset, the product's showing when it has none", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <VariantsEditor value={form} onChange={onChange} images={[]} unit="QORT" basePrice="10" extraCoins={[{ coin: "ASSET:81", label: "Gold Bar", whole: true, base: "3" }]} />
    );
    const field = screen.getByRole("textbox", { name: "Price of Round / Orange in Gold Bar" });
    expect(field).toHaveAttribute("placeholder", "3");
    // Gold Bar can't be split: whole units only.
    fireEvent.change(field, { target: { value: "4.5" } });
    expect((onChange.mock.lastCall![0] as VariantFormValues).rows["Round\u0000Orange"]).toMatchObject({ coins: { "ASSET:81": "45" } });
  });
});

