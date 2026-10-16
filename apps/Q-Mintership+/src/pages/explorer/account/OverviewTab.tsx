/**
 * An account at a glance, in this order: one summary sentence (its level,
 * where it stands in MINTER, its names, when it was first seen and last
 * sent a transaction), the direct links recorded with other accounts, its
 * facts (level and progress, blocks minted, balance, first seen, groups),
 * MINTER, minting, its latest transactions, and notes when there are any.
 *
 * Reads: the page's own (account, status, names, primary name, the online
 * list) from the store, plus its balance, groups, where its first QORT came
 * from, its newest own transaction (only with a public key; one cheap row)
 * and, once the Minting section nears the screen, the last block it signed.
 * When it is in MINTER, the person page's reads for its join date. None of
 * them polls; Refresh on the page reloads them. Each section loads, fails
 * and retries on its own.
 */
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { getFirstSeen, getNamesOf } from '../../../data/explorer/account';
import { getLastSent, lastSentKey } from '../../../data/explorer/lastSent';
import { loadMyStatus } from '../../../data/me';
import { useAccount, usePrimaryName } from '../../../hooks/useData';
import { useQuery } from '../../../hooks/useQuery';
import { DirectLinksPreview } from './DirectLinksPreview';
import { LatestTransactions } from './LatestTransactions';
import { FactsSection } from './overview/FactsSection';
import { GroupsSection } from './overview/GroupsSection';
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
  // The same keys as the page header and the person page; no polling here.
  const status = useQuery(`status:${address}`, (force) => loadMyStatus(address, { force }));
  const names = useQuery(`xnames:${address}`, (force) => getNamesOf(address, { force }));
  const primary = usePrimaryName(address);
  const firstSeen = useQuery(`xfirst:${address}`, () => getFirstSeen(address));
  const publicKey = account.data?.publicKey ?? null;
  const lastSent = useQuery(publicKey ? lastSentKey(address) : null, (force) =>
    getLastSent(address, publicKey as string, { force })
  );
  const memberSince = useMemberSince(address, Boolean(status.data?.isMember));

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
      <DirectLinksPreview address={address} />
      <FactsSection address={address} account={a} firstSeen={firstSeen} />
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
