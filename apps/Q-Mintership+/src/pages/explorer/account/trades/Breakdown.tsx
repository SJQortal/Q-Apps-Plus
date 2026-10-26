/**
 * The Trades tab's breakdown, at its end (Simon, 2026-10-26: "very nice
 * breakdown of the trades, so it is easely visible how many QORT were sold
 * for LTC and other coins, how many ATs were made, all kinds of trade
 * summaries, q-asset trade summaries"), a card each:
 *
 * - By coin: where the QORT it sold went and where the QORT it bought came
 *   from, each one bar split by coin with a key (share, QORT, coin), then
 *   each coin's sales and purchases with the average price and when.
 * - Over time: VolumeChart.
 * - Trade offers: the offers it made (each an AT holding the QORT offered),
 *   by coin: completed, ended without a trade and open, as a bar each with
 *   a key that names each state; how many of those that ended sold; the
 *   QORT its open ones hold.
 * - By Q-Asset: each asset, units bought and sold, the QORT for them and
 *   the average price.
 * - Highlights: its biggest sale and purchase, the average of each, and the
 *   accounts it traded with most.
 *
 * Colour says which coin (coinAccent) or which state (the theme's success
 * and info, with an icon), never alone: every bar has its key in words.
 */
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { Card } from '../../../../components/common/Section';
import { PersonInline } from '../../../../components/common/Person';
import { coinAccent } from '../../../../components/explorer/coinAccent';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { formatAtomic } from '../../../../rules/explorer/money';
import {
  COINS,
  coinPerQort,
  type CoinTotals,
  type OfferOutcome,
  type OfferTotals,
  type PortalSummary,
  type PortalTrade,
  type SideTotals,
  type TradeChain,
} from '../../../../rules/explorer/portalTrades';
import { qortPerUnit, type AssetTradesSummary } from '../../../../rules/explorer/trades';
import { formatCount, formatDate, plural } from '../../../../utils/format';
import { assetAccent } from '../assets/assetAccent';
import { CoinDot } from './TradeLists';
import {
  coinName,
  coinText,
  offersLine,
  OUTCOME_LABEL,
  qortText,
  shareText,
  tradeCount,
} from './tradesWords';

/** A card of the breakdown, titled; `data-card` lets the section set cards side by side. */
export function BreakdownCard({
  title,
  id,
  children,
}: {
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <Card
      data-card
      role="region"
      aria-labelledby={id}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Typography id={id} component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {title}
      </Typography>
      {children}
    </Card>
  );
}

const KEY_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: 2,
  rowGap: 0.5,
} as const;

