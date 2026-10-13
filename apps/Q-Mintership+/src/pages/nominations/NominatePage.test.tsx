import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR, TIP } from '../../test/world';
import NominatePage from './NominatePage';

afterEach(() => vi.useRealTimers());

const open = (persona: string, who?: string) =>
  renderPage(<NominatePage />, {
    persona,
    path: who === undefined ? '/nominate' : `/nominate?who=${encodeURIComponent(who)}`,
    route: '/nominate',
  });

const who = () => screen.findByRole('region', { name: 'Who' }, { timeout: 4000 });

function decode(data64: unknown): Record<string, unknown> {
  const bytes = Uint8Array.from(atob(String(data64)), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

const REASON = 'Runs a reliable node and answers questions in the minting chat every week.';

describe('Nominate page: who may nominate', () => {
  it('tells a level 2 member why not, with the blocks to go, and shows no form', async () => {
    await open('learner');
    expect(
      await screen.findByText(/Members can nominate from level 5\. You're level 2\./, undefined, {
        timeout: 4000,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/527,900 more take you to level 5/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Why should they mint/ })).toBeNull();
  });

  it('asks a signed-out visitor to sign in', async () => {
    await open('signedOut');
    expect(await screen.findByText('Sign in to nominate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('gives a level 5+ member the form, with the live numbers of what happens next', async () => {
    await open('nominator');
    await who();
    expect(screen.getByRole('combobox', { name: 'Name or Qortal address' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Why should they mint/ })).toBeInTheDocument();
    const next = screen.getByRole('region', { name: 'What happens next' });
    // 10,080 blocks at 72.9 s, and PCT40 of 20 admins.
    expect(
      await within(next).findByText(/about 8\.5 days to collect signatures/)
    ).toBeInTheDocument();
    expect(await within(next).findByText(/It needs 8 signatures right now/)).toBeInTheDocument();
    expect(within(next).getByText(/Nothing else is sent or spent/)).toBeInTheDocument();
  });
});

describe('Nominate page: picking the candidate', () => {
  it('finds a name as you type and shows their profile line once picked', async () => {
    const user = userEvent.setup();
    await open('nominator');
    await who();
    mockFetchRoute('/names/search', (url: URL) =>
      url.searchParams.get('query')?.toLowerCase().startsWith('zo')
        ? [{ name: 'Zoë Newcomer', owner: ADDR.newcomerName }]
        : []
    );
    await user.type(screen.getByRole('combobox', { name: 'Name or Qortal address' }), 'Zo');
    await user.click(
      await screen.findByRole('option', { name: /Zoë Newcomer/ }, { timeout: 3000 })
    );
    const region = await who();
    expect(
      await within(region).findByText(/Level 0 · 0 blocks minted · Not in MINTER/)
    ).toBeInTheDocument();
    expect(within(region).getByText(/Can be nominated/)).toBeInTheDocument();
    const [call] = fetchCallsFor('/names/search');
    expect(call).toContain('prefix=true');
    expect(call).toContain('limit=10');
  });

  it('picks a pasted address straight away', async () => {
    const user = userEvent.setup();
    await open('nominator');
    await who();
    await user.click(screen.getByRole('combobox', { name: 'Name or Qortal address' }));
    await user.paste(ADDR.newcomer);
    const region = await who();
    expect(await within(region).findByText(/Level 0 · 0 blocks minted/)).toBeInTheDocument();
    expect(within(region).getByText(ADDR.newcomer)).toBeInTheDocument();
  });

  it('looks up a typed name exactly, and says so when it isn’t registered', async () => {
    const user = userEvent.setup();
    await open('admin');
    await who();
    mockFetchRoute('/names/search', () => []);
    const input = screen.getByRole('combobox', { name: 'Name or Qortal address' });
    await user.type(input, 'Nobody Here');
    await user.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByText(/No registered name “Nobody Here”/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Wren Waiting{Enter}');
    expect(
      await screen.findByText(/Already nominated\. You can add your support/, undefined, {
        timeout: 4000,
      })
    ).toBeInTheDocument();
  });

  it('says when the link held no valid address', async () => {
    await open('nominator', 'not-an-address');
    expect(await screen.findByText(/didn’t hold a valid Qortal address/)).toBeInTheDocument();
  });
});

describe('Nominate page: guards before anything is written', () => {
  const cases: Array<[string, string, RegExp]> = [
    // Only members can nominate: no advice to go and get nominated.
    ['nominator', 'nominator', /^That's your own account: you can't nominate yourself\.$/],
    ['nominator', 'learner', /Already in MINTER/],
    ['nominator', 'banned', /Banned from MINTER: Minter Admins must lift the ban/],
    ['nominator', 'nominatedSigning', /Minter Admins are already signing a nomination/],
    ['nominator', 'approved', /Already approved: they only need to press Join/],
    ['nominator', 'nominatedWaiting', /Already nominated\. You can add your support/],
  ];
  for (const [persona, subject, text] of cases) {
    it(`${subject}: ${text.source}`, async () => {
      await open(persona, ADDR[subject]);
      expect(await screen.findByText(text, undefined, { timeout: 4000 })).toBeInTheDocument();
      // The reason and the submit bar stay hidden: nothing to write here.
      expect(screen.queryByRole('textbox', { name: /Why should they mint/ })).toBeNull();
    });
  }

  it('tells the nominator they nominated this person already', async () => {
    await open('nominator', ADDR.nominatedWaiting);
    expect(
      await screen.findByText('You nominated them already.', undefined, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add your support' })).toBeNull();
  });

  it('offers Add your support to another eligible member, and opens it', async () => {
    const user = userEvent.setup();
    await open('admin', ADDR.nominatedWaiting);
    const button = await screen.findByRole(
      'button',
      { name: 'Add your support' },
      { timeout: 4000 }
    );
    await user.click(button);
    expect(await screen.findByRole('dialog', { name: 'Add your support' })).toBeInTheDocument();
  });

  it('offers the join link for an already approved person', async () => {
    await open('nominator', ADDR.approved);
    expect(
      await screen.findByText(`qortal://APP/Q-Mintership+/people/${ADDR.approved}`, undefined, {
        timeout: 4000,
      })
    ).toBeInTheDocument();
  });
});

describe('Nominate page: writing and publishing', () => {
  it('checks the reason and links before Hub sees anything', async () => {
    const user = userEvent.setup();
    await open('nominator', ADDR.newcomerName);
    await screen.findByText(/Can be nominated/, undefined, { timeout: 4000 });
    const reason = screen.getByRole('textbox', { name: /Why should they mint/ });
    await user.type(reason, 'Too short');
    expect(screen.getByText(/9 \/ 600 · at least 20 characters/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Nominate Zoë Newcomer/ }));
    expect(screen.getAllByText('Write at least 20 characters about why.').length).toBeGreaterThan(
      0
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.clear(reason);
    await user.type(reason, REASON);
    await user.click(screen.getByRole('button', { name: 'Add a link' }));
    await user.type(screen.getByRole('textbox', { name: 'Link 1' }), 'https://example.com');
    expect(
      screen.getByText(/Start with qortal:\/\/\. Web links can’t open inside Qortal/)
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Nominate Zoë Newcomer/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove link 1' }));
    expect(screen.queryByRole('textbox', { name: 'Link 1' })).toBeNull();
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
  });

  it('allows at most five links', async () => {
    const user = userEvent.setup();
    await open('nominator', ADDR.newcomerName);
    await screen.findByText(/Can be nominated/, undefined, { timeout: 4000 });
    for (let i = 0; i < 5; i++)
      await user.click(screen.getByRole('button', { name: 'Add a link' }));
    expect(screen.getByRole('button', { name: 'Up to 5 links' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /Remove link/ })).toHaveLength(5);
  });

  it('publishes the nomination record through Hub and offers the link for the nominee', async () => {
    const user = userEvent.setup();
    await open('nominator', ADDR.newcomerName);
    await screen.findByText(/Can be nominated/, undefined, { timeout: 4000 });
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({
      type: 'ARBITRARY',
      signature: 'NominationSig',
      timestamp: Date.now(),
    }));
    await user.type(screen.getByRole('textbox', { name: /Why should they mint/ }), REASON);
    await user.click(screen.getByRole('button', { name: 'Add a link' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Link 1' }),
      'qortal://APP/Q-Tube/channel/Zoe'
    );
    expect(screen.getByText('Ready to publish.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Nominate Zoë Newcomer/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Publish your nomination' });
    expect(within(dialog).getByText(/You’re nominating/)).toBeInTheDocument();
    expect(within(dialog).getByText(/under your name, Nora Nominator, on QDN/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText('Nomination published', undefined, { timeout: 4000 })
    ).toBeInTheDocument();

    const calls = qortalCallsFor('PUBLISH_QDN_RESOURCE');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      action: 'PUBLISH_QDN_RESOURCE',
      name: 'Nora Nominator',
      service: 'JSON',
      identifier: `qmp-nomination-${ADDR.newcomerName}`,
    });
    const record = decode(calls[0].data64);
    expect(record).toMatchObject({
      v: 1,
      nomineeAddress: ADDR.newcomerName,
      nomineeName: 'Zoë Newcomer',
      reason: REASON,
      links: ['qortal://APP/Q-Tube/channel/Zoe'],
      createdHeight: TIP,
    });
    expect(typeof record.created).toBe('number');

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    // The page is hidden from the accessibility tree until the dialog has closed.
    expect(
      await screen.findByRole('heading', { name: 'Let Zoë Newcomer know' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(`qortal://APP/Q-Mintership+/people/${ADDR.newcomerName}`)
    ).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /Nomination of Zoë Newcomer/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('treats a decline in Hub as a cancel and keeps what was written', async () => {
    const user = userEvent.setup();
    await open('nominator', ADDR.newcomerName);
    await screen.findByText(/Can be nominated/, undefined, { timeout: 4000 });
    await user.type(screen.getByRole('textbox', { name: /Why should they mint/ }), REASON);
    await user.click(screen.getByRole('button', { name: /Nominate Zoë Newcomer/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish your nomination' });
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText(/Cancelled in Hub\. Nothing was sent\./, undefined, {
        timeout: 4000,
      })
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('textbox', { name: /Why should they mint/ })).toHaveValue(
      REASON
    );
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(1);
  });
});
