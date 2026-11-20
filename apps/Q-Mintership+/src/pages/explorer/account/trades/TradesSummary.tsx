/**
 * The Trades tab's top: QORT it sold and bought on Q-Trade, the trade
 * offers it made and how they ended, and its Q-Asset trades with the QORT
 * they moved; under them when it first and last traded on Q-Trade, and
 * with how many accounts. Each figure fills in when its read is in, and
 * says so while it waits; one that fails says "–", with Retry under them.
 */
import { Box, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { Card } from '../../../../components/common/Section';
import { ErrorState } from '../../../../components/common/states';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import type { UseQueryResult } from '../../../../hooks/useQuery';
import type { OfferTotals, PortalSummary } from '../../../../rules/explorer/portalTrades';
import type { AssetTradesSummary } from '../../../../rules/explorer/trades';
import { formatCount, formatDate, plural } from '../../../../utils/format';
import { offersLine, qortText, tradeCount } from './tradesWords';

const VALUE_SX = {
  m: 0,
  fontWeight: 800,
  fontSize: { xs: 20, md: 22 },
  lineHeight: 1.25,
  fontVariantNumeric: 'tabular-nums',
  overflowWrap: 'anywhere',
} as const;

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}) {
  return (
    <Box sx={FIELD_BLOCK_SX}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" sx={VALUE_SX}>
        {value}
      </Typography>
      {detail ? (
        <Typography component="dd" variant="body2" color="text.secondary" sx={{ m: 0 }}>
          {detail}
        </Typography>
      ) : null}
    </Box>
  );
}

function Reading({ words }: { words: string }) {
  return (
    <>
      <Skeleton variant="text" width="60%" aria-hidden />
      <Box component="span" sx={visuallyHidden}>
        {words}
      </Box>
    </>
  );
}

export function TradesSummary({
  portal,
  summary,
  offers,
  offersRead,
  assets,
  assetSummary,
}: {
  portal: UseQueryResult<unknown>;
  summary: PortalSummary | null;
  /** Null until the offers and its sales are read. */
  offers: OfferTotals | null;
  /** The offers' own read, and whether it stopped short of them all. */
  offersRead: UseQueryResult<{ truncated: boolean }>;
  assets: UseQueryResult<{ truncated: boolean }>;
  assetSummary: AssetTradesSummary | null;
}) {
  const portalFailed = portal.isError && !portal.data;
  const offersFailed = (offersRead.isError && !offersRead.data) || portalFailed;
  const assetsFailed = assets.isError && !assets.data;
  const side = (key: 'sold' | 'bought') => {
    if (summary)
      return { value: qortText(summary[key].qort), detail: tradeCount(summary[key].count) };
    return portalFailed
      ? { value: '–' }
      : { value: <Reading words="Reading its trades on Q-Trade" /> };
  };
  const sold = side('sold');
  const bought = side('bought');
  return (
    <Card>
      <Box
        component="dl"
        aria-label="Its trades in figures"
        sx={{
          m: 0,
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
        }}
      >
        <Stat label="QORT sold on Q-Trade" value={sold.value} detail={sold.detail} />
        <Stat label="QORT bought on Q-Trade" value={bought.value} detail={bought.detail} />
        <Stat
          label="Trade offers made"
          value={
            offers ? (
              `${offersRead.data?.truncated ? 'at least ' : ''}${formatCount(offers.made)}`
            ) : offersFailed ? (
              '–'
            ) : (
              <Reading words="Reading the trade offers it made" />
            )
          }
          detail={offers ? offersLine(offers) : undefined}
        />
        <Stat
          label="Q-Asset trades"
          value={
            assetSummary ? (
              `${assets.data?.truncated ? 'at least ' : ''}${formatCount(assetSummary.count)}`
            ) : assetsFailed ? (
              '–'
            ) : (
              <Reading words="Reading its Q-Asset trades" />
            )
          }
          detail={
            assetSummary && (assetSummary.qortPaid > 0n || assetSummary.qortGot > 0n)
              ? [
                  assetSummary.qortPaid > 0n ? `paid ${qortText(assetSummary.qortPaid)}` : '',
                  assetSummary.qortGot > 0n ? `got ${qortText(assetSummary.qortGot)}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
        />
      </Box>
      {summary && summary.first !== null && summary.last !== null ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          On Q-Trade: first trade {formatDate(summary.first)}
          {summary.last !== summary.first ? `, latest ${formatDate(summary.last)}` : ''}, with{' '}
          {plural(summary.partners.length, 'account')}.
        </Typography>
      ) : null}
      {portalFailed ? (
        <ErrorState
          compact
          title="Its Q-Trade trades couldn’t be read."
          error={portal.error}
          onRetry={() => void portal.refetch()}
        />
      ) : null}
      {offersRead.isError && !offersRead.data ? (
        <ErrorState
          compact
          title="The trade offers it made couldn’t be read."
          error={offersRead.error}
          onRetry={() => void offersRead.refetch()}
        />
      ) : null}
      {assetsFailed ? (
        <ErrorState
          compact
          title="Its Q-Asset trades couldn’t be read."
          error={assets.error}
          onRetry={() => void assets.refetch()}
        />
      ) : null}
    </Card>
  );
}
