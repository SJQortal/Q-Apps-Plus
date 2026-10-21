/**
 * The Assets tab's top: how many Q-Assets the account holds, what the ones
 * that traded for QORT are worth together at their last trades, and how
 * many it owns; then how that worth splits among them: a bar in each
 * asset's own colour (the biggest four and the rest together) with a key.
 * The prices fill in after the holdings, and can fail on their own.
 */
import { Box, Skeleton, Typography } from '@mui/material';
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
} from '../../../../rules/explorer/assets';
import { formatCount } from '../../../../utils/format';
import { assetAccent } from './assetAccent';
import { pricedLine } from './assetsWords';

const VALUE_SX = {
  m: 0,
  fontWeight: 800,
  fontSize: 24,
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
  detail?: string;
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
}: {
  views: readonly AssetView[];
  /** Assets it owns, held or not; undefined until Core's asset list is in. */
  ownedCount?: number;
  prices: UseQueryResult<Map<number, AssetPrice>>;
}) {
  const totals = assetsTotals(views);
  const pricesFailed = prices.isError && prices.data === undefined;
  const pricesWaiting = !prices.data && !pricesFailed && views.length > 0;
  let worth: React.ReactNode;
  let worthDetail: string | undefined;
  if (pricesWaiting) {
    worth = (
      <>
        <Skeleton variant="text" width="60%" aria-hidden />
        <Box component="span" sx={visuallyHidden}>
          Reading their last trades
        </Box>
      </>
    );
  } else if (totals.priced) {
    worth = `≈ ${qortWords(totals.worth)} QORT`;
    worthDetail = pricedLine(totals);
  } else {
    worth = '–';
    worthDetail = pricesFailed ? undefined : pricedLine(totals);
  }
  return (
    <Card>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
          '& > :nth-of-type(2)': {
            gridColumn: { xs: '1 / -1', md: 'auto' },
            order: { xs: 3, md: 0 },
          },
        }}
      >
        <Stat
          label="Holds"
          value={`${formatCount(totals.held)} Q-Asset${totals.held === 1 ? '' : 's'}`}
        />
        <Stat label="Worth at their last trades" value={worth} detail={worthDetail} />
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
      <Allocation views={views} />
    </Card>
  );
}
