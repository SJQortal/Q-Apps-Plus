/**
 * One account in the Explorer: `/explorer/account/:who(/:tab)`.
 *
 * `:who` is an address (the URL of every account page), an AT address
 * (transactions only), or a name, which is only input: it is looked up and
 * the URL switches to its owner's address (`replace`), carrying the name so
 * the header can say which name it came from. A name nobody has, an address
 * Core rejects, and a valid address never used each get a page of their own.
 *
 * The header (every tab), the trail of accounts opened one from another,
 * then the tabs. Opening an account adds it to the trail and, when Settings
 * allow, to Recent explorations. Read-only: nothing here writes.
 */
import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody, WIDE_PAGE } from '../../components/layout/PageBody';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { AddressText } from '../../components/common/Person';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../components/common/personLinks';
import { RefreshButton } from '../../components/common/RefreshButton';
import { Card } from '../../components/common/Section';
import { EmptyState, ErrorState, HeroSkeleton, ListSkeleton } from '../../components/common/states';
import { ExplorerSearch, NamesContaining } from '../../components/explorer/ExplorerSearch';
import { isAddress } from '../../data/accounts';
import {
  exploreAccount,
  getNameData,
  getNamesOf,
  getOnline,
  isAtAddress,
  isInvalidAddressError,
  onlineSharesOf,
} from '../../data/explorer/account';
import { loadMyStatus } from '../../data/me';
import { useHeavyScope } from '../../hooks/useHeavyScope';
import { usePrimaryName } from '../../hooks/useData';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useQuery } from '../../hooks/useQuery';
import { explorerAccountPath, explorerTabOf, PATHS, type ExplorerTab } from '../../routes/paths';
import { visibleName } from '../../rules/explorer/nameNotes';
import { cameFromExplorer, nameMatchOf, openInTrail, recordRecent } from '../../state/explorer';
import { shortAddress } from '../../utils/format';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { AccountHeader } from './account/AccountHeader';
import { AccountTabs } from './account/AccountTabs';
import { CompareToggle } from './account/CompareToggle';
import { CompareWith } from './account/CompareWith';
import { ExplorerTrail } from './account/ExplorerTrail';
import OverviewTab from './account/OverviewTab';
import { refreshAccount } from './account/refreshAccount';
import { ACCOUNT_TABS, AT_TABS, panelIdOf, tabIdOf } from './account/tabIds';
import { AT_ACCOUNT, INVALID_ADDRESS, UNUSED_ADDRESS } from './explorerWords';

// Each tab's code loads when it is first opened.
const TAB_PANELS: Record<ExplorerTab, ComponentType<{ address: string }>> = {
  overview: OverviewTab,
  connections: lazy(() => import('./account/ConnectionsTab')),
  transactions: lazy(() => import('./account/TransactionsTab')),
  mintership: lazy(() => import('./account/MintershipTab')),
  names: lazy(() => import('./account/NamesTab')),
};

/** Written like an address but not one (a letter wrong, missing or extra). */
const ADDRESS_LIKE = /^[QA][0-9A-Za-z]{25,40}$/;

type Who = 'address' | 'at' | 'name';

function whoKind(who: string): Who {
  if (isAddress(who)) return 'address';
  if (isAtAddress(who)) return 'at';
  return 'name';
}

/** A name, isolated from the sentence around it. */
function Quoted({ name }: { name: string }) {
  return (
    <>
      “<bdi dir="auto">{visibleName(name)}</bdi>”
    </>
  );
}

/** The selected tab's panel, labelled by its tab. */
function TabPanel({ tab, address }: { tab: ExplorerTab; address: string }) {
  const Panel = TAB_PANELS[tab];
  return (
    <Box
      role="tabpanel"
      id={panelIdOf(tab)}
      aria-labelledby={tabIdOf(tab)}
      sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Suspense fallback={<ListSkeleton count={3} label="Loading this tab" />}>
        <Panel address={address} />
      </Suspense>
    </Box>
  );
}

