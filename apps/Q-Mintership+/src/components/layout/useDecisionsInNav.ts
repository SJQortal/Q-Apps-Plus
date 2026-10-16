/**
 * Whether Decisions is in the navigation: always for a Minter Admin, and for
 * everyone else while a proposal they may vote on is open (a removal that
 * isn't a declined join request, a ban, a new Minter Admin), from a light
 * read every 5 minutes, paused while the app is hidden
 * (data/decisions.ts → loadPublicProposalCount). Undefined until the status
 * (and, for anyone else, that read) is known.
 */
import { loadPublicProposalCount } from '../../data/decisions';
import { useMyStatus } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';

export const PUBLIC_PROPOSALS_REFRESH_MS = 5 * 60_000;

export function useDecisionsInNav(): boolean | undefined {
  const { status } = useMyStatus();
  const others = Boolean(status && !status.isAdmin);
  const open = useQuery(
    others ? 'decisions:public' : null,
    (force) => loadPublicProposalCount({ force }),
    { refreshMs: PUBLIC_PROPOSALS_REFRESH_MS }
  );
  if (!status) return undefined;
  if (status.isAdmin) return true;
  if (open.data !== undefined) return open.data > 0;
  // A failed read keeps the tab away; the page still opens from its links.
  return open.isError ? false : undefined;
}
