/** Test helpers for the product form's category field (seller/CategoryField.tsx). */
import { act, fireEvent, screen, within } from "@testing-library/react";

export const categoryInput = (container: HTMLElement) => within(container).getByRole("combobox", { name: /^Category/ }) as HTMLInputElement;

/** Types into the category field and picks the option whose name starts with `option`. */
export async function pickCategory(container: HTMLElement, typed: string, option: string) {
  fireEvent.change(categoryInput(container), { target: { value: typed } });
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(`^${escaped}`) }));
}

/** The options the category field lists for what is typed ("" opens the full list), names only. */
export async function categoryOptions(container: HTMLElement, typed: string): Promise<string[]> {
  const input = categoryInput(container);
  // A real focus (React listens to focusin): the field opens its list on focus.
  act(() => input.focus());
  if (typed) fireEvent.change(input, { target: { value: typed } });
  const list = await screen.findByRole("listbox");
  return within(list)
    .getAllByRole("option")
    .map((el) => el.textContent ?? "");
}
