/**
 * Over time: the QORT it sold (above the line) and bought (below it) on
 * Q-Trade, one bar per month, quarter or year (rules/explorer/
 * portalTrades.ts volumeByPeriod), each stacked by coin in the coin's
 * colour (coinAccent), sold and bought on one scale. Pointing at a bar, or
 * moving to it with ← → once the chart has the focus (Home and End go to
 * the ends), shows that period's figures under the chart, read out as they
 * change; the latest period's show first. A key names the coins, and "Show
 * as a table" lists every period that had a trade.
 */
import { useId, useState, type KeyboardEvent } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { coinAccent } from '../../../../components/explorer/coinAccent';
import { useViewState } from '../../../../hooks/useViewState';
import {
  COINS,
  periodLabel,
  TRADE_CHAINS,
  type PeriodUnit,
  type VolumePeriod,
} from '../../../../rules/explorer/portalTrades';
import { formatCount } from '../../../../utils/format';
import { CoinDot } from './TradeLists';
import { qortText, tradeCount, UNIT_WORDS } from './tradesWords';

/** The bars' height, sold and bought together (px). */
const PLOT = 168;
/** A bar part never thinner than this, so a small trade still shows (px). */
const MIN_PART = 2;

/** One side of a period, by coin, in words. */
function sideWords(byCoin: VolumePeriod['sold'], qort: bigint, count: number): string {
  if (!count) return 'none';
  const coins = TRADE_CHAINS.filter((chain) => byCoin[chain]);
  const split =
    coins.length > 1
      ? ` (${coins.map((chain) => `${COINS[chain].code} ${qortText(byCoin[chain] ?? 0n)}`).join(', ')})`
      : coins.length
        ? ` for ${COINS[coins[0]].code}`
        : '';
  return `${qortText(qort)} in ${tradeCount(count)}${split}`;
}

function periodWords(period: VolumePeriod, unit: PeriodUnit): string {
  return `${periodLabel(period.start, unit)}: sold ${sideWords(period.sold, period.soldQort, period.soldCount)}; bought ${sideWords(period.bought, period.boughtQort, period.boughtCount)}.`;
}

