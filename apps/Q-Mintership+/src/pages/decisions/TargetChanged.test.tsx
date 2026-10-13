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
    path: '/decisions',
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
  it('says from what to what, who was removed, and what now has enough signatures', async () => {
    await openShifted({ seen: 'before' });
    const banner = await screen.findByText('The target changed from 10 to 9 signatures');
    const alert = banner.closest('[role="status"]') as HTMLElement;
    expect(
      await within(alert).findByText(/because 2 Minter Admins were removed/, {}, T)
    ).toBeVisible();
    expect(within(alert).getAllByText(/Otto Outgoing|Orla Outgoing/)).toHaveLength(2);
    expect(alert).toHaveTextContent('The target is 40% of admins, recounted every block.');
    expect(alert).toHaveTextContent(
      'This decision now has enough signatures because of it, so Core applies it without a new signature:'
    );
    const link = within(alert).getByRole('link', {
      name: 'Remove from MINTER: Kai Target, 9 of 9',
    });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^\/decisions\?d=/));
    expect(alert).toHaveTextContent(/9 of 9Applies in the next block\./);
    expect(alert).toHaveTextContent(/withdraw your signature before Core applies it/);
    // What this device saw is now the new target.
    expect(readSeenTarget()).toMatchObject({ adminCount: 21, needed: 9 });
  });

  it('goes away with Got it', async () => {
    const u = user();
    await openShifted({ seen: 'before' });
    await screen.findByText('The target changed from 10 to 9 signatures');
    await u.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText('The target changed from 10 to 9 signatures')).toBeNull();
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
    // Admin Q's row goes: 20 admin seats, 8 needed. Mia Met's invite has 8.
    world.admins.splice(world.admins.length - 2, 1);
    await u.click(screen.getByRole('button', { name: 'Refresh' }));
    const banner = await screen.findByText('The target changed from 9 to 8 signatures', {}, T);
    const alert = banner.closest('[role="status"]') as HTMLElement;
    expect(
      within(alert).getByRole('link', { name: 'Add to MINTER: Mia Met, 8 of 8' })
    ).toBeVisible();
    expect(readSeenTarget()).toMatchObject({ adminCount: 20, needed: 8 });
  });

  it('keeps to the count when the change is too long ago to read', async () => {
    await openShifted({ seen: 'unknown height' });
    const banner = await screen.findByText('The target changed from 10 to 9 signatures');
    expect(banner.closest('[role="status"]')).toHaveTextContent(
      'It changed because MINTER has 2 fewer admin seats (21; it had 23).'
    );
  });
});
