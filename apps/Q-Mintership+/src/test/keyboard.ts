/**
 * Keyboard-only checks for the write dialogs, shared by the accessibility
 * tests: open a dialog from its button with Enter, and check that focus
 * goes into it, stays in it however far Tab and Shift+Tab go, that every
 * control in it has a name and axe finds nothing, and that Escape closes it
 * and puts focus back (on the button that opened it, or where `back` says).
 */
import { expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { expectNoAxeViolations } from './axe';

const T = { timeout: 4000 };

/** Press Enter on `opener` and return the dialog called `name`, with focus inside it. */
export async function openWithKeyboard(
  u: UserEvent,
  opener: HTMLElement,
  name: string | RegExp
): Promise<HTMLElement> {
  opener.focus();
  expect(opener).toHaveFocus();
  await u.keyboard('{Enter}');
  const dialog = await screen.findByRole('dialog', { name }, T);
  await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement), T);
  return dialog;
}

/** Tab and Shift+Tab around `dialog`: focus never leaves it, and it reaches `reach`. */
export async function expectFocusTrapped(
  u: UserEvent,
  dialog: HTMLElement,
  reach: string[] = []
): Promise<void> {
  const reached = new Set<string>();
  for (let i = 0; i < 8; i++) {
    await u.tab();
    const active = document.activeElement as HTMLElement;
    expect(dialog).toContainElement(active);
    reached.add(active.getAttribute('aria-label') ?? active.textContent?.trim() ?? '');
  }
  for (let i = 0; i < 2; i++) {
    await u.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  }
  for (const name of reach) expect([...reached]).toContain(name);
}

/** Every button and field in it has a name, and axe finds nothing. */
export async function expectNamedControls(dialog: HTMLElement): Promise<void> {
  for (const button of within(dialog).queryAllByRole('button'))
    expect(button).toHaveAccessibleName();
  for (const box of within(dialog).queryAllByRole('textbox')) expect(box).toHaveAccessibleName();
  for (const box of within(dialog).queryAllByRole('checkbox')) expect(box).toHaveAccessibleName();
  await expectNoAxeViolations(dialog);
}

/** Escape closes it; focus goes back to `back` (default: what had it before Enter). */
export async function closeWithEscape(u: UserEvent, back: () => HTMLElement | null): Promise<void> {
  await u.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);
  await waitFor(() => expect(back()).toHaveFocus(), T);
}

/** The whole round trip, for a dialog that opens from a button and closes with Escape. */
export async function checkDialogByKeyboard(
  u: UserEvent,
  opener: HTMLElement,
  name: string | RegExp,
  options: { reach?: string[]; back?: () => HTMLElement | null } = {}
): Promise<HTMLElement> {
  const dialog = await openWithKeyboard(u, opener, name);
  await expectNamedControls(dialog);
  await expectFocusTrapped(u, dialog, options.reach);
  await closeWithEscape(u, options.back ?? (() => opener));
  return dialog;
}
