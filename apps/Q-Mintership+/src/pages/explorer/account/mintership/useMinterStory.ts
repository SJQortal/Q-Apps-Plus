/**
 * One account's MINTER story, from the same cached reads its person page
 * makes (same keys, none polled here): its status (`status:<a>`), its MINTER
 * history (`history:<a>`) as timeline events, the proposals it made, when it
 * joined, its nominations (`nominations:for:<a>`) and their rounds. A Minter
 * Admin's kicks of others also read each kicked person's history once
 * (`declinemarks:<a>`), as on the person page.
 */
import { useMemo } from 'react';
import { getChainNow } from '../../../../data/chain';
import { getGroupInfo } from '../../../../data/group';
import { loadMyStatus } from '../../../../data/me';
import { loadNominationsFor } from '../../../../data/nominations';
import {
  buildTimeline,
  eventsAbout,
  loadDeclineMarks,
  memberSince,
  proposalsBy,
  withDeclineMarks,
  withOwnSubject,
} from '../../../../data/timeline';
import { getAddressHistory } from '../../../../data/txs';
import { useQuery } from '../../../../hooks/useQuery';
import { isOpenState } from '../../../../rules/nomination';
import { nominationRounds } from '../../../../rules/rounds';

export function useMinterStory(address: string) {
  const status = useQuery(`status:${address}`, (force) => loadMyStatus(address, { force }));
  const history = useQuery(`history:${address}`, (force) => getAddressHistory(address, { force }));
  const nominations = useQuery(`nominations:for:${address}`, (force) =>
    loadNominationsFor(address, { force })
  );
  const chain = useQuery('chain:now', (force) => getChainNow({ force }));
  const group = useQuery('group:info', (force) => getGroupInfo({ force }));

  const rows = history.data?.rows;
  const kickedOthers = Boolean(
    rows?.some((tx) => tx.type === 'GROUP_KICK' && tx.member && tx.member !== address)
  );
  const marks = useQuery(kickedOthers ? `declinemarks:${address}` : null, (force) =>
    loadDeclineMarks(address, rows ?? [], { force })
  );
  const msPerBlock = chain.data?.msPerBlock;
  const maximumBlockDelay = group.data?.maximumBlockDelay;
  // The marks only change kicks of others: their proposals wait for them (a moment), so a
  // declined join request never shows as a removal first; their own events don't.
  const marksReady = !kickedOthers || marks.data !== undefined || marks.isError;
  const events = useMemo(
    () =>
      rows && msPerBlock && maximumBlockDelay !== undefined
        ? buildTimeline(withOwnSubject(withDeclineMarks(rows, marks.data ?? new Map()), address), {
            msPerBlock,
            maximumBlockDelay,
          })
        : null,
    [rows, marks.data, msPerBlock, maximumBlockDelay, address]
  );
  const person = status.data;
  const list = nominations.data ?? null;
  const current = list ? (list.find((n) => isOpenState(n.state)) ?? list[0] ?? null) : null;
  const rounds = useMemo(
    () =>
      rows && maximumBlockDelay !== undefined
        ? nominationRounds(rows, address, maximumBlockDelay, current?.decision?.tx ?? null)
        : null,
    [rows, maximumBlockDelay, address, current]
  );
  return {
    status,
    history,
    nominations,
    chain,
    group,
    events,
    about: events ? eventsAbout(events, address) : null,
    proposals: events && marksReady ? proposalsBy(events, address) : null,
    since: events && person?.isMember ? memberSince(events, address) : null,
    current,
    rounds,
  };
}

export type MinterStory = ReturnType<typeof useMinterStory>;
