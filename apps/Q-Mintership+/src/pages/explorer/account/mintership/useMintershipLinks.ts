/**
 * The reads behind Connections' "In Q-Mintership" (MintershipLinks.tsx),
 * all shared with other views and none polled: their nominations
 * (`nominations:for:<a>`), their MINTER history and the group's settings
 * (for the rounds), what they published (`xmade:<a>`), and, when they have
 * a nomination, the community votes on it (`communityvotes:nominee:<a>:0`).
 *
 * The Connections tab can call it too, to list "Q-Mintership records" under
 * "Also checked, nothing found" when `links` is an empty list.
 *
 * Nothing is read until `enabled` (the section near the screen). A read
 * that fails is retried by `retry`.
 */
import { loadNomineeVotes } from '../../../../data/communityVotes';
import { loadMadeBy } from '../../../../data/explorer/madeBy';
import { getGroupInfo } from '../../../../data/group';
import { loadNominationsFor } from '../../../../data/nominations';
import { getAddressHistory } from '../../../../data/txs';
import { useQuery } from '../../../../hooks/useQuery';
import { isOpenState } from '../../../../rules/nomination';
import { nominationRounds } from '../../../../rules/rounds';
import { mintershipLinks, type MintershipLink } from './links';

export interface MintershipLinksState {
  /** The links, once every read is in (an empty list: none); null while reading. */
  links: MintershipLink[] | null;
  /** A read failed: the links known are given, and the rest isn't claimed as checked. */
  failed: boolean;
  /** The first failed read's error. */
  error?: unknown;
  /** Reads the failed parts again. */
  retry: () => void;
}

export function useMintershipLinks(address: string, enabled = true): MintershipLinksState {
  const nominations = useQuery(enabled ? `nominations:for:${address}` : null, (force) =>
    loadNominationsFor(address, { force })
  );
  const history = useQuery(enabled ? `history:${address}` : null, (force) =>
    getAddressHistory(address, { force })
  );
  const group = useQuery(enabled ? 'group:info' : null, (force) => getGroupInfo({ force }));
  const made = useQuery(enabled ? `xmade:${address}` : null, (force) =>
    loadMadeBy(address, { force })
  );
  const rows = history.data?.rows;
  const maxDelay = group.data?.maximumBlockDelay;
  const open = nominations.data?.find((n) => isOpenState(n.state)) ?? null;
  const rounds =
    rows && maxDelay !== undefined
      ? nominationRounds(rows, address, maxDelay, open?.decision?.tx ?? null)
      : null;
  // Votes are on a nomination: there are none to read for someone never nominated.
  const nominated = Boolean(nominations.data?.length || rounds?.length);
  const votes = useQuery(
    enabled && nominated ? `communityvotes:nominee:${address}:0` : null,
    (force) => loadNomineeVotes(address, 0, { force })
  );
  const failedReads = [nominations, history, group, made, votes].filter((read) => read.isError);
  const failed = failedReads.length > 0;
  const retry = () => {
    for (const read of failedReads) void read.refetch();
  };
  const waiting =
    !nominations.data || !rounds || !made.data || (nominated && !votes.data && !votes.isError);
  if (!enabled || (waiting && !failed)) return { links: null, failed: false, retry };
  return {
    links: mintershipLinks({
      address,
      nominations: nominations.data ?? [],
      rounds: rounds ?? [],
      made: made.data ?? null,
      votesOnThem: votes.data?.rows ?? [],
    }),
    failed,
    error: failedReads[0]?.error,
    retry,
  };
}
