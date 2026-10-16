/**
 * Every name the account owns, each with its own history beside it
 * (registered, renamed, listed for sale, bought, sold), and the names it
 * had. What it published on QDN is in the Transactions tab (QDN data, and
 * by name).
 *
 * Reads: its names (`xnames:`, shared with the page header) and primary
 * name (`name:`), then per visible name `/names/{name}` (`xnamedata:`); one
 * heavy search of its name transactions (`xnamehist:`), which every name's
 * history comes from. Nothing polls.
 */
import { getNamesOf } from '../../../data/explorer/account';
import { usePrimaryName } from '../../../hooks/useData';
import { useQuery } from '../../../hooks/useQuery';
import { getNameHistory, nameHistoryKey } from '../../../data/explorer/nameHistory';
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
  const history = useQuery(nameHistoryKey(address), (force) => getNameHistory(address, { force }));
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
      />
    </>
  );
}
