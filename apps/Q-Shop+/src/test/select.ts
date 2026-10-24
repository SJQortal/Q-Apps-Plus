/**
 * Test helpers for select fields, which use MUI's menu (components/common/menuStyle.ts):
 * the field is a combobox named by its label and its choice ("Sort Newest").
 */
import { fireEvent, screen, within } from "@testing-library/react";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The select field labelled `label` (its name also says its choice). */
export function selectField(label: string, container: HTMLElement = document.body): HTMLElement {
  return within(container).getByRole("combobox", { name: new RegExp(`^${escape(label)}(\\s|$)`) });
}

/** The value the field holds (its hidden input's). */
export function selectValue(select: HTMLElement): string {
  return (select.parentElement?.querySelector("input") as HTMLInputElement | null)?.value ?? "";
}

/** Opens the field's menu and picks the option named `option`. */
export function chooseOption(select: HTMLElement, option: string | RegExp) {
  fireEvent.mouseDown(select);
  const list = screen.getByRole("listbox");
  fireEvent.click(within(list).getByRole("option", { name: option }));
}

/** The names of the field's options (opens its menu and closes it again). */
export function optionNames(select: HTMLElement): string[] {
  fireEvent.mouseDown(select);
  const list = screen.getByRole("listbox");
  const names = within(list)
    .getAllByRole("option")
    .map((o) => o.textContent ?? "");
  fireEvent.keyDown(list, { key: "Escape" });
  return names;
}
