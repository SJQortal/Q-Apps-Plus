/**
 * The account's Q-Assets for the Assets tab and the Overview's quick list:
 * its holdings, joined with Core's asset list (owner, quantity, description)
 * and their last trades with QORT once those are in (data/explorer/assets.ts),
 * and what buyers would pay for each now (its open buy orders; not on the
 * Overview, which reads no books). The holdings come first; the rest fill
 * in as they arrive, and each can fail on its own (the holdings still show).
 */
import { useMemo } from 'react';
import {
  ASSET_LIST_KEY,
  getAssetList,
  getAssetPrices,
  getAssetSales,
  getHoldings,
  holdingsKey,
  pricesKey,
  salesKey,
  type Holdings,
} from '../../../../data/explorer/assets';
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import {
  assetViews,
  ownedNotHeld,
  type AssetMeta,
  type AssetPrice,
  type AssetView,
  type SaleNow,
} from '../../../../rules/explorer/assets';

export interface AccountAssets {
  holdings: UseQueryResult<Holdings>;
  list: UseQueryResult<Map<number, AssetMeta>>;
  prices: UseQueryResult<Map<number, AssetPrice>>;
  /** What buyers would pay now for each holding (its open buy orders). */
  sales: UseQueryResult<Map<number, SaleNow>>;
  /** The holdings with what is known of them, once the holdings are in. */
  views?: AssetView[];
  /** Assets it owns and holds none of, once both lists are in. */
  owned?: AssetMeta[];
}

export function useAssets(address: string, options: { sales?: boolean } = {}): AccountAssets {
  const holdings = useQuery(holdingsKey(address), (force) => getHoldings(address, { force }));
  const list = useQuery(ASSET_LIST_KEY, (force) => getAssetList({ force }));
  const ids = holdings.data?.rows.map((h) => h.assetId) ?? [];
  const prices = useQuery(ids.length ? pricesKey(address) : null, (force) =>
    getAssetPrices(address, ids, { force })
  );
  // The Overview's tiles don't read the books: one read per asset is the tab's.
  const sales = useQuery(
    options.sales !== false && holdings.data && ids.length ? salesKey(address) : null,
    (force) => getAssetSales(address, holdings.data?.rows ?? [], { force })
  );
  const views = useMemo(
    () =>
      holdings.data
        ? assetViews(holdings.data.rows, address, list.data, prices.data, sales.data)
        : undefined,
    [holdings.data, list.data, prices.data, sales.data, address]
  );
  const owned = useMemo(
    () =>
      holdings.data && list.data ? ownedNotHeld(list.data, holdings.data.rows, address) : undefined,
    [holdings.data, list.data, address]
  );
  return { holdings, list, prices, sales, views, owned };
}
