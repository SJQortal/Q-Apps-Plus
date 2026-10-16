import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockFetchRoute } from '../../test/setup';
import { resetQueries } from '../../data/query';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../common/personLinks';
import { TxSentence } from './TxSentence';
import type { TxPart } from '../../rules/explorer/txWords';

const A = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';
const SIG =
  '4Kw5V2Zmh7mfV6KjPuX2ZXCK3HE2fsR6w5CWD75CdMa8Rfat1mXcf5rCiLpm8tm96FMPhCUBpMUaLpvUmitbqJbm';

const parts: TxPart[] = [
  { kind: 'text', text: 'Sent ' },
  { kind: 'amount', amount: '15', asset: 'QORT' },
  { kind: 'text', text: ' to ' },
  { kind: 'account', address: A },
  { kind: 'text', text: ' in ' },
  { kind: 'group', groupId: 31 },
  { kind: 'text', text: ' for ' },
  { kind: 'name', name: 'Minter Admin' },
  { kind: 'text', text: ', answering ' },
  { kind: 'tx', signature: SIG },
];

function renderSentence(plain = false) {
  resetQueries();
  mockFetchRoute('/names/primary/', { name: 'Bob', owner: A });
  mockFetchRoute('/groups/', { groupId: 31, groupName: 'alt coin investor' });
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <MemoryRouter>
        <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
          <p>
            <TxSentence parts={parts} plain={plain} />
          </p>
        </PersonLinkContext>
      </MemoryRouter>
    </HubThemeProvider>
  );
}

describe('TxSentence', () => {
  it('links people into the Explorer and the transaction to its page', async () => {
    renderSentence();
    expect(await screen.findByRole('link', { name: 'Bob: explore this account' })).toHaveAttribute(
      'href',
      `/explorer/account/${A}`
    );
    expect(screen.getByRole('link', { name: 'Open transaction 4Kw5V2Zm' })).toHaveAttribute(
      'href',
      `/explorer/tx/${SIG}`
    );
    expect(await screen.findByText('alt coin investor')).toBeInTheDocument();
    // A name that reads like a label stays an isolated, quoted name.
    expect(screen.getByText('Minter Admin').tagName).toBe('BDI');
    expect(screen.getByText('15 QORT').tagName).toBe('STRONG');
  });

  it('has no links in plain mode (inside a button)', async () => {
    renderSentence(true);
    expect(await screen.findByText('Bob')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});
