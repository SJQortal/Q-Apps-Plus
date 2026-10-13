/**
 * Home's "Since your last visit" against the mock MINTER world: what an
 * admin, a nominee and a nominator see after an earlier visit
 * (e2e/world.mjs → lastVisitSnapshots, nominatorLastVisit), "Mark as seen",
 * and that nothing shows (or is read) without an earlier visit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { STORAGE_PREFIX } from '../../constants/plus';
import { resetLastVisitSession } from '../../data/lastVisit';
import { sinceLastVisitAtom } from '../../state/notifications';
import { fetchCallsFor } from '../../test/setup';
import { renderPage } from '../../test/render';
import { ADDR, NOW, TIP } from '../../test/world';
import {
  addDoubles,
  addNominatorHistory,
  lastVisitSnapshots,
  lastVisitStorageKey,
  nominatorLastVisit,
} from '../../../e2e/world.mjs';
import type { World } from '../../../e2e/world.mjs';
import { base58Encode } from '../../qortal/base58';
import HomePage from './HomePage';

const T = { timeout: 4000 };
/** `GET /transactions/signature/{sig}` (not the `/raw` read a cancellation needs). */
const ONE_TX = /^\/transactions\/signature\/[^/?]+$/;

beforeEach(() => resetLastVisitSession());
afterEach(() => {
  vi.useRealTimers();
  getDefaultStore().set(sinceLastVisitAtom, true);
});

type Persona = 'admin' | 'nominatedSigning' | 'nominatedWaiting';

/** Seed the earlier visit the mock world describes for `persona`. */
function seed(persona: Persona) {
  return (world: World) => {
    const { address, snapshot } = lastVisitSnapshots(world)[persona];
    window.localStorage.setItem(lastVisitStorageKey(address), JSON.stringify(snapshot));
  };
}

/** Seed a nominee's earlier visit by hand. */
function seedNomination(address: string, nomination: unknown, at = 1_791_400_000_000) {
  window.localStorage.setItem(
    lastVisitStorageKey(address),
    JSON.stringify({ v: 1, at, height: 2_751_000, nomination })
  );
}

const panel = () => screen.findByRole('region', { name: 'Since your last visit' }, T);

