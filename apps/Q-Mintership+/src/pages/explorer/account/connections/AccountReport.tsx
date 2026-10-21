/**
 * Connections → Account report (Simon, 2026-10-21: Core's own report and
 * the facts note become one button, which makes a .md file of everything
 * known on chain about the account and its connections, human-readable and
 * transparent, and saves it). The dialog recommends reading the account's
 * whole history first, and can read it there (1,000 at a time, through the
 * heavy-read limiter, with Stop); then Make the report gathers the rest
 * (data/explorer/accountReport.ts), shows it, and offers Save .md (Hub's
 * SAVE_FILE, or a download outside Hub) and Copy. Nothing is written to
 * the chain; Core's sponsorship report (1 to 5 seconds) is read as part of
 * it. The same report every time, so reports of accounts read alike.
 */
import { useId, useRef, useState } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SaveAltOutlinedIcon from '@mui/icons-material/SaveAltOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import { ResponsiveDialog } from '../../../../components/common/ResponsiveDialog';
import { ErrorState } from '../../../../components/common/states';
import { MONO } from '../../../../components/explorer/RawJson';
import { Card, Section } from '../../../../components/common/Section';
import {
  accountTxKey,
  getAccountTx,
  type AccountTxList,
} from '../../../../data/explorer/accountTx';
import { gatherAccountReport } from '../../../../data/explorer/accountReport';
import { HeavyCancelled } from '../../../../data/explorer/heavy';
import { useStoreValues } from '../../../../hooks/useStoreValues';
import { hasQortalRequest, qortal } from '../../../../qortal/client';
import { accountReportMarkdown, reportFilename } from '../../../../rules/explorer/accountReport';
import { formatCount, plural } from '../../../../utils/format';
import { isHubDecline } from '../../../../utils/hubErrors';
import { copyText } from '../../../../utils/links';
import { EXPLORER_NEUTRAL_LINE } from '../../explorerWords';

/** Rows a read of the whole history asks for at a time. */
const READ_PAGE = 1000;

/** Saves `text` as a .md file: Hub asks where; outside Hub, a download. */
async function saveMarkdown(filename: string, text: string): Promise<'saved' | 'declined'> {
  const blob = new Blob([text], { type: 'text/markdown' });
  if (!hasQortalRequest()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'saved';
  }
  try {
    await qortal({ action: 'SAVE_FILE', blob, filename, mimeType: 'text/markdown' });
    return 'saved';
  } catch (error) {
    if (isHubDecline(error)) return 'declined';
    throw error;
  }
}

/** The whole history: read on, 1,000 at a time, until its first transaction or Stop. */
function useReadWhole(address: string) {
  const [list] = useStoreValues<AccountTxList>([accountTxKey(address, [])]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const stop = useRef(false);
  const start = async () => {
    stop.current = false;
    setError(null);
    setReading(true);
    try {
      let current = list ?? (await getAccountTx(address, []));
      while (!current.done && !stop.current)
        current = await getAccountTx(address, [], { older: true, pageSize: READ_PAGE });
    } catch (failure) {
      if (!(failure instanceof HeavyCancelled)) setError(failure);
    } finally {
      setReading(false);
    }
  };
  return {
    held: list?.rows.length ?? 0,
    done: list?.done ?? false,
    reading,
    error,
    start,
    stop: () => {
      stop.current = true;
    },
  };
}

export function AccountReport({ address, label }: { address: string; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Account report" id="connections-account-report">
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Typography variant="body2" color="text.secondary">
          Everything the Explorer reads on chain about this account and its connections, with Core’s
          own sponsorship report, in one Markdown file to keep or share.
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<DescriptionOutlinedIcon />}
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            sx={{ minHeight: 44 }}
          >
            Account report
          </Button>
        </Box>
      </Card>
      {open ? (
        <ReportDialog address={address} label={label} onClose={() => setOpen(false)} />
      ) : null}
    </Section>
  );
}

type Made =
  | { state: 'idle' }
  | { state: 'making'; stage: string }
  | { state: 'made'; text: string; filename: string }
  | { state: 'failed'; error: unknown };

