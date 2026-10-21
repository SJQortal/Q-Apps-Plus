/**
 * What "Recorded between them" is built from, for the Connections tab and
 * Overview's Direct links (the same keys, so either one's reads serve the
 * other): the account's links (xlinks:<a>, heavy), its QORT payments each
 * way (xpay:<a>:sent|recv, light), its asset transfers and multi-payments
 * (xassets:<a>, heavy), its Q-Asset trades (xassettrades:<a>, its filled orders
 * and who filled them), and who is minting now (xonline, shared with the
 * header). Nothing polls; Refresh marks these keys stale.
 */
import { useMemo } from 'react';
import { getOnline, type OnlineShare } from '../../../../data/explorer/account';
import { getLinks, type AccountLinks } from '../../../../data/explorer/links';
import {
  getAssetTransfers,
  getPayments,
  type AssetTransfers,
  type PaymentPage,
} from '../../../../data/explorer/money';
import { getAccountTrades, tradesKey, type AccountTrades } from '../../../../data/explorer/trades';
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import {
  linksOf,
  mintingWithNow,
  type ActiveShare,
  type Links,
} from '../../../../rules/explorer/connections';
import { flowsOf, type Flow } from '../../../../rules/explorer/money';
import { recordedFindings, type Finding } from '../../../../rules/explorer/findings';

/** The reads "Recorded between them" is built from. */
export type ConnectionsPart = 'links' | 'sent' | 'recv' | 'assets' | 'trades';

export interface ConnectionsData {
  links: UseQueryResult<AccountLinks>;
  sent: UseQueryResult<PaymentPage>;
  recv: UseQueryResult<PaymentPage>;
  assets: UseQueryResult<AssetTransfers>;
  trades: UseQueryResult<AccountTrades>;
  online: UseQueryResult<OnlineShare[]>;
  /** What the links say (null until they load). */
  parsed: Links | null;
  /** Its active shares minting now (null until the links and the online list load). */
  mintingWith: ActiveShare[] | null;
  /** Payments and transfers it sent, by recipient (null until its payments sent load). */
  flowsSent: Flow[] | null;
  /** Payments and transfers it received, by sender. */
  flowsReceived: Flow[] | null;
  /** Every part has loaded or failed. */
  settled: boolean;
  /** The parts that failed with nothing loaded: what they would show isn't claimed as checked. */
  failed: ConnectionsPart[];
  /** Reads the failed parts again. */
  retryFailed: () => void;
}

export function useConnections(address: string, enabled = true): ConnectionsData {
  const on = enabled ? address : null;
  const links = useQuery(on && `xlinks:${on}`, (force) => getLinks(address, { force }));
  const sent = useQuery(on && `xpay:${on}:sent`, (force) =>
    getPayments(address, 'sent', { force })
  );
  const recv = useQuery(on && `xpay:${on}:recv`, (force) =>
    getPayments(address, 'recv', { force })
  );
  const assets = useQuery(on && `xassets:${on}`, (force) => getAssetTransfers(address, { force }));
  const trades = useQuery(on && tradesKey(on), (force) => getAccountTrades(address, { force }));
  const online = useQuery(on && 'xonline', () => getOnline());

  const parsed = useMemo(
    () => (links.data ? linksOf(links.data.rows, address, links.data.privs) : null),
    [links.data, address]
  );
  const mintingWith = useMemo(
    () => (parsed && online.data ? mintingWithNow(parsed, address, online.data) : null),
    [parsed, online.data, address]
  );
  const flowsSent = useMemo(
    () =>
      sent.data
        ? flowsOf([...sent.data.rows, ...(assets.data?.rows ?? [])], address, 'sent')
        : null,
    [sent.data, assets.data, address]
  );
  const flowsReceived = useMemo(
    () =>
      recv.data
        ? flowsOf([...recv.data.rows, ...(assets.data?.rows ?? [])], address, 'received')
        : null,
    [recv.data, assets.data, address]
  );
  const settled = [links, sent, recv, assets, trades].every(
    (q) => q.data !== undefined || q.isError
  );
  const parts = { links, sent, recv, assets, trades };
  const failed = (Object.keys(parts) as ConnectionsPart[]).filter(
    (part) => parts[part].isError && parts[part].data === undefined
  );
  const retryFailed = () => {
    for (const part of failed) void parts[part].refetch();
  };
  return {
    links,
    sent,
    recv,
    assets,
    trades,
    online,
    parsed,
    mintingWith,
    flowsSent,
    flowsReceived,
    settled,
    failed,
    retryFailed,
  };
}

/** The findings "Recorded between them", in the page's order. */
export function useRecorded(
  data: ConnectionsData,
  levels?: Record<string, number | undefined>
): Finding[] {
  const { parsed, mintingWith, flowsSent, flowsReceived } = data;
  const trades = data.trades.data?.trades ?? null;
  return useMemo(
    () =>
      recordedFindings({
        links: parsed,
        mintingWith,
        sent: flowsSent,
        received: flowsReceived,
        levels,
        trades,
      }),
    [parsed, mintingWith, flowsSent, flowsReceived, levels, trades]
  );
}