describe('Since your last visit: Minter Admins', () => {
  it('lists new decisions, a new nomination and the decided ones', async () => {
    await renderPage(<HomePage />, { persona: 'admin', setup: seed('admin') });
    const region = await panel();
    expect(within(region).getByText(/Your last visit on this device was 5 days ago/)).toBeVisible();

    // Seven new decisions (Avery's own proposal is left out), in one row: the
    // list under the hero already shows the urgent ones.
    const row = (await within(region).findByText('7 new decisions', {}, T)).closest('li');
    expect(row).toHaveTextContent(
      'Ban from MINTER: Ben Target; Add to MINTER: bob+builder, and 5 more. 5 are waiting for your signature.'
    );
    expect(within(region).getByRole('link', { name: 'Review the new decisions' })).toHaveAttribute(
      'href',
      '/decisions'
    );
    expect(within(region).queryByText(/Eli Early/)).toBeNull();

    // Wren Waiting was nominated since, and waits for a first signature.
    expect(await within(region).findByText('New nomination: Wren Waiting', {}, T)).toBeVisible();
    expect(
      within(region).getByRole('link', { name: 'Review the nomination of Wren Waiting' })
    ).toBeInTheDocument();

    // Decided since (one approved, two expired): read once each.
    expect(
      await within(region).findByText('Expired without enough signatures in block 2,752,581', {}, T)
    ).toBeVisible();
    expect(within(region).getByText('Approved in block 2,752,300')).toBeVisible();
    expect(within(region).getByRole('link', { name: 'Remy Recent' })).toBeInTheDocument();
    expect(
      within(region).getByText('Expired without enough signatures in block 2,752,048')
    ).toBeVisible();
    expect(fetchCallsFor(ONE_TX)).toHaveLength(3);

    // One polite sentence, once it has settled (other status regions on Home,
    // such as each card's "Link copied", stay empty).
    const summary = 'Since your last visit: 7 new decisions, 1 new nomination, 3 decided.';
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('status', { name: '' }).filter((el) => el.textContent === summary)
        ).toHaveLength(1),
      T
    );
  });

  it('goes away on "Mark as seen" and keeps focus on the page', async () => {
    const u = userEvent.setup();
    await renderPage(<HomePage />, { persona: 'admin', setup: seed('admin') });
    const region = await panel();
    await within(region).findByText('7 new decisions', {}, T);
    await u.click(within(region).getByRole('button', { name: 'Mark as seen' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Since your last visit' })).toBeNull()
    );
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }));
    // The new baseline is saved: the next visit compares with now.
    const saved = JSON.parse(window.localStorage.getItem(lastVisitStorageKey(ADDR.admin)) ?? '{}');
    expect(saved.decisions.length).toBeGreaterThan(5);
  });

  it('shows nothing, and reads nothing extra, on a first visit', async () => {
    await renderPage(<HomePage />, { persona: 'admin' });
    await screen.findByRole('region', { name: 'Waiting for your signature' }, T);
    await screen.findAllByRole('link', { name: /signatures/ }, T);
    expect(screen.queryByRole('region', { name: 'Since your last visit' })).toBeNull();
    expect(fetchCallsFor(ONE_TX)).toHaveLength(0);
  });

  it('can be switched off in Settings', async () => {
    getDefaultStore().set(sinceLastVisitAtom, false);
    await renderPage(<HomePage />, { persona: 'admin', setup: seed('admin') });
    await screen.findByRole('region', { name: 'Waiting for your signature' }, T);
    await screen.findAllByRole('link', { name: /signatures/ }, T);
    expect(screen.queryByRole('region', { name: 'Since your last visit' })).toBeNull();
    expect(fetchCallsFor(ONE_TX)).toHaveLength(0);
  });

  it('opens a single new decision directly, and counts several new nominations', async () => {
    await renderPage(<HomePage />, {
      persona: 'admin',
      setup: (world) => {
        // Everything but the kick was there at the last visit, three days ago.
        const decisions = world.pending
          .filter((t: { groupId?: number; member?: string }) => t.member !== ADDR.kickTarget)
          .map((t: { signature: string }) => ({
            signature: t.signature,
            kind: 'invite',
            subject: null,
            height: null,
          }));
        window.localStorage.setItem(
          lastVisitStorageKey(ADDR.admin),
          JSON.stringify({ v: 1, at: NOW - 3 * 86_400_000, height: TIP - 3_556, decisions })
        );
        // A second nomination published since, by an eligible nominator.
        world.records.push({
          name: 'Nora Nominator',
          identifier: `qmp-nomination-${ADDR.newcomerName}`,
          created: NOW - 3_600_000,
          body: {
            v: 1,
            nomineeAddress: ADDR.newcomerName,
            reason: 'Runs a reliable node and helps in the minting chat every week.',
            links: [],
          },
        });
      },
    });
    const region = await panel();
    const open = await within(region).findByRole(
      'link',
      { name: 'Open: Remove from MINTER: Kai Target' },
      T
    );
    expect(open.closest('li')).toHaveTextContent(
      'New · 2 of 8 signatures · waiting for your signature'
    );
    const nominations = (await within(region).findByText('2 new nominations', {}, T)).closest('li');
    expect(nominations).toHaveTextContent(
      'Zoë Newcomer, Wren Waiting · waiting for a first signature'
    );
    expect(
      within(region).getByRole('link', { name: 'Review the new nominations' })
    ).toBeInTheDocument();
  });
});

describe('Since your last visit: doubles', () => {
  it('never says a new double is waiting for your signature', async () => {
    let doubles = {} as ReturnType<typeof addDoubles>;
    await renderPage(<HomePage />, {
      persona: 'admin',
      setup: (world) => {
        doubles = addDoubles(world);
        // Everything but the removal of Nora Nominator was there at the last visit.
        const decisions = world.pending
          .filter((t: { signature: string }) => t.signature !== doubles.notAdmin.signature)
          .map((t: { signature: string }) => ({
            signature: t.signature,
            kind: 'invite',
            subject: null,
            height: null,
          }));
        window.localStorage.setItem(
          lastVisitStorageKey(ADDR.admin),
          JSON.stringify({ v: 1, at: NOW - 3 * 86_400_000, height: TIP - 3_556, decisions })
        );
      },
    });
    const region = await panel();
    const open = await within(region).findByRole(
      'link',
      { name: 'Open: Remove a Minter Admin: Nora Nominator' },
      T
    );
    const row = open.closest('li') as HTMLElement;
    expect(row).toHaveTextContent(/New · 2 of \d+ signatures/);
    expect(row).not.toHaveTextContent('waiting for your signature');
  });

  it('leaves doubles out of the new decisions waiting for your signature', async () => {
    await renderPage(<HomePage />, {
      persona: 'admin',
      setup: (world) => {
        // Admin C's second proposal was there at the last visit; the other three are new.
        addDoubles(world);
        seed('admin')(world);
      },
    });
    const region = await panel();
    // Five as before, and the older of Member 9's two additions; not the two doubles.
    const row = (await within(region).findByText('10 new decisions', {}, T)).closest('li');
    expect(row).toHaveTextContent('and 8 more. 6 are waiting for your signature.');
  });
});