function ReportDialog({
  address,
  label,
  onClose,
}: {
  address: string;
  label: string;
  onClose: () => void;
}) {
  const whole = useReadWhole(address);
  const [made, setMade] = useState<Made>({ state: 'idle' });
  const [said, setSaid] = useState('');
  const previewId = useId();

  const make = async () => {
    setSaid('');
    setMade({ state: 'making', stage: 'Starting' });
    try {
      const data = await gatherAccountReport(address, {
        neutralLine: EXPLORER_NEUTRAL_LINE,
        onStage: (stage) => setMade({ state: 'making', stage }),
      });
      setMade({ state: 'made', text: accountReportMarkdown(data), filename: reportFilename(data) });
    } catch (error) {
      setMade({ state: 'failed', error });
    }
  };

  const busy = whole.reading || made.state === 'making';
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={`Account report: ${label}`}
      maxWidth="md"
      actions={
        <>
          <Button onClick={onClose} sx={{ minHeight: 44 }}>
            Close
          </Button>
          {made.state === 'made' ? (
            <>
              <Button
                variant="outlined"
                startIcon={said === 'Copied' ? <CheckOutlinedIcon /> : <ContentCopyOutlinedIcon />}
                onClick={async () => {
                  const ok = await copyText(made.text);
                  setSaid(ok ? 'Copied' : 'Couldn’t copy it');
                }}
                sx={{ minHeight: 44 }}
              >
                Copy
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveAltOutlinedIcon />}
                onClick={async () => {
                  try {
                    const result = await saveMarkdown(made.filename, made.text);
                    setSaid(result === 'saved' ? `Saved as ${made.filename}` : 'Not saved');
                  } catch {
                    setSaid('Couldn’t save it');
                  }
                }}
                sx={{ minHeight: 44 }}
              >
                Save .md
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<DescriptionOutlinedIcon />}
              onClick={() => void make()}
              disabled={busy}
              sx={{ minHeight: 44 }}
            >
              {made.state === 'making' ? 'Making the report…' : 'Make the report'}
            </Button>
          )}
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography>
          A plain Markdown file with everything the Explorer reads on chain about this account: its
          account, QORT totals, activity by type, every connection (with blocks, dates and full
          signatures, so each can be checked), and Core’s own sponsorship report.
        </Typography>
        {whole.done ? (
          <Alert severity="success" variant="outlined">
            Its whole on-chain history is read: {plural(whole.held, 'transaction')}.
          </Alert>
        ) : (
          <Alert
            severity="info"
            variant="outlined"
            action={
              whole.reading ? (
                <Button color="inherit" onClick={whole.stop} sx={{ minHeight: 44 }}>
                  Stop
                </Button>
              ) : (
                <Button
                  color="inherit"
                  onClick={() => void whole.start()}
                  disabled={made.state === 'making'}
                  sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
                >
                  Read it all
                </Button>
              )
            }
            sx={{
              flexWrap: 'wrap',
              '& .MuiAlert-message': { flex: '1 1 240px', minWidth: 0 },
              '& .MuiAlert-action': { pl: { xs: 0, sm: 2 }, ml: { xs: 0, sm: 'auto' } },
            }}
          >
            Read its whole on-chain history first: the report then counts every transaction and adds
            up its QORT.{' '}
            {whole.reading
              ? `Reading… ${formatCount(whole.held)} so far.`
              : whole.held
                ? `Read so far: its newest ${formatCount(whole.held)}.`
                : ''}{' '}
            A busy account can take a minute.
          </Alert>
        )}
        {whole.error ? (
          <ErrorState
            compact
            title="Couldn’t read all of its history."
            error={whole.error}
            onRetry={() => void whole.start()}
          />
        ) : null}
        <Typography role="note" variant="body2" color="text.secondary">
          {EXPLORER_NEUTRAL_LINE}
        </Typography>
        {made.state === 'making' ? (
          <Typography role="status">{made.stage}…</Typography>
        ) : made.state === 'failed' ? (
          <ErrorState
            compact
            title="Couldn’t make the report."
            error={made.error}
            onRetry={() => void make()}
          />
        ) : made.state === 'made' ? (
          <>
            <Typography variant="body2" sx={{ fontWeight: 700 }} id={previewId}>
              {made.filename}
            </Typography>
            <Box
              component="pre"
              tabIndex={0}
              aria-labelledby={previewId}
              sx={{
                m: 0,
                p: 1.5,
                maxHeight: 360,
                overflow: 'auto',
                bgcolor: 'action.hover',
                borderRadius: 1,
                fontFamily: MONO,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {made.text}
            </Box>
          </>
        ) : null}
        <span role="status" className="qmp-visually-hidden">
          {said}
        </span>
        {said ? (
          <Typography variant="body2" color="text.secondary" aria-hidden>
            {said}
          </Typography>
        ) : null}
      </Box>
    </ResponsiveDialog>
  );
}
