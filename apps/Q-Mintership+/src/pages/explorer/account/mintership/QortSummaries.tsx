/**
 * QORT minted, purchased / sold and received / sent (Simon, 2026-10-17:
 * "add: QORT Minted, and QORT Purchased/QORT Sold (in one), QORT Received/
 * Sent (in one) summaries. Make sure the QORT Minted is calculated
 * correctly"), a row under the Minter Profile's facts, each with an ⓘ that
 * says how it was worked out (rules/explorer/qortBook.ts).
 *
 * They need the account's whole history: the list Activity and the
 * Transactions tab share (`xtx:<a>:all`). It reads on by itself up to the
 * amount Activity reads first (Settings, 1,000 by default); a longer
 * history waits for "Read the rest", which reads 1,000 at a time. Then:
 * its exact balance, its asset orders with QORT on one side, and its own
 * trade contracts' payouts (data/explorer/qortBook.ts).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useAtomValue } from 'jotai';
import { InfoTip } from '../../../../components/common/InfoTip';
import { ErrorState } from '../../../../components/common/states';
import { accountTxKey, getAccountTx } from '../../../../data/explorer/accountTx';
import { HeavyCancelled } from '../../../../data/explorer/heavy';
import { getBalanceAtomic, getOrdersQort, getSoldQort } from '../../../../data/explorer/qortBook';
import { useQuery } from '../../../../hooks/useQuery';
import { formatAtomic } from '../../../../rules/explorer/money';
import { qortBook, qortMinted, type QortBook } from '../../../../rules/explorer/qortBook';
import { activityFirstReadAtom, clampActivityRead } from '../../../../state/settings';
import { formatCount } from '../../../../utils/format';
import { Fact } from './parts';

/** Its own contracts read for "sold" at most; past that it isn't added up. */
const SOLD_MAX_ATS = 500;
/** Rows a "Read the rest" read asks for at a time. */
const REST_PAGE = 1000;

