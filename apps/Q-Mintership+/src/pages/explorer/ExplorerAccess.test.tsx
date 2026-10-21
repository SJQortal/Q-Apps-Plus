/**
 * Who sees the Explorer's detailed parts (Simon, 2026-10-18: "only show them
 * to DEV + MA's and lvl5+ minters", and nothing saying it is hidden for anyone
 * else): Connections, Compare, the sets of accounts, the activity chart, the
 * QORT facts and exchanges named as such. The rule, the account page for each
 * kind of viewer (a Dev Admin outside MINTER too), links to the hidden pages,
 * the Quiz's questions and Settings.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { fetchCallsFor, qortalCalls } from '../../test/setup';
import { APP_NAME } from '../../constants/plus';
import { CHANGELOG } from '../../constants/changelog';
import { ADDR, installWorld } from '../../test/world';
import { explorerAccountPath, explorerComparePath, explorerSponseesPath } from '../../routes/paths';
import { fullExplorerAccess, fullExplorerByRole } from '../../rules/explorer/access';
import { resetExplorerAccess } from '../../state/explorerAccess';
import { resetExplorerState } from '../../state/explorer';
import { useDisplayName } from '../../hooks/useDisplayName';
import { useFullExplorer } from '../../hooks/useFullExplorer';
import { FullExplorerOnly } from '../../routes/FullExplorerOnly';
import {
  makeQuestion,
  QUIZ_TEMPLATES,
  type QuizTemplate,
} from '../../data/explorer/quiz/generators';
import { shortAddress } from '../../utils/format';
import SettingsPage from '../settings/SettingsPage';
import { ChangelogDialog } from '../../components/Settings/ChangelogDialog';
import AccountPage from './AccountPage';

const T = { timeout: 4000 };
const ROUTE = '/explorer/account/:who/:tab?';
const TRADEOGRE = 'QcZPChiGmwLu3Lrp2mfLSjZ3yHKmtrogRe';

beforeEach(() => {
  resetExplorerState();
  resetExplorerAccess();
});
afterEach(() => vi.useRealTimers());

function Where() {
  const location = useLocation();
  return <output data-testid="at">{location.pathname}</output>;
}
const at = () => screen.getByTestId('at').textContent;

describe('the rule', () => {
  it('Minter Admins, MINTER members at level 5 or above, and Dev Admins', () => {
    expect(fullExplorerByRole({ isAdmin: true, isMember: true, level: 1 })).toBe(true);
    expect(fullExplorerByRole({ isAdmin: false, isMember: true, level: 5 })).toBe(true);
    expect(fullExplorerByRole({ isAdmin: false, isMember: true, level: 4 })).toBe(false);
    // Level 5 outside MINTER (a former member keeps their level) isn't enough.
    expect(fullExplorerByRole({ isAdmin: false, isMember: false, level: 7 })).toBe(false);
    expect(fullExplorerAccess({ isAdmin: false, isMember: false, level: 0 }, true)).toBe(true);
    expect(fullExplorerAccess({ isAdmin: false, isMember: false, level: 0 }, false)).toBe(false);
  });
});

async function account(persona: string, tab?: 'connections', setup?: RenderPageOptions['setup']) {
  const rendered = await renderPage(
    <>
      <AccountPage />
      <Where />
    </>,
    { persona, path: explorerAccountPath(ADDR.kicked, tab), route: ROUTE, setup }
  );
  await screen.findByRole('tablist', { name: 'Account sections' }, T);
  return rendered;
}
const tabNames = () =>
  within(screen.getByRole('tablist', { name: 'Account sections' }))
    .getAllByRole('tab')
    .map((t) => t.textContent);

describe('an account, for a viewer who doesn’t see the detailed parts', () => {
  it('has no Connections tab, no Compare, and an Overview without its direct links, chart or QORT facts, read for none of them', async () => {
    await account('learner');
    // The status is read first, then nothing about the detailed parts.
    await screen.findByRole('region', { name: 'At a glance' }, T);
    expect(tabNames()).toEqual(['Overview', 'Transactions', 'Assets', 'Minter Profile', 'Names']);
    expect(screen.queryByRole('button', { name: /Compare/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Direct links' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
    const glance = screen.getByRole('region', { name: 'At a glance' });
    expect(within(glance).getByText('Blocks minted')).toBeInTheDocument();
    expect(glance).not.toHaveTextContent(/QORT minted|purchased|received \/ sent/);
    // Nothing about them anywhere on the page, nor that anything is left out.
    expect(document.body).not.toHaveTextContent(
      /Connections|connections|Activity below|hidden for/
    );
    await new Promise((r) => setTimeout(r, 300));
    for (const read of [
      '/transactions/payments/between',
      '/crosschain/trades',
      '/addresses/sponsorship',
    ])
      expect(fetchCallsFor(read)).toEqual([]);
    expect(qortalCalls.filter((c) => c.action !== 'GET_USER_ACCOUNT')).toEqual([]);
  });

  it('a link to Connections opens the Overview, in place', async () => {
    await account('learner', 'connections');
    await waitFor(() => expect(at()).toBe(explorerAccountPath(ADDR.kicked, 'overview')), T);
    expect(await screen.findByRole('tabpanel', { name: 'Overview' }, T)).toBeVisible();
    expect(fetchCallsFor('/transactions/payments/between')).toEqual([]);
  });

  it('signed out: the same', async () => {
    await account('signedOut');
    await screen.findByRole('region', { name: 'At a glance' }, T);
    expect(tabNames()).not.toContain('Connections');
  });
});

describe('an account, for a viewer who sees them', () => {
  it('a level 5+ member has every tab, Compare, and the Overview in full', async () => {
    await account('nominator');
    await waitFor(() =>
      expect(tabNames()).toEqual([
        'Overview',
        'Connections',
        'Transactions',
        'Assets',
        'Minter Profile',
        'Names',
      ])
    );
    expect(
      screen.getByRole('button', { name: 'Compare Kit Kicked with another account' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Kit Kicked to compare' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Direct links' }, T)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Activity' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'At a glance' })).getByText('QORT minted')
    ).toBeInTheDocument();
  });

  it('a Dev Admin outside MINTER does too', async () => {
    await account('newcomerName', undefined, (world) => {
      world.devAdmins.push(ADDR.newcomerName);
    });
    await waitFor(() => expect(tabNames()).toContain('Connections'), T);
    expect(fetchCallsFor('/groups/members/1')).toHaveLength(1);
  });

  it('a Minter Admin opens Connections from a link', async () => {
    await account('admin', 'connections');
    expect(await screen.findByRole('tabpanel', { name: 'Connections' }, T)).toBeVisible();
    expect(at()).toBe(explorerAccountPath(ADDR.kicked, 'connections'));
  });
});

describe('Compare and the sets of accounts, by a link', () => {
  const page = (persona: string, path: string, route: string) =>
    renderPage(
      <FullExplorerOnly>
        <h1>The hidden page</h1>
      </FullExplorerOnly>,
      { persona, path, route }
    );

  it('open for a viewer who sees them', async () => {
    await page('nominator', explorerComparePath([ADDR.kicked, ADDR.left]), '/explorer/compare/*');
    expect(await screen.findByRole('heading', { name: 'The hidden page' }, T)).toBeVisible();
  });

  it('go on to the account they were about for anyone else', async () => {
    await page('learner', explorerComparePath([ADDR.kicked, ADDR.left]), '/explorer/compare/*');
    expect(await screen.findByTestId('navigated-away', {}, T)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'The hidden page' })).toBeNull();
  });

  it('a set too', async () => {
    await page('learner', explorerSponseesPath(ADDR.kicked), '/explorer/sponsees/:address');
    expect(await screen.findByTestId('navigated-away', {}, T)).toBeInTheDocument();
  });
});

describe('exchanges named as such', () => {
  function Label() {
    useFullExplorer();
    return <p>{useDisplayName(TRADEOGRE).label}</p>;
  }

  it('for a viewer who sees the detailed parts', async () => {
    await renderPage(<Label />, { persona: 'admin' });
    expect(await screen.findByText('TradeOgre', {}, T)).toBeInTheDocument();
  });

  it('a plain address for anyone else', async () => {
    await renderPage(<Label />, { persona: 'learner' });
    expect(await screen.findByText(shortAddress(TRADEOGRE), {}, T)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByText('TradeOgre')).toBeNull();
  });
});

describe('the Explorer Quiz', () => {
  it('asks what is found only in Connections only of viewers who see it', async () => {
    installWorld('learner');
    // Connections's totals; the rest say where everyone can look (generators.test.ts).
    expect(
      QUIZ_TEMPLATES.filter((t) => t.full)
        .map((t) => t.id)
        .sort()
    ).toEqual(['sponseesCount', 'topPayee']);
    // Every question that can only be answered in Connections is one of them.
    const fake = (id: string, full: boolean): QuizTemplate => ({
      id,
      level: 'easy',
      theme: 'blocks',
      ...(full ? { full: true as const } : {}),
      make: async () => ({
        key: id,
        parts: [{ kind: 'text', text: id }],
        answer: { kind: 'number', value: '1' },
        placeholder: '',
        hint: '',
        how: '',
        link: '/explorer',
        linkLabel: '',
      }),
    });
    const templates = [fake('detailed', true), fake('basic', false)];
    for (let i = 0; i < 5; i++)
      expect((await makeQuestion({ templates, level: 'easy', full: false }))?.template).toBe(
        'basic'
      );
    const both = new Set<string>();
    for (let i = 0; i < 20; i++)
      both.add((await makeQuestion({ templates, level: 'easy', full: true }))?.template ?? '');
    expect(both).toEqual(new Set(['detailed', 'basic']));
  });

  it('sends a viewer without Connections to a Transactions tab that says it', async () => {
    // Where a sponsor is found: Leo Learner's reward shares, oldest first.
    await renderPage(<AccountPage />, {
      persona: 'learner',
      path: `${explorerAccountPath(ADDR.learner, 'transactions')}?kind=minting&type=REWARD_SHARE&order=oldest`,
      route: ROUTE,
    });
    const panel = await screen.findByRole('tabpanel', { name: 'Transactions' }, T);
    const rows = await within(panel).findAllByText(
      /started a reward share with this account/,
      {},
      T
    );
    await waitFor(() => expect(rows[0].closest('li')).toHaveTextContent('Sid Sponsor'), T);
    expect(panel).toHaveTextContent('removed its reward share with this account');
    expect(screen.queryByRole('tab', { name: 'Connections' })).toBeNull();
  });

  it('… and to the minting level moves, where it got its level from', async () => {
    await renderPage(<AccountPage />, {
      persona: 'learner',
      path: `${explorerAccountPath(ADDR.kickTarget, 'transactions')}?kind=minting&type=TRANSFER_PRIVS`,
      route: ROUTE,
    });
    const panel = await screen.findByRole('tabpanel', { name: 'Transactions' }, T);
    expect(await within(panel).findByText(/Got its minting level from/, {}, T)).toBeVisible();
    await waitFor(() => expect(panel).toHaveTextContent('Olga Old'), T);
  });
});

describe('Settings', () => {
  it('offers the activity chart’s settings only to a viewer who sees it', async () => {
    const learner = await renderPage(<SettingsPage />, { persona: 'learner' });
    await screen.findByRole('heading', { level: 1, name: 'Settings' }, T);
    await screen.findByText('Recent explorations', {}, T);
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole('button', { name: 'Change Activity settings' })).toBeNull();
    learner.unmount();
    await renderPage(<SettingsPage />, { persona: 'nominator' });
    expect(
      await screen.findByRole('button', { name: 'Change Activity settings' }, T)
    ).toBeInTheDocument();
  });
});

describe('the changelog', () => {
  const SECTION = 'Explorer, for Minter Admins, Dev Admins and level 5+ minters';

  it('writes the detailed parts up only for viewers who see them', async () => {
    const learner = await renderPage(<ChangelogDialog open onClose={() => undefined} />, {
      persona: 'learner',
    });
    const dialog = await screen.findByRole('dialog', {}, T);
    // The release that brought the Explorer's detailed parts (only the newest starts open).
    const index = CHANGELOG.findIndex((r) => r.sections.some((section) => section.full));
    const showFirst = async (inside: HTMLElement) => {
      const release = await within(inside).findByLabelText(
        `${APP_NAME} ${CHANGELOG[index].version}`,
        {},
        T
      );
      if (index > 0)
        await userEvent.click(within(release).getByRole('button', { name: 'Show all changes' }));
      return release;
    };
    const release = await showFirst(dialog);
    await within(release).findByText('For everyone', {}, T);
    await new Promise((r) => setTimeout(r, 200));
    expect(within(release).queryByText(SECTION)).toBeNull();
    expect(dialog).not.toHaveTextContent(/Connections|Compare|QORT minted/);
    learner.unmount();
    await renderPage(<ChangelogDialog open onClose={() => undefined} />, { persona: 'admin' });
    const adminRelease = await showFirst(await screen.findByRole('dialog', {}, T));
    expect(await within(adminRelease).findByText(SECTION, {}, T)).toBeInTheDocument();
  });
});
