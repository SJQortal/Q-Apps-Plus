/**
 * Every name the account owns, each with its own history beside it
 * (registered, renamed, listed for sale, bought, sold), and the names it
 * had. What it published on QDN is in the Transactions tab (QDN data, and
 * by name).
 *
 * Reads: its names (`xnames:`, shared with the page header) and primary
 * name (`name:`), then per visible name `/names/{name}` (`xnamedata:`); one
 * heavy search of its name transactions (`xnamehist:`), which every name's
 * history comes from, and on request the whole of it, up to 1,000
 * (`xnamehist:<a>:10`), shown once it is in. Nothing polls.
 */
import { useState } from 'react';
import { getNamesOf } from '../../../data/explorer/account';
import { usePrimaryName } from '../../../hooks/useData';
import { useQuery } from '../../../hooks/useQuery';
import {
  getNameHistory,
  NAME_HISTORY_PAGES_ALL,
  nameHistoryKey,
} from '../../../data/explorer/nameHistory';
import { NamesList } from './names/NamesList';

export interface NamesTabProps {
  address: string;
}

export default function NamesTab({ address }: NamesTabProps) {
  const names = useQuery(`xnames:${address}`, (force) => getNamesOf(address, { force }));
  const primaryQuery = usePrimaryName(address);
  // A primary name that can't be read: the list still shows (in Core's order) and says so.
  const primaryFailed = primaryQuery.isError && primaryQuery.data === undefined;
  const primary = primaryFailed ? null : primaryQuery.data;
  const first = useQuery(nameHistoryKey(address), (force) => getNameHistory(address, { force }));
  const [whole, setWhole] = useState(false);
  const all = useQuery(whole ? nameHistoryKey(address, NAME_HISTORY_PAGES_ALL) : null, (force) =>
    getNameHistory(address, { force, pages: NAME_HISTORY_PAGES_ALL })
  );
  // The first read stays on screen until the whole history is in.
  const history = all.data ? all : first;
  return (
    <>
      <NamesList
        address={address}
        names={names}
        primary={primary}
        primaryError={
          primaryFailed
            ? { error: primaryQuery.error, retry: () => void primaryQuery.refetch() }
            : undefined
        }
        history={history}
        readWhole={
          history.data?.capped && !all.data
            ? { reading: whole && all.isLoading, failed: all.isError, read: () => setWhole(true) }
            : undefined
        }
      />
    </>
  );
}
