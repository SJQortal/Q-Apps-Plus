/**
 * The Trades tab (Simon, 2026-10-26: "a new tab in Explorer, in between
 * Transactions and Assets, it is going to be "Trades" tab, and there I
 * would like to see an overview of Q-Trades and Q-Asset trades the user
 * made, summary, and then at the bottom very nice breakdown of the
 * trades"). For viewers who see the Explorer's detailed parts
 * (rules/explorer/access.ts), as QORT bought and sold are.
 *
 * - Its summary (TradesSummary): QORT sold and bought on Q-Trade, the trade
 *   offers it made, its Q-Asset trades.
 * - The breakdown (Breakdown, VolumeChart): by coin, over time, the trade
 *   offers, by Q-Asset, highlights.
 * - Under it, its Q-Trade trades and its Q-Asset trades, newest first
 *   (TradeLists; Simon, 2026-10-26: "I would like them under the Breakdown").
 *
 * Reads (each kept for the tab's next visit and the account page's
 * Refresh): its completed trades on every chain (`xportal:<a>`), the
 * offers it made and the payouts it got (`xatrows:<a>`), and its asset
 * trades (`xassettrades:<a>`, shared with Connections). Nothing polls.
 */
import { useMemo } from 'react';
import { EmptyState, ListSkeleton } from '../../../components/common/states';
import { Section } from '../../../components/common/Section';
import { CARD_COLUMN } from '../../../components/layout/flowColumns';
import {
  atRowsKey,
  getAtRows,
  getPortalTrades,
  portalKey,
} from '../../../data/explorer/portalTrades';
import { getAccountTrades, tradesKey } from '../../../data/explorer/trades';
import { useQuery } from '../../../hooks/useQuery';
import {
  offerOutcomes,
  soldAts,
  summariseOffers,
  summarisePortal,
  volumeByPeriod,
} from '../../../rules/explorer/portalTrades';
import { summariseAssetTrades } from '../../../rules/explorer/trades';
import {
  AssetBreakdown,
  BreakdownCard,
  CoinBreakdown,
  Highlights,
  OffersBreakdown,
} from './trades/Breakdown';
import { AssetTradeList, PortalTradeList } from './trades/TradeLists';
import { TradesSummary } from './trades/TradesSummary';
import { VolumeChart } from './trades/VolumeChart';

export default function TradesTab({ address }: { address: string }) {
  const portal = useQuery(portalKey(address), (force) => getPortalTrades(address, { force }));
  const atRows = useQuery(atRowsKey(address), (force) => getAtRows(address, { force }));
  const assets = useQuery(tradesKey(address), (force) => getAccountTrades(address, { force }));

  const summary = useMemo(() => (portal.data ? summarisePortal(portal.data) : null), [portal.data]);
  const volume = useMemo(() => (portal.data ? volumeByPeriod(portal.data) : null), [portal.data]);
  const offers = useMemo(
    () =>
      portal.data && atRows.data
        ? summariseOffers(
            offerOutcomes(atRows.data.deployed, soldAts(portal.data), new Set(atRows.data.paidBack))
          )
        : null,
    [portal.data, atRows.data]
  );
  const assetSummary = useMemo(
    () => (assets.data ? summariseAssetTrades(assets.data.trades) : null),
    [assets.data]
  );

  const none =
    portal.data?.length === 0 &&
    atRows.data?.deployed.length === 0 &&
    assets.data?.trades.length === 0;
  if (none)
    return (
      <EmptyState
        title="No trades yet."
        description="It hasn’t completed a trade on Q-Trade, offered QORT there or traded a Q-Asset."
      />
    );

  return (
    <>
      <TradesSummary
        portal={portal}
        summary={summary}
        offers={offers?.total ?? null}
        offersRead={atRows}
        assets={assets}
        assetSummary={assetSummary}
      />
      {summary?.coins.length || offers?.total.made || assetSummary?.count ? (
        <Section title="Breakdown" id="trades-breakdown" flow={CARD_COLUMN}>
          {summary?.coins.length ? (
            <BreakdownCard title="By coin" id="trades-by-coin">
              <CoinBreakdown summary={summary} />
            </BreakdownCard>
          ) : null}
          {volume?.periods.length ? (
            <BreakdownCard title="Over time" id="trades-over-time">
              <VolumeChart periods={volume.periods} unit={volume.unit} />
            </BreakdownCard>
          ) : null}
          {offers?.total.made ? (
            <BreakdownCard title="Trade offers it made" id="trades-offers">
              <OffersBreakdown
                total={offers.total}
                byCoin={offers.byCoin}
                truncated={Boolean(atRows.data?.truncated)}
              />
            </BreakdownCard>
          ) : null}
          {assetSummary?.count ? (
            <BreakdownCard title="By Q-Asset" id="trades-by-asset">
              <AssetBreakdown summary={assetSummary} />
            </BreakdownCard>
          ) : null}
          {summary && (summary.sold.count || summary.bought.count) ? (
            <BreakdownCard title="Highlights" id="trades-highlights">
              <Highlights summary={summary} />
            </BreakdownCard>
          ) : null}
        </Section>
      ) : null}
      <Section title="Q-Trade trades" id="trades-qtrade">
        {portal.data ? (
          portal.data.length ? (
            <PortalTradeList trades={portal.data} />
          ) : (
            <EmptyState plain title="No completed trades on Q-Trade." />
          )
        ) : portal.isError ? null : (
          <ListSkeleton count={3} label="Reading its trades on Q-Trade" />
        )}
      </Section>
      <Section title="Q-Asset trades" id="trades-assets">
        {assets.data ? (
          assets.data.trades.length ? (
            <AssetTradeList data={assets.data} />
          ) : (
            <EmptyState plain title="No Q-Asset trades." />
          )
        ) : assets.isError ? null : (
          <ListSkeleton count={2} label="Reading its Q-Asset trades" />
        )}
      </Section>
    </>
  );
}
