/**
 * Checks across a set of accounts, each run only when asked, two accounts
 * at a time, with progress and Stop (a read already running finishes; its
 * answer is kept for next time):
 *
 * - "Who made their first QORT payment": where each one's first QORT came
 *   from, grouped by the payer ("H made the first QORT payment to 7 of
 *   these 48 accounts. H has sent 500+ payments.");
 * - "Where their QORT went": each one's latest 100 payments sent, grouped
 *   by the recipient ("K received QORT from 9 of these 48 accounts: 23
 *   payments, 1,200 QORT"), AT addresses left out and counted.
 *
 * Facts with their denominators; what wasn't read says so.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Box, Button, LinearProgress, Typography } from '@mui/material';
import { Card, Section } from '../../../components/common/Section';
import { TxSentence } from '../../../components/explorer/TxSentence';
import type { Funding } from '../../../data/explorer/account';
import {
  checkFirstFunding,
  checkPaymentsSent,
  type Checked,
  type SetProgress,
} from '../../../data/explorer/sets';
import type { PaymentPage } from '../../../data/explorer/money';
import type { TxRow } from '../../../data/types';
import { bandWords, groupFirstPayers } from '../../../rules/explorer/connections';
import { wentTo, wentToParts } from '../../../rules/explorer/money';
import { formatCount, plural } from '../../../utils/format';
import { usePayerBands } from '../account/connections/hooks';
import { FOCUSABLE_ROW_SX, useFocusNewRows } from '../account/names/useShowMore';
import { SET_LIST_SX } from './SponseeRows';

/** Result rows shown before "Show more". */
const ROWS = 20;

type Run<T> =
  | { state: 'idle' }
  | { state: 'running'; progress: SetProgress }
  | { state: 'done'; stopped: boolean; progress: SetProgress; results: Map<string, Checked<T>> };

function useRun<T>(
  accounts: readonly string[],
  check: (
    accounts: readonly string[],
    options: { signal: AbortSignal; onProgress: (p: SetProgress) => void }
  ) => Promise<Map<string, Checked<T>>>
) {
  const [run, setRun] = useState<Run<T>>({ state: 'idle' });
  const stopper = useRef<AbortController | null>(null);
  const start = async () => {
    const stop = new AbortController();
    stopper.current = stop;
    setRun({ state: 'running', progress: { done: 0, total: accounts.length } });
    let last: SetProgress = { done: 0, total: accounts.length };
    const results = await check(accounts, {
      signal: stop.signal,
      onProgress: (progress) => {
        last = progress;
        setRun({ state: 'running', progress });
      },
    });
    setRun({ state: 'done', stopped: stop.signal.aborted, progress: last, results });
  };
  return { run, start, stop: () => stopper.current?.abort() };
}