describe('Since your last visit: titles', () => {
  it('names a member’s own Minter Admin proposal as its card does, new or decided', async () => {
    await renderPage(<HomePage />, {
      persona: 'admin',
      setup: (world) => {
        // Pia Promote proposed herself since the last visit.
        const own = world.pending.find((t: { type: string }) => t.type === 'ADD_GROUP_ADMIN');
        // Nora Nominator's own proposal was waiting then, and has been approved since.
        const approved = {
          ...own,
          signature: base58Encode(new Uint8Array(64).fill(77)),
          blockHeight: TIP - 3_000,
          approvalStatus: 'APPROVED',
          approvalHeight: TIP - 200,
          creatorAddress: ADDR.nominator,
          member: ADDR.nominator,
        };
        world.decided.push(approved);
        const decisions = [
          ...world.pending
            .filter((t: { signature: string }) => t.signature !== own.signature)
            .map((t: { signature: string }) => ({
              signature: t.signature,
              kind: 'invite',
              subject: null,
              height: null,
            })),
          {
            signature: approved.signature,
            kind: 'addAdmin',
            subject: ADDR.nominator,
            height: TIP - 3_000,
          },
        ];
        window.localStorage.setItem(
          lastVisitStorageKey(ADDR.admin),
          JSON.stringify({ v: 1, at: NOW - 3 * 86_400_000, height: TIP - 3_556, decisions })
        );
      },
    });
    const region = await panel();
    expect(
      await within(region).findByRole(
        'link',
        { name: 'Open: Become a Minter Admin: Pia Promote' },
        T
      )
    ).toBeInTheDocument();
    const decided = (await within(region).findByText('Approved in block 2,757,300', {}, T)).closest(
      'li'
    ) as HTMLElement;
    expect(decided).toHaveTextContent(/^Become a Minter Admin: /);
    expect(decided).not.toHaveTextContent('Make a Minter Admin');
  });
});

