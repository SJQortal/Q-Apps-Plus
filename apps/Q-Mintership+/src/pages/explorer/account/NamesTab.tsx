/**
 * Every name the account owns, each opening to its own history (registered,
 * renamed, listed for sale, bought, sold), the names it had, and what it
 * published on QDN under its names.
 *
 * Reads: its names (`xnames:`, shared with the page header) and primary
 * name (`name:`), then per visible name `/names/{name}` (`xnamedata:`); one
 * heavy search of its name transactions (`xnamehist:`), which every name's
 * history comes from; once that section nears the screen, the QDN search
 * of its first 10 names (`xqdnname:` per name; the rest on request).
 * Nothing polls.
 */
import { Typography } from '@mui/material';
import { Card, Section } from '../../../components/common/Section';
import { ListSkeleton } from '../../../components/common/states';
import { getNamesOf } from '../../../data/explorer/account';
import { usePrimaryName } from '../../../hooks/useData';
import { useQuery } from '../../../hooks/useQuery';
import { getNameHistory, nameHistoryKey } from '../../../data/explorer/nameHistory';
import { NamesList } from './names/NamesList';
import { QdnPublished } from './names/QdnPublished';

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
      {!names.data || primary === undefined ? (
        names.isError ? null : (
          <Section title="Published on QDN" id="names-qdn">
            <ListSkeleton count={1} label="Loading its names" />
          </Section>
        )
      ) : names.data.names.length ? (
        <QdnPublished names={names.data.names} primary={primary} truncated={names.data.truncated} />
      ) : (
        <Section title="Published on QDN" id="names-qdn">
          <Card>
            <Typography color="text.secondary">
              QDN resources are published under names, and it has none.
            </Typography>
          </Card>
        </Section>
      )}
    </>
  );
}
