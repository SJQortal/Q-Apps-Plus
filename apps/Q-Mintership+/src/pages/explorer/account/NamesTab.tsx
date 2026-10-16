/**
 * Every name the account owns, and what it did with names: the list (its
 * primary name first, each name's own record as it scrolls into view,
 * notes on how a name is written), its name transactions (registered,
 * renamed, listed for sale, bought, sold), and what it published on QDN
 * under its names.
 *
 * Reads: its names (`xnames:`, shared with the page header) and primary
 * name (`name:`), then per visible name `/names/{name}` (`xnamedata:`);
 * once each section nears the screen, one heavy search of its name
 * transactions (`xnamehist:`) and the QDN search of its first 10 names
 * (`xqdnname:` per name; the rest on request). Nothing polls.
 */
import { Typography } from '@mui/material';
import { Card, Section } from '../../../components/common/Section';
import { ListSkeleton } from '../../../components/common/states';
import { getNamesOf } from '../../../data/explorer/account';
import { usePrimaryName } from '../../../hooks/useData';
import { useQuery } from '../../../hooks/useQuery';
import { NameHistory } from './names/NameHistory';
import { NamesList } from './names/NamesList';
import { QdnPublished } from './names/QdnPublished';

export interface NamesTabProps {
  address: string;
}

export default function NamesTab({ address }: NamesTabProps) {
  const names = useQuery(`xnames:${address}`, (force) => getNamesOf(address, { force }));
  const primaryQuery = usePrimaryName(address);
  // A primary name that can't be read counts as none: the list still shows.
  const primary = primaryQuery.isError ? null : primaryQuery.data;
  return (
    <>
      <NamesList address={address} names={names} primary={primary} />
      <NameHistory address={address} />
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
