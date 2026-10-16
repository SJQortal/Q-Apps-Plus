/**
 * What "Recorded between them" is built from, for the Connections tab and
 * Overview's Direct links (the same keys, so either one's reads serve the
 * other): the account's links (xlinks:<a>, heavy), its QORT payments each
 * way (xpay:<a>:sent|recv, light), its asset transfers and multi-payments
 * (xassets:<a>, heavy), and who is minting now (xonline, shared with the
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
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import {
  linksOf,
  mintingWithNow,
  type ActiveShare,
  type Links,
} from '../../../../rules/explorer/connections';
import { flowsOf, type Flow } from '../../../../rules/explorer/money';
import { recordedFindings, type Finding } from '../../../../rules/explorer/findings';

export interface ConnectionsData {
  links: UseQueryResult<AccountLinks>;
  sent: UseQueryResult<PaymentPage>;
  recv: UseQueryResult<PaymentPage>;
  assets: UseQueryResult<AssetTransfers>;
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
  const settled = [links, sent, recv, assets].every((q) => q.data !== undefined || q.isError);
  return {
    links,
    sent,
    recv,
    assets,
    online,
    parsed,
    mintingWith,
    flowsSent,
    flowsReceived,
    settled,
  };
}

/** The findings "Recorded between them", in the page's order. */
export function useRecorded(
  data: ConnectionsData,
  levels?: Record<string, number | undefined>
): Finding[] {
  const { parsed, mintingWith, flowsSent, flowsReceived } = data;
  return useMemo(
    () =>
      recordedFindings({
        links: parsed,
        mintingWith,
        sent: flowsSent,
        received: flowsReceived,
        levels,
      }),
    [parsed, mintingWith, flowsSent, flowsReceived, levels]
  );
}
