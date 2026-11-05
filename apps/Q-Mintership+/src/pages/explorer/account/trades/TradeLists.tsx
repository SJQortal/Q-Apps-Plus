/**
 * The Trades tab's lists, newest first, 10 at a time ("Show more"):
 *
 * - Q-Trade: each completed trade, sold or bought, how much QORT for how
 *   much of which coin, at what price, with whom, when, and its AT. All,
 *   Sold or Bought, and with more than one coin, which coin.
 * - Q-Asset trades: each trade of its filled orders in a sentence (as
 *   Connections says them), with when and the block.
 *
 * What is picked and how far it is shown stays for Back (useViewState).
 */
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Link,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PersonInline } from '../../../../components/common/Person';
import { coinAccent } from '../../../../components/explorer/coinAccent';
import { DirectionMark } from '../../../../components/explorer/DirectionMark';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { TxSentence } from '../../../../components/explorer/TxSentence';
import type { AccountTrades } from '../../../../data/explorer/trades';
import { useViewState } from '../../../../hooks/useViewState';
import { explorerAccountPath } from '../../../../routes/paths';
import { formatAtomic } from '../../../../rules/explorer/money';
import {
  COINS,
  coinPerQort,
  coinWords,
  TRADE_CHAINS,
  type PortalTrade,
  type TradeChain,
} from '../../../../rules/explorer/portalTrades';
import { tradeParts, tradesCoverage } from '../../../../rules/explorer/trades';
import { formatBlock, formatCount, formatDateTime } from '../../../../utils/format';
import { FOCUSABLE_ROW_SX, useFocusNewRows } from '../names/useShowMore';
import { ROW_LIST_SX } from '../connections/ConnectionRow';
import { SIDE_LABEL } from './tradesWords';

const PAGE_ROWS = 10;

type SideFilter = 'all' | 'sold' | 'bought';

/** A coin's colour as a dot, beside its code. */
export function CoinDot({ chain, size = 10 }: { chain: TradeChain; size?: number }) {
  const theme = useTheme();
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: coinAccent(theme, chain),
        flexShrink: 0,
        verticalAlign: 'baseline',
      }}
    />
  );
}

const ROW_SX = {
  ...FIELD_BLOCK_SX,
  ...FOCUSABLE_ROW_SX,
  display: 'flex',
  gap: 1.25,
  alignItems: 'flex-start',
} as const;

function PortalTradeRow({ trade }: { trade: PortalTrade }) {
  const { code } = COINS[trade.chain];
  const price = coinPerQort(trade.coin, trade.qort);
  return (
    <Box component="li" tabIndex={-1} sx={ROW_SX}>
      <Box sx={{ pt: 0.25 }}>
        <DirectionMark flow={trade.side === 'sold' ? 'out' : 'in'} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography component="div" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {SIDE_LABEL[trade.side]} <strong>{formatAtomic(trade.qort)} QORT</strong> for{' '}
          <strong>
            {coinWords(trade.coin)} {code}
          </strong>
          {trade.other ? (
            <>
              {trade.side === 'sold' ? ' to ' : ' from '}
              <PersonInline address={trade.other} />
            </>
          ) : null}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 0.75 }}
        >
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <CoinDot chain={trade.chain} />
            {COINS[trade.chain].name}
          </Box>
          {price ? (
            <span>
              · {price} {code} per QORT
            </span>
          ) : null}
          <span>· {formatDateTime(trade.timestamp)}</span>
          <span>
            ·{' '}
            <Link component={RouterLink} to={explorerAccountPath(trade.at)}>
              Its AT
            </Link>
          </span>
        </Typography>
      </Box>
    </Box>
  );
}

export function PortalTradeList({ trades }: { trades: readonly PortalTrade[] }) {
  const coins = TRADE_CHAINS.filter((chain) => trades.some((trade) => trade.chain === chain));
  const [side, setSide] = useViewState<SideFilter>('trades:side', 'all');
  const [picked, setCoin] = useViewState<TradeChain | 'all'>('trades:coin', 'all');
  const [limit, setLimit] = useViewState('trades:limit', PAGE_ROWS);
  const { listRef, focusFrom } = useFocusNewRows();
  const coin = picked !== 'all' && coins.includes(picked) ? picked : 'all';
  const ofCoin = trades.filter((trade) => coin === 'all' || trade.chain === coin);
  const count = (which: SideFilter) =>
    which === 'all' ? ofCoin.length : ofCoin.filter((trade) => trade.side === which).length;
  const shown = ofCoin.filter((trade) => side === 'all' || trade.side === side);
  const visible = shown.slice(0, limit);
  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={side}
          onChange={(_, value: SideFilter | null) => {
            if (value) setSide(value);
          }}
          aria-label="Which trades"
        >
          {(['all', 'sold', 'bought'] as const).map((which) => (
            <ToggleButton key={which} value={which} sx={{ minHeight: 44, px: 1.5 }}>
              {which === 'all' ? 'All' : SIDE_LABEL[which]} ({formatCount(count(which))})
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {coins.length > 1 ? (
          <TextField
            select
            size="small"
            label="Coin"
            value={coin}
            onChange={(event) => setCoin(event.target.value as TradeChain | 'all')}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">Every coin</MenuItem>
            {coins.map((chain) => (
              <MenuItem key={chain} value={chain}>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                  <CoinDot chain={chain} />
                  {COINS[chain].name}
                </Box>
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Box>
      {visible.length ? (
        <Box
          component="ul"
          ref={listRef}
          aria-label="Its Q-Trade trades, newest first"
          sx={ROW_LIST_SX}
        >
          {visible.map((trade) => (
            <PortalTradeRow key={`${trade.side}:${trade.at}`} trade={trade} />
          ))}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          None of these.
        </Typography>
      )}
      {shown.length > visible.length ? (
        <Button
          onClick={() => {
            focusFrom(visible.length);
            setLimit((value) => value + PAGE_ROWS);
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show more ({formatCount(shown.length - visible.length)} more)
        </Button>
      ) : null}
    </>
  );
}

export function AssetTradeList({ data }: { data: AccountTrades }) {
  const [limit, setLimit] = useViewState('trades:assets:limit', PAGE_ROWS);
  const { listRef, focusFrom } = useFocusNewRows();
  const visible = data.trades.slice(0, limit);
  return (
    <>
      <Box
        component="ul"
        ref={listRef}
        aria-label="Its Q-Asset trades, newest first"
        sx={ROW_LIST_SX}
      >
        {visible.map((trade) => (
          <Box
            component="li"
            key={`${trade.orderId}:${trade.otherOrderId}:${trade.timestamp}`}
            tabIndex={-1}
            sx={ROW_SX}
          >
            <Box sx={{ pt: 0.25 }}>
              <DirectionMark flow={trade.got.assetId === 0 ? 'in' : 'out'} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography component="div" variant="body2">
                <TxSentence parts={tradeParts(trade)} />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDateTime(trade.timestamp)}
                {trade.height ? ` · ${formatBlock(trade.height)}` : ''}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      {data.trades.length > visible.length ? (
        <Button
          onClick={() => {
            focusFrom(visible.length);
            setLimit((value) => value + PAGE_ROWS);
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show more ({formatCount(data.trades.length - visible.length)} more)
        </Button>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        {tradesCoverage(data)}
      </Typography>
    </>
  );
}
