/**
 * The Assets tab's top: how many Q-Assets the account holds, what the ones
 * that traded for QORT are worth together at their last trades, and right
 * next to it what buyers would pay for them now (Simon, 2026-10-21: "leave
 * that amount at the last trade, but also add realistic sale amount with
 * its own window next to it"), with "How it adds up" opening that window
 * (SaleDialog); and how many assets it owns. Then how the worth at last
 * trades splits among them: a bar in each asset's own colour (the biggest
 * four and the rest together) with a key. The prices and the buy orders
 * fill in after the holdings, and each can fail on its own.
 */
import { useState } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { Card } from '../../../../components/common/Section';
import { ErrorState } from '../../../../components/common/states';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import type { UseQueryResult } from '../../../../hooks/useQuery';
import {
  allocation,
  assetsTotals,
  qortWords,
  shareWords,
  type AssetPrice,
  type AssetView,
  type SaleNow,
} from '../../../../rules/explorer/assets';
import { formatCount } from '../../../../utils/format';
import { assetAccent } from './assetAccent';
import { pricedLine, SALE_LABEL, salesLine } from './assetsWords';
import { SaleDialog } from './SaleDialog';

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
  action,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  /** A button under it ("How it adds up"). */
  action?: React.ReactNode;
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
      {action ? (
        <Box component="dd" sx={{ m: 0, mt: 0.5, ml: -1 }}>
          {action}
        </Box>
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

/** How the worth splits: one bar, a part per asset in its colour, and a key under it. */
function Allocation({ views }: { views: readonly AssetView[] }) {
  const theme = useTheme();
  const parts = allocation(views);
  if (parts.length < 2) return null;
  const colourOf = (assetId: number | null) =>
    assetId === null ? alpha(theme.palette.text.primary, 0.3) : assetAccent(theme, assetId);
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        How their worth splits
      </Typography>
      <Box
        aria-hidden
        sx={{ display: 'flex', gap: '2px', height: 12, borderRadius: 999, overflow: 'hidden' }}
      >
        {parts.map((part) => (
          <Box
            key={part.assetId ?? 'others'}
            sx={{ flex: `${Math.max(part.fraction, 0.01)} 1 0`, bgcolor: colourOf(part.assetId) }}
          />
        ))}
      </Box>
      <Box
        component="ul"
        aria-label="How their worth splits"
        sx={{ listStyle: 'none', m: 0, mt: 1, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}
      >
        {parts.map((part) => (
          <Box
            component="li"
            key={part.assetId ?? 'others'}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}
          >
            <Box
              aria-hidden
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: colourOf(part.assetId),
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              <bdi dir="auto">{part.name}</bdi>{' '}
              <Box
                component="span"
                sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
              >
                {shareWords(part.fraction)}
              </Box>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function AssetsSummary({
  views,
  ownedCount,
  prices,
  sales,
  onOpenAsset,
}: {
  views: readonly AssetView[];
  /** Assets it owns, held or not; undefined until Core's asset list is in. */
  ownedCount?: number;
  prices: UseQueryResult<Map<number, AssetPrice>>;
  sales: UseQueryResult<Map<number, SaleNow>>;
  /** Opens an asset's own window. */
  onOpenAsset: (assetId: number) => void;
}) {
  const [breakdown, setBreakdown] = useState(false);
  const totals = assetsTotals(views);
  const pricesFailed = prices.isError && prices.data === undefined;
  const pricesWaiting = !prices.data && !pricesFailed && views.length > 0;
  const salesFailed = sales.isError && sales.data === undefined;
  let worth: React.ReactNode;
  let worthDetail: string | undefined;
  if (pricesWaiting) {
    worth = <Reading words="Reading their last trades" />;
  } else if (totals.priced) {
    worth = `≈ ${qortWords(totals.worth)} QORT`;
    worthDetail = pricedLine(totals);
  } else {
    worth = '–';
    worthDetail = pricesFailed ? undefined : pricedLine(totals);
  }
  let sale: React.ReactNode;
  if (sales.data)
    sale =
      totals.sale || totals.saleRead > totals.saleNone
        ? `${totals.saleAtLeast ? 'at least ' : ''}≈ ${qortWords(totals.sale)} QORT`
        : 'No buyers now';
  else sale = salesFailed ? '–' : <Reading words="Reading their buy orders" />;
  return (
    <Card>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          // On a phone: Holds and Owns, then the two values side by side.
          '& > :nth-of-type(2)': { order: { xs: 3, md: 0 } },
          '& > :nth-of-type(3)': { order: { xs: 4, md: 0 } },
          '& > :nth-of-type(4)': { order: { xs: 2, md: 0 } },
        }}
      >
        <Stat
          label="Holds"
          value={`${formatCount(totals.held)} Q-Asset${totals.held === 1 ? '' : 's'}`}
        />
        <Stat label="Worth at their last trades" value={worth} detail={worthDetail} />
        <Stat
          label={SALE_LABEL}
          value={sale}
          detail={sales.data ? salesLine(totals) : undefined}
          action={
            sales.data ? (
              <Button
                size="small"
                aria-haspopup="dialog"
                onClick={() => setBreakdown(true)}
                sx={{ minHeight: 44 }}
              >
                How it adds up
              </Button>
            ) : undefined
          }
        />
        <Stat
          label="Owns"
          value={
            ownedCount === undefined
              ? '–'
              : `${formatCount(ownedCount)} asset${ownedCount === 1 ? '' : 's'}`
          }
        />
      </Box>
      {pricesFailed ? (
        <Box sx={{ mt: 1 }}>
          <ErrorState
            compact
            title="Couldn’t read their last trades."
            error={prices.error}
            onRetry={() => void prices.refetch()}
          />
        </Box>
      ) : null}
      {salesFailed ? (
        <Box sx={{ mt: 1 }}>
          <ErrorState
            compact
            title="Couldn’t read their buy orders."
            error={sales.error}
            onRetry={() => void sales.refetch()}
          />
        </Box>
      ) : null}
      <Allocation views={views} />
      {breakdown ? (
        <SaleDialog
          views={views}
          onClose={() => setBreakdown(false)}
          onOpenAsset={(assetId) => {
            setBreakdown(false);
            onOpenAsset(assetId);
          }}
        />
      ) : null}
    </Card>
  );
}