/** One side's QORT as a bar split by coin, with its key. */
function ShareBar({
  label,
  coins,
  side,
}: {
  label: string;
  coins: readonly CoinTotals[];
  side: 'sold' | 'bought';
}) {
  const theme = useTheme();
  const parts = coins.filter((coin) => coin[side].count > 0);
  const whole = parts.reduce((sum, coin) => sum + coin[side].qort, 0n);
  if (!parts.length) return null;
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
        {label}
      </Typography>
      <Box
        aria-hidden
        sx={{ display: 'flex', gap: '2px', height: 12, borderRadius: 999, overflow: 'hidden' }}
      >
        {parts.map((coin) => (
          <Box
            key={coin.chain}
            sx={{
              flex: `${Math.max(whole ? Number(coin[side].qort) / Number(whole) : 1, 0.01)} 1 0`,
              bgcolor: coinAccent(theme, coin.chain),
            }}
          />
        ))}
      </Box>
      <Box component="ul" aria-label={label} sx={{ ...KEY_SX, mt: 1 }}>
        {parts.map((coin) => (
          <Box
            component="li"
            key={coin.chain}
            sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}
          >
            <CoinDot chain={coin.chain} />
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {COINS[coin.chain].code}{' '}
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {shareText(coin[side].qort, whole)}
              </Box>
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {' '}
                · {qortText(coin[side].qort)} for {coinText(coin[side].coin, coin.chain)}
              </Box>
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SideLine({ totals, chain }: { totals: SideTotals; chain: TradeChain }) {
  if (!totals.count) return <>none</>;
  const price = coinPerQort(totals.coin, totals.qort);
  return (
    <>
      {qortText(totals.qort)} for {coinText(totals.coin, chain)}
      <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
        {tradeCount(totals.count)}
        {price ? ` · on average ${price} ${COINS[chain].code} per QORT` : ''}
      </Box>
    </>
  );
}

const PAIRS_SX = {
  m: 0,
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  columnGap: 1.5,
  rowGap: 0.75,
  '& dt': { color: 'text.secondary' },
  '& dd': { m: 0, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' },
} as const;

export function CoinBreakdown({ summary }: { summary: PortalSummary }) {
  return (
    <>
      <ShareBar label="The QORT it sold, by the coin it got" coins={summary.coins} side="sold" />
      <ShareBar
        label="The QORT it bought, by the coin it paid"
        coins={summary.coins}
        side="bought"
      />
      <Box
        sx={{
          display: 'grid',
          gap: 1,
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        {summary.coins.map((coin) => (
          <Box key={coin.chain} sx={FIELD_BLOCK_SX}>
            <Typography
              component="h4"
              sx={{
                fontWeight: 700,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <CoinDot chain={coin.chain} />
              {coinName(coin.chain)}
            </Typography>
            <Typography component="dl" variant="body2" sx={{ ...PAIRS_SX, mt: 0.75 }}>
              <dt>Sold</dt>
              <dd>
                <SideLine totals={coin.sold} chain={coin.chain} />
              </dd>
              <dt>Bought</dt>
              <dd>
                <SideLine totals={coin.bought} chain={coin.chain} />
              </dd>
              <dt>When</dt>
              <dd>
                {coin.first === coin.last
                  ? formatDate(coin.first)
                  : `${formatDate(coin.first)} to ${formatDate(coin.last)}`}
              </dd>
            </Typography>
          </Box>
        ))}
      </Box>
    </>
  );
}

const OUTCOMES: readonly OfferOutcome[] = ['completed', 'ended', 'open'];

const OUTCOME_ICON: Record<OfferOutcome, typeof CheckCircleOutlinedIcon> = {
  completed: CheckCircleOutlinedIcon,
  ended: HighlightOffOutlinedIcon,
  open: ScheduleOutlinedIcon,
};

function outcomeColour(theme: Theme, outcome: OfferOutcome): string {
  if (outcome === 'completed') return theme.palette.success.main;
  if (outcome === 'open') return theme.palette.info.main;
  return alpha(theme.palette.text.primary, 0.28);
}

function OutcomeBar({ totals }: { totals: OfferTotals }) {
  const theme = useTheme();
  return (
    <Box
      aria-hidden
      sx={{ display: 'flex', gap: '2px', height: 10, borderRadius: 999, overflow: 'hidden' }}
    >
      {OUTCOMES.filter((outcome) => totals[outcome] > 0).map((outcome) => (
        <Box
          key={outcome}
          sx={{ flex: `${totals[outcome]} 1 0`, bgcolor: outcomeColour(theme, outcome) }}
        />
      ))}
    </Box>
  );
}

export function OffersBreakdown({
  total,
  byCoin,
  truncated,
}: {
  total: OfferTotals;
  byCoin: Array<OfferTotals & { chain: TradeChain | null }>;
  truncated: boolean;
}) {
  const theme = useTheme();
  const finished = total.completed + total.ended;
  return (
    <>
      <Typography variant="body2" color="text.secondary">
        Each offer is an AT holding the QORT offered. It completes when someone buys it, ends
        without a trade when it is cancelled or a buyer doesn’t finish, and is open until then.
      </Typography>
      <Box component="ul" aria-label="What each state means" sx={KEY_SX}>
        {OUTCOMES.map((outcome) => {
          const Icon = OUTCOME_ICON[outcome];
          return (
            <Box
              component="li"
              key={outcome}
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
            >
              <Icon aria-hidden sx={{ fontSize: 18, color: outcomeColour(theme, outcome) }} />
              <Typography variant="body2">{OUTCOME_LABEL[outcome]}</Typography>
            </Box>
          );
        })}
      </Box>
      <Box
        component="ul"
        aria-label="Trade offers by coin"
        sx={{ ...KEY_SX, flexDirection: 'column', gap: 1.25 }}
      >
        {byCoin.map((coin) => (
          <Box component="li" key={coin.chain ?? 'other'} sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}
            >
              {coin.chain ? <CoinDot chain={coin.chain} /> : null}
              <strong>{coin.chain ? COINS[coin.chain].name : 'Other contracts'}</strong>
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {plural(coin.made, 'offer')}: {offersLine(coin)}
              </Box>
            </Typography>
            <OutcomeBar totals={coin} />
          </Box>
        ))}
      </Box>
      <Typography variant="body2">
        {truncated ? 'Its newest ' : 'In all, '}
        {plural(total.made, 'offer')}.
        {finished
          ? ` Of those no longer open, ${shareText(BigInt(total.completed), BigInt(finished))} sold.`
          : ''}
        {total.open
          ? ` Its open ${total.open === 1 ? 'offer holds' : 'offers hold'} ${qortText(total.openQort)}.`
          : ''}
      </Typography>
    </>
  );
}

export function AssetBreakdown({ summary }: { summary: AssetTradesSummary }) {
  const theme = useTheme();
  const units = (atomic: bigint) => formatAtomic(atomic);
  return (
    <Box
      component="ul"
      aria-label="By Q-Asset"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gap: 1,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
      }}
    >
      {summary.assets.map((asset) => {
        const boughtPrice = qortPerUnit(asset.qortPaid, asset.bought);
        const soldPrice = qortPerUnit(asset.qortGot, asset.sold);
        return (
          <Box component="li" key={`${asset.assetId}:${asset.asset}`} sx={FIELD_BLOCK_SX}>
            <Typography
              component="h4"
              sx={{
                fontWeight: 700,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: asset.assetId > 0 ? assetAccent(theme, asset.assetId) : 'text.secondary',
                }}
              />
              <bdi dir="auto" style={{ overflowWrap: 'anywhere' }}>
                {asset.asset}
              </bdi>
            </Typography>
            <Typography component="dl" variant="body2" sx={{ ...PAIRS_SX, mt: 0.75 }}>
              <dt>Bought</dt>
              <dd>
                {asset.bought > 0n
                  ? `${units(asset.bought)}${asset.qortPaid > 0n ? ` for ${qortText(asset.qortPaid)}` : ''}${boughtPrice ? ` · ${boughtPrice} QORT each` : ''}`
                  : 'none'}
              </dd>
              <dt>Sold</dt>
              <dd>
                {asset.sold > 0n
                  ? `${units(asset.sold)}${asset.qortGot > 0n ? ` for ${qortText(asset.qortGot)}` : ''}${soldPrice ? ` · ${soldPrice} QORT each` : ''}`
                  : 'none'}
              </dd>
              <dt>Trades</dt>
              <dd>
                {formatCount(asset.count)}, latest {formatDate(asset.last)}
              </dd>
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function TradeFact({ trade }: { trade: PortalTrade }) {
  return (
    <>
      {formatAtomic(trade.qort)} QORT for {coinText(trade.coin, trade.chain)}
      <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
        {trade.other ? (
          <>
            {trade.side === 'sold' ? 'to ' : 'from '}
            <PersonInline address={trade.other} />,{' '}
          </>
        ) : null}
        {formatDate(trade.timestamp)}
      </Box>
    </>
  );
}

/** How many partners Highlights names. */
const TOP_PARTNERS = 5;

export function Highlights({ summary }: { summary: PortalSummary }) {
  const average = (totals: SideTotals) =>
    totals.count ? qortText(totals.qort / BigInt(totals.count)) : null;
  const averageSale = average(summary.sold);
  const averageBuy = average(summary.bought);
  const partners = summary.partners.slice(0, TOP_PARTNERS);
  return (
    <>
      <Typography component="dl" variant="body2" sx={PAIRS_SX}>
        {summary.biggestSale ? (
          <>
            <dt>Biggest sale</dt>
            <dd>
              <TradeFact trade={summary.biggestSale} />
            </dd>
          </>
        ) : null}
        {summary.biggestBuy ? (
          <>
            <dt>Biggest purchase</dt>
            <dd>
              <TradeFact trade={summary.biggestBuy} />
            </dd>
          </>
        ) : null}
        {averageSale ? (
          <>
            <dt>Average sale</dt>
            <dd>{averageSale}</dd>
          </>
        ) : null}
        {averageBuy ? (
          <>
            <dt>Average purchase</dt>
            <dd>{averageBuy}</dd>
          </>
        ) : null}
      </Typography>
      {partners.length ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
            {summary.partners.length > TOP_PARTNERS
              ? `The ${TOP_PARTNERS} accounts it traded with most, of ${formatCount(summary.partners.length)}`
              : 'The accounts it traded with'}
          </Typography>
          <Box
            component="ol"
            aria-label="The accounts it traded with most"
            sx={{ m: 0, pl: 3, display: 'flex', flexDirection: 'column', gap: 0.75 }}
          >
            {partners.map((partner) => (
              <Typography component="li" variant="body2" key={partner.address}>
                <PersonInline address={partner.address} />{' '}
                <Box component="span" sx={{ color: 'text.secondary' }}>
                  {tradeCount(partner.sold + partner.bought)} · {qortText(partner.qort)}
                  {partner.sold && partner.bought
                    ? ` (sold to them ${formatCount(partner.sold)}, bought from them ${formatCount(partner.bought)})`
                    : partner.sold
                      ? ', all sold to them'
                      : ', all bought from them'}
                </Box>
              </Typography>
            ))}
          </Box>
        </Box>
      ) : null}
    </>
  );
}
