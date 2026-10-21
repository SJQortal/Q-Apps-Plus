/**
 * Who a MINTER decision is about. Core's JSON leaves the invitee out of a
 * cancelled invite, so for those the transaction's raw bytes are read once
 * (key `txraw:<signature>`, kept for the session, shared with the
 * Decisions queue), only for a row on screen.
 */
import type { DecisionRef } from '../../../../data/explorer/answers';
import { getCancelInviteTarget } from '../../../../data/txs';
import { useQuery } from '../../../../hooks/useQuery';

export function useDecisionSubject(decision: DecisionRef): string | null {
  const missing = decision.kind === 'cancelInvite' && !decision.subject;
  const target = useQuery(missing ? `txraw:${decision.signature}` : null, () =>
    getCancelInviteTarget(decision.signature)
  );
  return decision.subject ?? target.data?.invitee ?? null;
}
