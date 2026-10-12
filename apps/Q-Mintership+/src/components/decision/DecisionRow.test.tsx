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
  it('links to the decision with k of n, the time left to sign and your signature', async () => {
    await renderPage(<Rows />, { persona: 'admin', path: '/' });
    const urgent = await screen.findByRole('link', {
      name: /Uma Urgent\. 7 of 8 signatures\. You signed\./,
    });
    expect(urgent.getAttribute('href')).toMatch(/^\/decisions\?d=/);
    expect(within(urgent).getByText('Signed ✓')).toBeInTheDocument();
    const open = await screen.findByRole('link', { name: /bob\+builder\. 5 of 8 signatures\.$/ });
    expect(within(open).getByText('left to sign')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: /Cancel an approved invite: an approved invite \(Core doesn’t say for whom\)/,
      })
    ).toBeInTheDocument();
  });
});