export default function AccountPage() {
  const params = useParams();
  const who = (params.who ?? '').trim();
  const kind = whoKind(who);
  const location = useLocation();
  const navigate = useNavigate();
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  // Portrait phones: the tabs ride in the sticky header; elsewhere they head the body.
  const tabsInHeader = phone && !landscape;

  // ---- A name: look it up, then show its owner's address in the URL. ----
  const nameKey = kind === 'name' && who ? `xnamedata:${who}` : null;
  const nameQuery = useQuery(nameKey, () => getNameData(who));
  const owner = nameQuery.data?.owner ?? null;
  const matched = nameQuery.data?.name ?? null;
  useEffect(() => {
    if (!owner || !matched) return;
    const state = location.state && typeof location.state === 'object' ? location.state : {};
    navigate(explorerAccountPath(owner, explorerTabOf(params.tab)), {
      replace: true,
      state: { ...state, viaName: who, matched },
    });
  }, [owner, matched, who, params.tab, location.state, navigate]);

  // ---- An address: is it valid, used, and what is it? ----
  const address = kind === 'address' ? who : null;
  const explored = useQuery(address ? `xacct:${address}` : null, (force) =>
    exploreAccount(address as string, { force })
  );
  const account = explored.data?.kind === 'account' ? explored.data.account : null;
  const live = account ? account.address : null;

  // Header facts, once the account is known to exist. None of these polls.
  const primary = usePrimaryName(live);
  const names = useQuery(live ? `xnames:${live}` : null, (force) =>
    getNamesOf(live as string, { force })
  );
  const status = useQuery(live ? `status:${live}` : null, (force) =>
    loadMyStatus(live as string, { force })
  );
  const online = useQuery(live ? 'xonline' : null, () => getOnline());

  // Heavy reads queued for an account go when the page leaves it.
  const opened = live ?? (kind === 'at' ? who : null);
  useHeavyScope(opened);

  // The trail and Recent explorations, once per account opened.
  const viaExplorer = cameFromExplorer(location.state);
  useEffect(() => {
    if (!opened) return;
    openInTrail(opened, viaExplorer);
    recordRecent(opened);
    // Only a new account counts: a tab switch keeps the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const tab: ExplorerTab = kind === 'at' ? 'transactions' : explorerTabOf(params.tab);
  const tabs = kind === 'at' ? AT_TABS : ACCOUNT_TABS;
  const tabBar = opened ? <AccountTabs address={opened} tab={tab} tabs={tabs} /> : null;

  // ---- What the page says, by state. ----
  let title = 'Account';
  let subtitle: string | undefined;
  let body: React.ReactNode;
  let showTabs = false;
  let actions: React.ReactNode = null;

  const invalid =
    (explored.isError && isInvalidAddressError(explored.error)) ||
    (kind === 'name' && nameQuery.data === null && ADDRESS_LIKE.test(who));

  if (!who) {
    body = <EmptyState title="No account given." />;
  } else if (invalid) {
    title = 'Not a valid address';
    body = (
      <>
        <EmptyState title={INVALID_ADDRESS} description={<bdi dir="auto">{who}</bdi>} />
        <ExplorerSearch />
      </>
    );
  } else if (kind === 'name') {
    if (nameQuery.isError) {
      title = visibleName(who);
      body = (
        <ErrorState
          title="Couldn't look up this name."
          error={nameQuery.error}
          onRetry={() => void nameQuery.refetch()}
        />
      );
    } else if (nameQuery.data === null) {
      title = 'No such name';
      body = (
        <>
          <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography role="status" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              No one has the name <Quoted name={who} />.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Names that contain it:
            </Typography>
            <NamesContaining text={who} />
          </Card>
          <ExplorerSearch />
        </>
      );
    } else {
      // Looking it up, or about to switch to its owner.
      title = visibleName(who);
      body = <HeroSkeleton />;
    }
  } else if (kind === 'at') {
    title = 'AT address';
    actions = <CopyLinkButton path={explorerAccountPath(who)} what="this AT address" />;
    showTabs = true;
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography>{AT_ACCOUNT}</Typography>
        <AddressText address={who} />
        <ExplorerTrail />
      </Box>
    );
  } else if (explored.isError && !explored.data) {
    title = shortAddress(who);
    body = (
      <ErrorState
        title="Couldn't load this account."
        error={explored.error}
        onRetry={() => void explored.refetch()}
      />
    );
  } else if (explored.data?.kind === 'unused') {
    title = shortAddress(who);
    actions = <CopyLinkButton path={explorerAccountPath(who)} what="this address" />;
    body = (
      <>
        <EmptyState title={UNUSED_ADDRESS} description={<AddressText address={who} full />} />
        <ExplorerSearch />
      </>
    );
  } else if (account) {
    const name = primary.data ?? null;
    const label = name ? visibleName(name) : shortAddress(account.address);
    title = label;
    if (primary.data === null && names.data)
      subtitle = names.data.names.length ? 'No primary name' : 'No registered name';
    showTabs = true;
    actions = (
      <>
        <CopyLinkButton path={explorerAccountPath(account.address)} what="this account" />
        <CompareToggle address={account.address} label={label} />
        <CompareWith address={account.address} label={label} />
        <RefreshButton
          onClick={() => refreshAccount(account.address, account.publicKey)}
          fetching={explored.fetching}
        />
      </>
    );
    body = (
      <>
        <AccountHeader
          address={account.address}
          account={account}
          primary={primary.isError ? null : primary.data}
          names={names.data}
          status={status.data}
          mintingNow={
            online.data ? onlineSharesOf(online.data, account.address).length > 0 : undefined
          }
          openedBy={nameMatchOf(location.state)}
        />
        <ExplorerTrail />
      </>
    );
  } else {
    title = shortAddress(who);
    body = <HeroSkeleton />;
  }

  return (
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <PageHeader title={title} subtitle={subtitle} back={PATHS.explorer} actions={actions}>
        {showTabs && tabsInHeader ? tabBar : null}
      </PageHeader>
      <PageBody $maxWidth={WIDE_PAGE}>
        {body}
        {showTabs && opened ? (
          <>
            {tabsInHeader ? null : tabBar}
            <TabPanel tab={tab} address={opened} />
          </>
        ) : null}
      </PageBody>
    </PersonLinkContext>
  );
}
