/**
 * An account at a glance, in this order: one summary sentence (its level,
 * where it stands in MINTER, its names, when it was first seen and last
 * sent a transaction), the direct links recorded with other accounts, its
 * facts (level and progress, blocks minted, balance, first seen, groups),
 * its activity, MINTER, minting, its latest transactions, and notes when
 * there are any. The direct links, the activity chart and the QORT facts are
 * for viewers who see the Explorer's detailed parts (rules/explorer/access.ts);
 * anyone else gets the rest, as if that were all there is.
 *
 * Reads: the page's own (account, status, names, primary name, the online
 * list) from the store, plus its balance, groups, where its first QORT came
 * from, its newest own transaction (only with a public key; one cheap row)
 * and, once the Minting section nears the screen, the last block it signed.
 * When it is in MINTER, the Minter Profile's reads for its join date. None of
 * them polls; Refresh on the page reloads them. Each section loads, fails
 * and retries on its own.
 */
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { getFirstSeen, getNamesOf } from '../../../data/explorer/account';
import { getLastSent, lastSentKey } from '../../../data/explorer/lastSent';
import { loadMyStatus } from '../../../data/me';
import { useAccount, usePrimaryName } from '../../../hooks/useData';
import { useFullExplorer } from '../../../hooks/useFullExplorer';
import { useQuery } from '../../../hooks/useQuery';
import { DirectLinksPreview } from './DirectLinksPreview';
import { LatestTransactions } from './LatestTransactions';
import { FactsSection } from './overview/FactsSection';
import { GroupsSection } from './overview/GroupsSection';
import { ActivitySection } from './activity/ActivitySection';
import { MinterSection } from './overview/MinterSection';
import { MintingSection } from './overview/MintingSection';
import { NotesSection } from './overview/NotesSection';
import { Summary } from './overview/Summary';
import { useMemberSince } from './overview/useMemberSince';

export interface OverviewTabProps {
  address: string;
}

/** undefined while loading, null when it failed (or doesn't apply). */
function partOf<T>(query: { data: T | undefined; isError: boolean }): T | null | undefined {
  if (query.data !== undefined) return query.data;
  return query.isError ? null : undefined;
}

export default function OverviewTab({ address }: OverviewTabProps) {
  const account = useAccount(address);
  // The same keys as the page header and the Minter Profile; no polling here.
  const status = useQuery(`status:${address}`, (force) => loadMyStatus(address, { force }));
  const names = useQuery(`xnames:${address}`, (force) => getNamesOf(address, { force }));
  const primary = usePrimaryName(address);
  const firstSeen = useQuery(`xfirst:${address}`, () => getFirstSeen(address));
  const publicKey = account.data?.publicKey ?? null;
  const lastSent = useQuery(publicKey ? lastSentKey(address) : null, (force) =>
    getLastSent(address, publicKey as string, { force })
  );
  const memberSince = useMemberSince(address, Boolean(status.data?.isMember));
  const full = useFullExplorer() === true;

  if (account.isError && !account.data)
    return (
      <ErrorState
        title="Couldn't load this account."
        error={account.error}
        onRetry={() => void account.refetch()}
      />
    );
  if (!account.data) return <ListSkeleton count={3} label="Loading the account" />;
  const a = account.data;
  return (
    <>
      <Summary
        address={address}
        level={a.level}
        status={partOf(status)}
        memberSince={memberSince}
        names={partOf(names)}
        firstSeen={partOf(firstSeen)}
        lastSent={publicKey ? partOf(lastSent) : null}
      />
      {full ? <DirectLinksPreview address={address} /> : null}
      <FactsSection address={address} account={a} firstSeen={firstSeen} full={full} />
      {full ? <ActivitySection address={address} firstSeen={firstSeen} /> : null}
      <GroupsSection address={address} />
      <MinterSection address={address} status={status} memberSince={memberSince} />
      <MintingSection address={address} hasPublicKey={Boolean(publicKey)} />
      <LatestTransactions address={address} />
      <NotesSection
        address={address}
        penalty={a.blocksMintedPenalty}
        primary={primary.data ?? null}
        names={names.data}
      />
    </>
  );
}