/** "19,306", "4.75", "0": whole QORT from 100 up, two decimals below. */
function short(value: bigint): string {
  const n = Number(value) / 1e8;
  const digits = Math.abs(n) >= 100 ? 0 : 2;
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** "received 8,520.29 QORT, sent 51,169.00 QORT, …": the parts that moved. */
function movedWords(book: QortBook, orders: bigint): string {
  const parts: Array<[string, bigint]> = [
    ['received', book.received],
    ['sent', book.sent],
    ['bought through trade contracts', book.purchased],
    ['paid back by its own contracts', book.returned],
    ['put into its own contracts', book.deployed],
    ['names (sold less bought)', book.names],
    ['asset orders', orders],
    ['given when the chain began', book.genesis],
    ['fees', book.fees],
  ];
  return parts
    .filter(([, value]) => value !== 0n)
    .map(
      ([what, value]) =>
        `${what} ${value < 0n ? '−' : ''}${formatAtomic(value < 0n ? -value : value)}`
    )
    .join(', ');
}

function Value({ children, info, label }: { children: ReactNode; info?: string; label: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {children}
      {info ? <InfoTip label={`About ${label}: ${info}`}>{info}</InfoTip> : null}
    </Box>
  );
}

export function QortSummaries({ address }: { address: string }) {
  const firstRead = clampActivityRead(useAtomValue(activityFirstReadAtom));
  const list = useQuery(accountTxKey(address, []), (force) => getAccountTx(address, [], { force }));
  const [wantAll, setWantAll] = useState(false);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState<unknown>(null);
  const busy = useRef(false);
  const data = list.data;
  const held = data?.rows.length ?? 0;
  const done = data?.done ?? false;

  // Reads on by itself up to Activity's first read; all of it once asked.
  useEffect(() => {
    if (!data || done || busy.current || reading || failed) return;
    if (!wantAll && held >= firstRead) return;
    busy.current = true;
    setReading(true);
    const pageSize = wantAll ? REST_PAGE : Math.max(100, Math.min(REST_PAGE, firstRead - held));
    getAccountTx(address, [], { older: true, pageSize })
      .catch((error: unknown) => {
        if (!(error instanceof HeavyCancelled)) setFailed(error);
      })
      .finally(() => {
        busy.current = false;
        setReading(false);
      });
  }, [address, data, done, reading, failed, held, firstRead, wantAll]);

  const rows = done ? data?.rows : undefined;
  const book = rows ? qortBook(rows, address) : null;
  const balance = useQuery(book ? `xbalance:${address}` : null, (force) =>
    getBalanceAtomic(address, { force })
  );
  const orderIds = book?.orders ?? [];
  const orders = useQuery(
    book && orderIds.length ? `xordersq:${address}:${orderIds.length}` : null,
    () => getOrdersQort(address, orderIds)
  );
  const ats = book?.ownAts ?? [];
  const soldRead = useQuery(
    book && ats.length && ats.length <= SOLD_MAX_ATS ? `xsold:${address}:${ats.length}` : null,
    () => getSoldQort(address, ats)
  );

  const error = failed ?? (list.isError && !data ? list.error : null);
  const ordersNet = orderIds.length ? orders.data : 0n;
  const sold = !ats.length ? 0n : ats.length > SOLD_MAX_ATS ? null : soldRead.data;
  const waiting = '…';

  let minted: ReactNode = waiting;
  let mintedInfo: string | undefined;
  if (book && balance.data !== undefined && ordersNet !== undefined) {
    const value = qortMinted(balance.data, book, ordersNet);
    const how = `Its balance now, ${formatAtomic(balance.data)} QORT, less what its transactions moved (${movedWords(book, ordersNet)}). The rest reached it without a transaction of its own: minting rewards, which include the transaction fees paid to minters, the extra share for online Minter Admins and Dev Admins, and the legacy QORA holders' share.`;
    if (value < 0n) {
      minted = 'Unknown';
      mintedInfo = `Its transactions don't add up to its balance, so it can't be worked out. ${how}`;
    } else {
      minted = `${short(value)} QORT`;
      mintedInfo = `${formatAtomic(value)} QORT. ${how}`;
    }
  }
  const tradesInfo = book
    ? `Through trade contracts (the Trade Portal's): purchased is the QORT other people's contracts paid it, ${formatAtomic(book.purchased)}; sold is the QORT its own contracts paid to buyers${
        sold === null
          ? `, not added up: it has ${formatCount(ats.length)} contracts of its own`
          : sold !== undefined
            ? `, ${formatAtomic(sold)}`
            : ''
      }.`
    : undefined;
  const flowsInfo = book
    ? `Payments, transfers and multi-payments in QORT: received ${formatAtomic(book.received)}, sent ${formatAtomic(book.sent)}.`
    : undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        component="dl"
        aria-label="QORT summaries"
        sx={{
          m: 0,
          display: 'grid',
          gap: 1,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <Fact
          label="QORT minted"
          value={
            <Value label="QORT minted" info={mintedInfo}>
              {minted}
            </Value>
          }
        />
        <Fact
          label="QORT purchased / sold"
          value={
            <Value label="QORT purchased / sold" info={tradesInfo}>
              {book
                ? `${short(book.purchased)} / ${sold === null ? '?' : sold === undefined ? waiting : short(sold)}`
                : waiting}
            </Value>
          }
        />
        <Fact
          label="QORT received / sent"
          value={
            <Value label="QORT received / sent" info={flowsInfo}>
              {book ? `${short(book.received)} / ${short(book.sent)}` : waiting}
            </Value>
          }
        />
      </Box>
      {error ? (
        <ErrorState
          compact
          title="Couldn't read its transactions to add these up."
          error={error}
          onRetry={() => {
            setFailed(null);
            if (list.isError) void list.refetch();
          }}
        />
      ) : balance.isError || orders.isError || soldRead.isError ? (
        <ErrorState
          compact
          title="Couldn't read its balance, asset orders or contracts to add these up."
          error={balance.error ?? orders.error ?? soldRead.error}
          onRetry={() => {
            if (balance.isError) void balance.refetch();
            if (orders.isError) void orders.refetch();
            if (soldRead.isError) void soldRead.refetch();
          }}
        />
      ) : !done && data && !wantAll && held >= firstRead ? (
        <Box
          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, px: 0.5 }}
        >
          <Typography variant="body2" color="text.secondary">
            These add up its whole history: {formatCount(held)}+ transactions read so far.
          </Typography>
          <Button size="small" onClick={() => setWantAll(true)} sx={{ minHeight: 44 }}>
            Read the rest
          </Button>
        </Box>
      ) : !done ? (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          Reading its transactions to add these up… {held ? `${formatCount(held)} so far.` : ''}
        </Typography>
      ) : null}
    </Box>
  );
}
