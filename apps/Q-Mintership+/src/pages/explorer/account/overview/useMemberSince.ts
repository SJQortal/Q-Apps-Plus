/**
 * When an account's current MINTER membership began, the way its Minter
 * Profile works it out (MintershipTab's story): its MINTER timeline from
 * its history, then `memberSince`. The same reads and keys as the Minter
 * Profile (`history:<a>`, which its status already loaded, plus the chain's
 * block time and MINTER's settings), none of them polled here. Null while
 * loading, for a non-member, or when the membership began before the
 * history in hand.
 */
import { useMemo } from 'react';
import { getChainNow } from '../../../../data/chain';
import { getGroupInfo } from '../../../../data/group';
import { buildTimeline, memberSince, withOwnSubject } from '../../../../data/timeline';
import { getAddressHistory } from '../../../../data/txs';
import { useQuery } from '../../../../hooks/useQuery';

/** MINTER's longest approval window when its settings haven't loaded (as on the Minter Profile). */
const DEFAULT_MAX_BLOCK_DELAY = 10_080;

export function useMemberSince(address: string, isMember: boolean): number | null {
  const history = useQuery(isMember ? `history:${address}` : null, (force) =>
    getAddressHistory(address, { force })
  );
  const chain = useQuery(isMember ? 'chain:now' : null, (force) => getChainNow({ force }));
  const group = useQuery(isMember ? 'group:info' : null, (force) => getGroupInfo({ force }));
  const rows = history.data?.rows;
  const msPerBlock = chain.data?.msPerBlock;
  const maximumBlockDelay = group.data?.maximumBlockDelay ?? DEFAULT_MAX_BLOCK_DELAY;
  return useMemo(() => {
    if (!isMember || !rows || !msPerBlock) return null;
    const events = buildTimeline(withOwnSubject(rows, address), { msPerBlock, maximumBlockDelay });
    return memberSince(events, address);
  }, [isMember, rows, msPerBlock, maximumBlockDelay, address]);
}