describe('Since your last visit: nominees', () => {
  it('counts the new signatures on your nomination', async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: seed('nominatedSigning'),
    });
    const region = await panel();
    expect(within(region).getByText('2 new signatures')).toBeVisible();
    expect(within(region).getByText('Your nomination has 5 of 8 signatures now.')).toBeVisible();
    expect(within(region).getAllByRole('listitem')).toHaveLength(1);
  });

  it('says who nominated you when there was no nomination before', async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedWaiting',
      setup: seed('nominatedWaiting'),
    });
    const region = await panel();
    expect(within(region).getByText("You've been nominated")).toBeVisible();
    expect(within(region).getByRole('link', { name: 'Nora Nominator' })).toBeInTheDocument();
    // Juniper's support came with the nomination: not news on its own.
    expect(within(region).getAllByRole('listitem')).toHaveLength(1);
  });

  it('reports the first signature', async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => {
        const record = world.records.find(
          (r: { identifier: string }) => r.identifier === `qmp-nomination-${ADDR.nominatedSigning}`
        );
        seedNomination(ADDR.nominatedSigning, {
          decision: null,
          state: 'waiting',
          signed: 0,
          needed: null,
          supporters: 0,
          publishedAt: record.created,
        });
      },
    });
    const region = await panel();
    expect(within(region).getByText('A Minter Admin signed first')).toBeVisible();
    expect(
      within(region).getByText('The clock has started: 5 of 8 signatures so far.')
    ).toBeVisible();
  });

  it('reports an expired nomination with the count it had', async () => {
    await renderPage(<HomePage />, {
      persona: 'expired',
      setup: (world) => {
        const invite = world.decided.find((t: { invitee?: string }) => t.invitee === ADDR.expired);
        const record = world.records.find(
          (r: { identifier: string }) => r.identifier === `qmp-nomination-${ADDR.expired}`
        );
        seedNomination(ADDR.expired, {
          decision: invite.signature,
          state: 'signing',
          signed: 5,
          needed: 8,
          supporters: 0,
          publishedAt: record.created,
        });
      },
    });
    const region = await panel();
    expect(within(region).getByText('Your nomination expired')).toBeVisible();
    expect(
      within(region).getByText(
        'It had 5 of 8 signatures at your last visit. You can be nominated again.'
      )
    ).toBeVisible();
  });

  it('reports an approval from the history when no nomination record shows it', async () => {
    await renderPage(<HomePage />, {
      persona: 'approved',
      setup: (world) => {
        const invite = world.decided.find((t: { invitee?: string }) => t.invitee === ADDR.approved);
        seedNomination(ADDR.approved, {
          decision: invite.signature,
          state: 'signing',
          signed: 7,
          needed: 8,
          supporters: 0,
          publishedAt: invite.timestamp,
        });
      },
    });
    const region = await panel();
    expect(within(region).getByText('Your nomination was approved')).toBeVisible();
    expect(within(region).getByText('One step left: press Join now.')).toBeVisible();
  });

  it("says you're in when Home welcomes a new member", async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}last-status:${ADDR.learner}`, 'nominated');
    await renderPage(<HomePage />, { persona: 'learner' });
    const region = await panel();
    expect(within(region).getByText("You're in")).toBeVisible();
    expect(within(region).getByText('You’re a MINTER member now.')).toBeVisible();
  });
});

describe('Since your last visit: nominators', () => {
  /** Nora Nominator's earlier visit (e2e/world.mjs → nominatorLastVisit). */
  const seedNominator = (world: World) => {
    const { address, snapshot } = nominatorLastVisit(world);
    window.localStorage.setItem(lastVisitStorageKey(address), JSON.stringify(snapshot));
  };
  /** Home's own list of Nora's nominations, once it has loaded. */
  const homeLoaded = async () => {
    const mine = await screen.findByRole('region', { name: 'Your nominations' }, T);
    await within(mine).findAllByText(/Wren Waiting|bob\+builder|Uma Urgent/, {}, T);
  };

  it('says how the nominations you made ended, the good news first, each with a link', async () => {
    await renderPage(<HomePage />, {
      persona: 'nominator',
      setup: (world) => {
        addNominatorHistory(world);
        seedNominator(world);
      },
    });
    const region = await panel();
    const joined = (await within(region).findByText('Remy Recent joined MINTER', {}, T)).closest(
      'li'
    ) as HTMLElement;
    expect(joined).toHaveTextContent('Your nomination was approved.');
    expect(
      within(region).getByRole('link', { name: 'Open the nomination of Remy Recent' })
    ).toHaveAttribute('href', `/nominations/${ADDR.recentlyJoined}`);
    expect(within(region).getByText('Your nomination of Ünïcode Ñame expired')).toBeVisible();
    expect(
      within(region).getByText(
        'Your nomination of Lapsed Person With A Very Long Name That Wraps On Phones closed'
      )
    ).toBeVisible();
    // Uma Urgent's is still collecting signatures: not news.
    expect(within(region).queryByText(/Uma Urgent/)).toBeNull();
    expect(
      within(region)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual([
      expect.stringMatching(/^Remy Recent joined MINTER/),
      expect.stringMatching(/^Your nomination of Ünïcode Ñame expired/),
      expect.stringMatching(/^Your nomination of Lapsed Person/),
    ]);
    const summary =
      'Since your last visit: 1 nomination you made was approved, 2 nominations you made ran out.';
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('status', { name: '' }).filter((el) => el.textContent === summary)
        ).toHaveLength(1),
      T
    );
  });

  it('has nothing to compare from a visit saved before nominations were kept', async () => {
    await renderPage(<HomePage />, {
      persona: 'nominator',
      setup: (world) => {
        const { address, snapshot } = nominatorLastVisit(world);
        const older = { ...(snapshot as Record<string, unknown>) };
        delete older.made;
        window.localStorage.setItem(lastVisitStorageKey(address), JSON.stringify(older));
      },
    });
    await homeLoaded();
    expect(screen.queryByRole('region', { name: 'Since your last visit' })).toBeNull();
  });

  it('can be switched off in Settings', async () => {
    getDefaultStore().set(sinceLastVisitAtom, false);
    await renderPage(<HomePage />, { persona: 'nominator', setup: seedNominator });
    await homeLoaded();
    expect(screen.queryByRole('region', { name: 'Since your last visit' })).toBeNull();
  });
});
