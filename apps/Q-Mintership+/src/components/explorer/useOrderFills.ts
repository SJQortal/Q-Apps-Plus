/**
 * How an asset order (CREATE_ASSET_ORDER) was filled: its trades, each with
 * the other account (data/explorer/trades.ts). From the account's trades
 * when they are read already (Connections, or the Transactions tab of an
 * account with orders), else from this order's own read, made once the row
 * is opened. Undefined for any other transaction, or while nothing is read.
 */
import { useMemo } from 'react';
import { fillsKey, getOrderFills, tradesKey, type AccountTrades } from '../../data/explorer/trades';
import type { TxRow } from '../../data/types';
import { useQuery } from '../../hooks/useQuery';
import { useStoreValues } from '../../hooks/useStoreValues';
import type { AssetTrade } from '../../rules/explorer/trades';

const ADDRESS_RE = /^[QA][1-9A-HJ-NP-Za-km-z]{33}$/;

export function useOrderFills(tx: TxRow, load: boolean): AssetTrade[] | undefined {
  const creator =
    tx.type === 'CREATE_ASSET_ORDER' &&
    typeof tx.creatorAddress === 'string' &&
    ADDRESS_RE.test(tx.creatorAddress)
      ? tx.creatorAddress
      : null;
  const [account, own] = useStoreValues<AccountTrades | AssetTrade[]>(
    creator ? [tradesKey(creator), fillsKey(tx.signature)] : []
  ) as [AccountTrades | undefined, AssetTrade[] | undefined];
  const fromAccount = useMemo(() => {
    if (!account) return undefined;
    const mine = account.trades.filter((trade) => trade.orderId === tx.signature);
    // Its newest filled orders only: an older one may have trades it didn't read.
    return mine.length || !account.truncated ? mine : undefined;
  }, [account, tx.signature]);
  const read = useQuery(
    creator && load && fromAccount === undefined && own === undefined
      ? fillsKey(tx.signature)
      : null,
    () => getOrderFills(tx.signature, creator as string)
  );
  return fromAccount ?? own ?? read.data;
}
