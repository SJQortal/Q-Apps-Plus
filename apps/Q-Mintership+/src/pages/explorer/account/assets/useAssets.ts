/**
 * The account's Q-Assets for the Assets tab and the Overview's quick list:
 * its holdings, joined with Core's asset list (owner, quantity, description)
 * and their last trades with QORT once those are in (data/explorer/assets.ts).
 * The holdings come first; the list and the prices fill in as they arrive,
 * and each can fail on its own (the holdings still show).
 */
import { useMemo } from 'react';
import {
  ASSET_LIST_KEY,
  getAssetList,
  getAssetPrices,
  getHoldings,
  holdingsKey,
  pricesKey,
  type Holdings,
} from '../../../../data/explorer/assets';
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import {
  assetViews,
  ownedNotHeld,
  type AssetMeta,
  type AssetPrice,
  type AssetView,
} from '../../../../rules/explorer/assets';

export interface AccountAssets {
  holdings: UseQueryResult<Holdings>;
  list: UseQueryResult<Map<number, AssetMeta>>;
  prices: UseQueryResult<Map<number, AssetPrice>>;
  /** The holdings with what is known of them, once the holdings are in. */
  views?: AssetView[];
  /** Assets it owns and holds none of, once both lists are in. */
  owned?: AssetMeta[];
}

export function useAssets(address: string): AccountAssets {
  const holdings = useQuery(holdingsKey(address), (force) => getHoldings(address, { force }));
  const list = useQuery(ASSET_LIST_KEY, (force) => getAssetList({ force }));
  const ids = holdings.data?.rows.map((h) => h.assetId) ?? [];
  const prices = useQuery(ids.length ? pricesKey(address) : null, (force) =>
    getAssetPrices(address, ids, { force })
  );
  const views = useMemo(
    () =>
      holdings.data ? assetViews(holdings.data.rows, address, list.data, prices.data) : undefined,
    [holdings.data, list.data, prices.data, address]
  );
  const owned = useMemo(
    () =>
      holdings.data && list.data ? ownedNotHeld(list.data, holdings.data.rows, address) : undefined,
    [holdings.data, list.data, address]
  );
  return { holdings, list, prices, views, owned };
}