function CheckCard({
  title,
  id,
  about,
  total,
  run,
  onStart,
  onStop,
  children,
}: {
  title: string;
  id: string;
  about: string;
  total: number;
  run: Run<unknown>;
  onStart: () => void;
  onStop: () => void;
  children: ReactNode;
}) {
  const progress = run.state === 'idle' ? null : run.progress;
  const running = run.state === 'running';
  return (
    <Card
      as="section"
      aria-labelledby={`${id}-title`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography id={`${id}-title`} component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {about}
      </Typography>
      {/* Said once when a check starts; the count runs on screen and in the bar. */}
      <span role="status" className="qmp-visually-hidden">
        {running ? `Checking ${plural(total, 'account')}…` : ''}
      </span>
      {running && progress ? (
        <LinearProgress
          variant="determinate"
          value={progress.total ? (progress.done / progress.total) * 100 : 0}
          aria-label={`${title}: progress`}
        />
      ) : null}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        {running && progress ? (
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
            Checked {formatCount(progress.done)} of {plural(progress.total, 'account')}…
          </Typography>
        ) : null}
        {/* One button that stays (start, Stop, Check again): the focus stays on it. */}
        <Button
          variant={running ? 'text' : 'outlined'}
          onClick={running ? onStop : onStart}
          disabled={!running && total === 0}
          sx={{ minHeight: 44 }}
        >
          {running
            ? 'Stop'
            : run.state === 'done'
              ? 'Check again'
              : `Check ${plural(total, 'account')}`}
        </Button>
      </Box>
      {run.state === 'done' ? (
        <Typography role="status" variant="body2" color="text.secondary">
          {run.stopped
            ? `Stopped after ${formatCount(run.progress.done)} of ${plural(run.progress.total, 'account')}.`
            : `Checked all ${plural(run.progress.total, 'account')}.`}
        </Typography>
      ) : null}
      {children}
    </Card>
  );
}

function FirstPayers({
  results,
  total,
}: {
  results: Map<string, Checked<Funding | null>>;
  total: number;
}) {
  const [limit, setLimit] = useState(ROWS);
  const { listRef, focusFrom } = useFocusNewRows();
  const funding = new Map<string, Funding | null>();
  let failed = 0;
  for (const [address, checked] of results) {
    if (checked.ok) funding.set(address, checked.value);
    else failed += 1;
  }
  const grouped = groupFirstPayers(funding);
  const shown = grouped.payers.slice(0, limit);
  const bands = usePayerBands(shown.map((payer) => payer.from));
  return (
    <>
      {shown.length ? (
        <Box
          component="ul"
          ref={listRef}
          aria-label="First QORT payments by payer"
          sx={SET_LIST_SX}
        >
          {shown.map((payer) => {
            const words = bandWords(bands[payer.from]);
            return (
              <Typography
                component="li"
                key={payer.from}
                tabIndex={-1}
                sx={{ overflowWrap: 'anywhere', ...FOCUSABLE_ROW_SX }}
              >
                <TxSentence
                  parts={[
                    { kind: 'account', address: payer.from },
                    {
                      kind: 'text',
                      text: ` made the first QORT payment to ${formatCount(payer.accounts.length)} of these ${plural(total, 'account')}.`,
                    },
                    ...(words
                      ? [
                          { kind: 'text' as const, text: ' ' },
                          { kind: 'account' as const, address: payer.from },
                          { kind: 'text' as const, text: ` ${words}.` },
                        ]
                      : []),
                  ]}
                />
              </Typography>
            );
          })}
        </Box>
      ) : (
        <Typography variant="body2">No first QORT payments found among those checked.</Typography>
      )}
      {grouped.payers.length > shown.length ? (
        <Button
          onClick={() => {
            focusFrom(shown.length);
            setLimit((n) => n + ROWS);
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show more ({formatCount(grouped.payers.length - shown.length)} more)
        </Button>
      ) : null}
      {grouped.other || grouped.none || failed ? (
        <Typography variant="body2" color="text.secondary">
          {[
            grouped.other
              ? `${plural(grouped.other, 'account')} had another first transaction (a reward share, a level move, an asset transfer, an AT or the genesis block)`
              : null,
            grouped.none ? `none found for ${plural(grouped.none, 'account')}` : null,
            failed ? `${plural(failed, 'account')} couldn’t be read` : null,
          ]
            .filter(Boolean)
            .join('; ')}
          .
        </Typography>
      ) : null}
    </>
  );
}

function WentTo({ results, total }: { results: Map<string, Checked<PaymentPage>>; total: number }) {
  const [limit, setLimit] = useState(ROWS);
  const { listRef, focusFrom } = useFocusNewRows();
  const sent = new Map<string, TxRow[]>();
  let failed = 0;
  for (const [address, checked] of results) {
    if (checked.ok) sent.set(address, checked.value.rows);
    else failed += 1;
  }
  const { recipients, atLeftOut } = wentTo(sent);
  const shown = recipients.slice(0, limit);
  return (
    <>
      {shown.length ? (
        <Box component="ul" ref={listRef} aria-label="Where their QORT went" sx={SET_LIST_SX}>
          {shown.map((entry) => (
            <Typography
              component="li"
              key={entry.address}
              tabIndex={-1}
              sx={{ overflowWrap: 'anywhere', ...FOCUSABLE_ROW_SX }}
            >
              <TxSentence
                parts={[
                  ...wentToParts(entry, total),
                  { kind: 'text', text: ', in each one’s latest 100 payments' },
                ]}
              />
            </Typography>
          ))}
        </Box>
      ) : (
        <Typography variant="body2">No QORT payments sent among those checked.</Typography>
      )}
      {recipients.length > shown.length ? (
        <Button
          onClick={() => {
            focusFrom(shown.length);
            setLimit((n) => n + ROWS);
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show more ({formatCount(recipients.length - shown.length)} more)
        </Button>
      ) : null}
      {atLeftOut || failed ? (
        <Typography variant="body2" color="text.secondary">
          {[
            atLeftOut
              ? `Payments to ${plural(atLeftOut, 'AT address', 'AT addresses')} (automated contracts) are left out`
              : null,
            failed ? `${plural(failed, 'account')} couldn’t be read` : null,
          ]
            .filter(Boolean)
            .join('; ')}
          .
        </Typography>
      ) : null}
    </>
  );
}

export function SetChecks({ accounts, scope }: { accounts: readonly string[]; scope: string }) {
  const first = useRun<Funding | null>(accounts, (list, options) =>
    checkFirstFunding(list, options)
  );
  const went = useRun<PaymentPage>(accounts, (list, options) =>
    checkPaymentsSent(list, { ...options, scope })
  );
  const total = accounts.length;
  return (
    <Section title="Checks across these accounts" id="set-checks">
      <CheckCard
        title="Who made their first QORT payment"
        id="set-first-payers"
        about="Where each account’s first QORT came from, grouped by who paid it. Two accounts at a time."
        total={total}
        run={first.run as Run<unknown>}
        onStart={() => void first.start()}
        onStop={first.stop}
      >
        {first.run.state === 'done' ? (
          <FirstPayers results={first.run.results} total={total} />
        ) : null}
      </CheckCard>
      <CheckCard
        title="Where their QORT went"
        id="set-went-to"
        about="Each account’s latest 100 QORT payments sent, grouped by who received them. Two accounts at a time."
        total={total}
        run={went.run as Run<unknown>}
        onStart={() => void went.start()}
        onStop={went.stop}
      >
        {went.run.state === 'done' ? <WentTo results={went.run.results} total={total} /> : null}
      </CheckCard>
    </Section>
  );
}
