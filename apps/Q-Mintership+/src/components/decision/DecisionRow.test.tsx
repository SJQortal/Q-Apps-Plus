import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderPage } from '../../test/render';
import { useDecisions } from '../../hooks/useData';
import { useSession } from '../../state/session';
import { DecisionRow } from './DecisionRow';

afterEach(() => vi.useRealTimers());

function Rows() {
  const session = useSession();
  const { data } = useDecisions();
  if (!data) return null;
  return (
    <>
      {data.decisions.map((d) => (
        <DecisionRow
          key={d.signature}
          decision={d}
          now={data.now}
          myPublicKey={session.publicKey}
        />
      ))}
    </>
  );
}

describe('DecisionRow', () => {
  it('links to the decision with k of n, the time left to approve and your signature', async () => {
    await renderPage(<Rows />, { persona: 'admin', path: '/' });
    // The link is named by its visible text, plus the ring's k of n in hidden words.
    const urgent = await screen.findByRole('link', {
      name: /^Add to MINTER: Uma Urgent\. 7 of 8 approvals\. \d+h \d+m left to approve You approved ✓$/,
    });
    expect(urgent.getAttribute('href')).toMatch(/^\/decisions\/\w+$/);
    expect(within(urgent).getByText('You approved ✓')).toBeInTheDocument();
    const open = await screen.findByRole('link', {
      name: /^Add to MINTER: bob\+builder\. 5 of 8 approvals\. \d+d \d+h left to approve$/,
    });
    expect(within(open).getByText('left to approve')).toBeInTheDocument();
    expect(within(open).queryByRole('img')).toBeNull();
    // A cancelled invite names its invitee (read from the raw bytes).
    expect(
      screen.getByRole('link', { name: /^Cancel an approved invite: QgFT6i…1cnG\./ })
    ).toBeInTheDocument();
  });
});
