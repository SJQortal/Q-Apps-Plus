import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { addTargetShift } from '../../../e2e/world.mjs';
import DecisionsPage from './DecisionsPage';
import { readSeenTarget, seenTargetKey } from './seenTarget';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();
const T = { timeout: 4000 };

/**
 * Decisions in the moving-target world (21 admin rows, 9 needed), with what
 * this device saw before: 23 rows and 10 needed (`seen`), or nothing.
 */
async function openShifted(options: { seen?: 'before' | 'unknown height' | null } = {}) {
  const rendered = await renderPage(<DecisionsPage />, {
    persona: 'admin',
    path: '/decisions?show=decisions',
    route: '/decisions',
    setup: (world) => {
      const shift = addTargetShift(world);
      if (options.seen)
        window.localStorage.setItem(
          seenTargetKey(),
          JSON.stringify(
            options.seen === 'before' ? shift.seenBefore : { ...shift.seenBefore, height: 0 }
          )
        );
    },
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
  return rendered;
}

describe('Decisions: the target changed since the last visit', () => {
  it('says from what to what, who was removed, and what now has enough approvals', async () => {
    await openShifted({ seen: 'before' });
    const banner = await screen.findByRole('heading', {
      name: 'The target changed from 10 to 9 approvals',
    });
    const alert = banner.closest('[role="region"]') as HTMLElement;
    expect(
      await within(alert).findByText(/because 2 Minter Admins were removed/, {}, T)
    ).toBeVisible();
    expect(within(alert).getAllByText(/Otto Outgoing|Orla Outgoing/)).toHaveLength(2);
    expect(alert).toHaveTextContent('The target is 40% of admins, recounted every block.');
    expect(alert).toHaveTextContent(
      'This decision now has enough approvals because of it, so Core applies it without a new approval:'
    );
    const link = within(alert).getByRole('link', {
      name: 'Remove from MINTER: Kai Target, 9 of 9',
    });
    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/decisions\/[1-9A-HJ-NP-Za-km-z]+$/)
    );
    // It applies in the next block: too late for a withdrawal to count, so no advice to withdraw.
    expect(alert).toHaveTextContent(
      /9 of 9Applies in the next block; a withdrawal now would arrive too late to count\./
    );
    expect(alert).not.toHaveTextContent(/withdraw your signature/);
    // What this device saw is now the new target.
    expect(readSeenTarget()).toMatchObject({ adminCount: 21, needed: 9 });
  });

  it('goes away with Got it, and focus stays on the page', async () => {
    const u = user();
    await openShifted({ seen: 'before' });
    await screen.findByRole('heading', { name: 'The target changed from 10 to 9 approvals' });
    screen.getByRole('button', { name: 'Got it' }).focus();
    await u.keyboard('{Enter}');
    expect(screen.queryByText('The target changed from 10 to 9 approvals')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Decisions' })).toHaveFocus();
  });

  it('is a region with its own heading, read out once by the page, not a live region', async () => {
    await openShifted({ seen: 'before' });
    const note = await screen.findByRole('region', {
      name: 'The target changed from 10 to 9 approvals',
    });
    expect(
      within(note).getByRole('heading', {
        level: 2,
        name: 'The target changed from 10 to 9 approvals',
      })
    ).toBeVisible();
    // It fills in as its reasons load: a live region would be read again each time.
    await within(note).findByText(/because 2 Minter Admins were removed/, {}, T);
    expect(note.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    expect(note.querySelector('[role="status"], [role="alert"], [aria-live]')).toBeNull();
    // The page's own status line, there from the start, says the title once.
    const said = screen
      .getAllByRole('status')
      .filter((s) => s.textContent === 'The target changed from 10 to 9 approvals');
    expect(said).toHaveLength(1);
  });

  it('says nothing on the first visit', async () => {
    await openShifted();
    expect(screen.queryByText(/^The target changed/)).toBeNull();
    expect(readSeenTarget()).toMatchObject({ adminCount: 21, needed: 9 });
  });

  it('says so after a refresh that brings a new target', async () => {
    const u = user();
    const { world } = await openShifted();
    expect(screen.queryByText(/^The target changed/)).toBeNull();
    // The status region is there, empty, before anything changes.
    expect(screen.getAllByRole('status').some((el) => el.textContent === '')).toBe(true);
    // Admin Q's row goes: 20 admin seats, 8 needed. Mia Met's invite has 8.
    world.admins.splice(world.admins.length - 2, 1);
    await u.click(screen.getByRole('button', { name: 'Refresh' }));
    const banner = await screen.findByRole(
      'heading',
      { name: 'The target changed from 9 to 8 approvals' },
      T
    );
    const alert = banner.closest('[role="region"]') as HTMLElement;
    expect(
      within(alert).getByRole('link', { name: 'Add to MINTER: Mia Met, 8 of 8' })
    ).toBeVisible();
    expect(readSeenTarget()).toMatchObject({ adminCount: 20, needed: 8 });
  });

  it('keeps to the count when the change is too long ago to read', async () => {
    await openShifted({ seen: 'unknown height' });
    const banner = await screen.findByRole('heading', {
      name: 'The target changed from 10 to 9 approvals',
    });
    expect(banner.closest('[role="region"]')).toHaveTextContent(
      'It changed because MINTER has 2 fewer admin seats (21; it had 23).'
    );
  });
});