/** One side's stack: its coins in TRADE_CHAINS order from the line outward. */
function BarStack({
  byCoin,
  scale,
  height,
  up,
}: {
  byCoin: VolumePeriod['sold'];
  /** px per atomic QORT. */
  scale: number;
  height: number;
  up: boolean;
}) {
  const theme = useTheme();
  const parts = TRADE_CHAINS.flatMap((chain) => {
    const value = byCoin[chain];
    return value ? [{ chain, px: Math.max(MIN_PART, Number(value) * scale) }] : [];
  });
  return (
    <Box
      aria-hidden
      sx={{
        height,
        display: 'flex',
        flexDirection: up ? 'column-reverse' : 'column',
        gap: '2px',
        overflow: 'hidden',
        // The far end of the bar is rounded, its end at the line square.
        '& > :last-of-type': up
          ? { borderTopLeftRadius: 4, borderTopRightRadius: 4 }
          : { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
      }}
    >
      {parts.map((part) => (
        <Box
          key={part.chain}
          sx={{ height: part.px, flexShrink: 0, bgcolor: coinAccent(theme, part.chain) }}
        />
      ))}
    </Box>
  );
}

export function VolumeChart({ periods, unit }: { periods: VolumePeriod[]; unit: PeriodUnit }) {
  const theme = useTheme();
  const id = useId();
  const [table, setTable] = useViewState('trades:chart-table', false);
  const [picked, setPicked] = useState(periods.length - 1);
  const at = Math.min(Math.max(picked, 0), periods.length - 1);
  if (!periods.length) return null;
  const coins = TRADE_CHAINS.filter((chain) =>
    periods.some((period) => period.sold[chain] || period.bought[chain])
  );
  const maxSold = periods.reduce((max, p) => (p.soldQort > max ? p.soldQort : max), 0n);
  const maxBought = periods.reduce((max, p) => (p.boughtQort > max ? p.boughtQort : max), 0n);
  // One scale for both sides: the tallest sale and the tallest purchase share the plot.
  const total = Number(maxSold) + Number(maxBought);
  const scale = total ? PLOT / total : 0;
  const topHeight = Math.round(Number(maxSold) * scale);
  const bottomHeight = PLOT - topHeight;
  const word = UNIT_WORDS[unit];
  const current = periods[at];
  const optionId = (i: number) => `${id}-period-${i}`;

  const onKey = (event: KeyboardEvent) => {
    const next =
      event.key === 'ArrowRight'
        ? at + 1
        : event.key === 'ArrowLeft'
          ? at - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? periods.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setPicked(Math.min(Math.max(next, 0), periods.length - 1));
  };

  const traded = periods.filter((period) => period.soldCount || period.boughtCount);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Box
          component="ul"
          aria-label="Coins"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            flex: 1,
          }}
        >
          {coins.map((chain) => (
            <Box
              component="li"
              key={chain}
              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
            >
              <CoinDot chain={chain} />
              <Typography variant="body2">{COINS[chain].name}</Typography>
            </Box>
          ))}
        </Box>
        <Button
          size="small"
          startIcon={table ? <BarChartOutlinedIcon /> : <TableChartOutlinedIcon />}
          onClick={() => setTable(!table)}
          sx={{ minHeight: 44 }}
        >
          {table ? 'Show as a chart' : 'Show as a table'}
        </Button>
      </Box>
      {table ? (
        // Focusable, so a keyboard can scroll it sideways on a narrow screen.
        <TableContainer
          tabIndex={0}
          role="region"
          aria-label={`By ${word}, as a table`}
          sx={{
            overflowX: 'auto',
            borderRadius: 1,
            '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          <Table size="small" aria-label={`QORT sold and bought on Q-Trade, by ${word}`}>
            <TableHead>
              <TableRow>
                <TableCell>{word[0].toUpperCase() + word.slice(1)}</TableCell>
                <TableCell align="right">Sold</TableCell>
                <TableCell align="right">Sales</TableCell>
                <TableCell align="right">Bought</TableCell>
                <TableCell align="right">Purchases</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...traded].reverse().map((period) => (
                <TableRow key={period.start}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {periodLabel(period.start, unit)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {period.soldCount ? qortText(period.soldQort) : '–'}
                  </TableCell>
                  <TableCell align="right">{formatCount(period.soldCount)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {period.boughtCount ? qortText(period.boughtQort) : '–'}
                  </TableCell>
                  <TableCell align="right">{formatCount(period.boughtCount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <>
          {maxSold > 0n ? (
            <Typography variant="caption" color="text.secondary">
              Sold, up to {qortText(maxSold)} in a {word}
            </Typography>
          ) : null}
          <Box
            role="listbox"
            tabIndex={0}
            aria-label={`QORT sold and bought on Q-Trade, by ${word}. The arrow keys move between them.`}
            aria-activedescendant={optionId(at)}
            onKeyDown={onKey}
            sx={{
              display: 'flex',
              alignItems: 'stretch',
              gap: periods.length > 40 ? '1px' : '2px',
              borderRadius: 1,
              outline: 'none',
              '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            {periods.map((period, i) => (
              <Box
                key={period.start}
                id={optionId(i)}
                role="option"
                aria-selected={i === at}
                aria-label={periodWords(period, unit)}
                onPointerEnter={() => setPicked(i)}
                onClick={() => setPicked(i)}
                sx={{
                  flex: '1 1 0',
                  minWidth: 2,
                  maxWidth: 48,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 1,
                  cursor: 'default',
                  bgcolor: i === at ? alpha(theme.palette.text.primary, 0.07) : 'transparent',
                }}
              >
                <BarStack byCoin={period.sold} scale={scale} height={topHeight} up />
                <Box aria-hidden sx={{ height: '1px', flexShrink: 0, bgcolor: 'divider' }} />
                <BarStack byCoin={period.bought} scale={scale} height={bottomHeight} up={false} />
              </Box>
            ))}
          </Box>
          {maxBought > 0n ? (
            <Typography variant="caption" color="text.secondary">
              Bought, up to {qortText(maxBought)} in a {word}
            </Typography>
          ) : null}
          <Box
            aria-hidden
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 1,
              color: 'text.secondary',
              typography: 'caption',
            }}
          >
            <span>{periodLabel(periods[0].start, unit)}</span>
            {periods.length > 1 ? (
              <span>{periodLabel(periods[periods.length - 1].start, unit)}</span>
            ) : null}
          </Box>
          <Typography
            variant="body2"
            aria-live="polite"
            sx={{ minHeight: '3em', overflowWrap: 'anywhere' }}
          >
            <strong>{periodLabel(current.start, unit)}</strong>: sold{' '}
            {sideWords(current.sold, current.soldQort, current.soldCount)}; bought{' '}
            {sideWords(current.bought, current.boughtQort, current.boughtCount)}.
          </Typography>
        </>
      )}
    </Box>
  );
}
