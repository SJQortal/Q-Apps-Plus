/**
 * Several writes one after another (bulk sign, cancel every stale invite):
 * the intro says each one is its own Hub confirmation and what they cost in
 * total, then a progress list shows each outcome. A cancel in Hub stops the
 * run; the rest are not sent.
 *
 * Screen readers follow it through one live region that is there from the
 * start: each item's outcome as it lands, the current item's stage, and the
 * summary at the end. Focus then moves to Done.
 */
import { useState, type ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import RemoveCircleOutlineOutlinedIcon from '@mui/icons-material/RemoveCircleOutlineOutlined';
import { FeeNote } from '../../components/common/FeeNote';
import { friendlyError } from '../../utils/friendlyError';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import type { GroupTxType } from '../../data/types';
import { HUB_DIALOGS, HUB_DIALOG_SECONDS } from '../../writes/explain';
import type { WriteOutcome, WriteStage } from '../../writes/runner';

export interface BulkItem {
  key: string;
  label: string;
}

export type BulkReport = (index: number, outcome: WriteOutcome | null, stage?: WriteStage) => void;

export interface BulkDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  intro?: ReactNode;
  /** The Hub action each item opens (a key of HUB_DIALOGS). */
  action: string;
  feeTxType: GroupTxType;
  items: BulkItem[];
  run: (report: BulkReport) => Promise<WriteOutcome[]>;
  confirmLabel: string;
  /** Called once the run is over (to clear a selection). */
  onFinished?: (outcomes: WriteOutcome[]) => void;
  /** Where focus goes on close when the button that opened it is gone. */
  returnFocus?: () => HTMLElement | null;
}

const STAGE_TEXT: Record<WriteStage, string> = {
  checking: 'Checking the latest state on your node…',
  waitingForHub: `Waiting for you in Hub… (its dialog closes by itself after ${HUB_DIALOG_SECONDS} seconds)`,
  lookingUp: 'Hub stopped waiting. Looking for the transaction on your node…',
  done: 'Done',
};

interface ItemState {
  stage?: WriteStage;
  outcome?: WriteOutcome;
}

function outcomeText(outcome: WriteOutcome): string {
  switch (outcome.status) {
    case 'sent':
      return outcome.recovered ? 'Sent ✓ (found on your node after Hub stopped waiting)' : 'Sent ✓';
    case 'declined':
      return 'Cancelled in Hub. Stopped here.';
    case 'blocked':
      return `Not sent: ${outcome.reason}`;
    case 'unknown':
    case 'failed':
      return outcome.message;
  }
}

export function BulkDialog(props: BulkDialogProps) {
  const {
    open,
    onClose,
    title,
    intro,
    action,
    feeTxType,
    items,
    run,
    confirmLabel,
    onFinished,
    returnFocus,
  } = props;
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro');
  const [states, setStates] = useState<ItemState[]>([]);
  const [active, setActive] = useState(-1);
  /** The item whose outcome came in last (for the live region). */
  const [lastDone, setLastDone] = useState(-1);
  const dialog = HUB_DIALOGS[action];

  // Each opening starts at the intro (a timer after closing could wipe a quick reopen's run).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && phase !== 'running') {
      setPhase('intro');
      setStates([]);
      setActive(-1);
      setLastDone(-1);
    }
  }

  const close = () => {
    if (phase === 'running') return;
    onClose();
  };

  const start = async () => {
    setPhase('running');
    setStates(items.map(() => ({})));
    setLastDone(-1);
    let outcomes: WriteOutcome[] = [];
    try {
      outcomes = await run((index, outcome, stage) => {
        setActive(index);
        if (outcome) setLastDone(index);
        setStates((current) => {
          const next = [...current];
          next[index] = outcome ? { outcome } : { stage };
          return next;
        });
      });
    } catch (error) {
      setStates((current) => {
        const next = [...current];
        const at = next.findIndex((s) => !s.outcome);
        if (at >= 0)
          next[at] = {
            outcome: {
              status: 'failed',
              message: friendlyError(error) || 'Something went wrong.',
            },
          };
        return next;
      });
    }
    setActive(-1);
    setPhase('done');
    onFinished?.(outcomes);
  };

  const sent = states.filter((s) => s.outcome?.status === 'sent').length;
  const stopped = states.some((s) => s.outcome?.status === 'declined');
  const summary = `${sent} of ${items.length} sent.${stopped ? ' You cancelled one in Hub, so the rest were not sent.' : ''}${sent ? ' Each counts once it is in a block.' : ''}`;

  // Two parts, so a screen reader reads only the one that changed.
  const doneOutcome = states[lastDone]?.outcome;
  const outcomeLine =
    doneOutcome && items[lastDone]
      ? `${lastDone + 1}. ${items[lastDone].label}: ${outcomeText(doneOutcome)}`
      : '';
  const activeStage = active >= 0 && !states[active]?.outcome ? states[active]?.stage : undefined;
  const stageLine =
    phase === 'running' && activeStage && items[active]
      ? `${active + 1}. ${items[active].label}: ${STAGE_TEXT[activeStage]}`
      : '';

  const actions =
    phase === 'intro' ? (
      <>
        <Button onClick={close}>Not now</Button>
        <Button variant="contained" onClick={start} disabled={items.length === 0}>
          {confirmLabel}
        </Button>
      </>
    ) : phase === 'running' ? null : (
      <Button variant="contained" onClick={close} autoFocus>
        Done
      </Button>
    );

  return (
    <ResponsiveDialog
      open={open}
      onClose={phase === 'running' ? undefined : close}
      title={title}
      actions={actions}
      returnFocus={returnFocus}
    >
      {phase === 'intro' ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {intro ? <Box sx={{ typography: 'body1' }}>{intro}</Box> : null}
          {dialog ? (
            <Box>
              <Typography variant="body2" color="text.secondary">
                {items.length === 1
                  ? 'One Hub confirmation.'
                  : `${items.length} Hub confirmations, one for each.`}{' '}
                {dialog.hubAsks}
              </Typography>
              <Typography variant="body2" color="text.secondary" component="div">
                Check each time:
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {dialog.check.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </Box>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                If you cancel one in Hub, the rest are not sent.
              </Typography>
            </Box>
          ) : null}
          <FeeNote txType={feeTxType} times={items.length} prefix="Fees in total" />
        </Box>
      ) : null}

      <Box
        component="ol"
        aria-label="Progress"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {items.map((item, i) => {
          const state = states[i] ?? {};
          const isActive = phase === 'running' && active === i && !state.outcome;
          const status = state.outcome?.status;
          const tone =
            status === 'sent'
              ? 'success.main'
              : status === 'failed' || status === 'unknown'
                ? 'error.main'
                : status === 'blocked'
                  ? 'warning.main'
                  : 'text.secondary';
          const line = state.outcome
            ? outcomeText(state.outcome)
            : isActive && state.stage
              ? STAGE_TEXT[state.stage]
              : phase === 'done'
                ? 'Not sent.'
                : phase === 'running'
                  ? 'Waiting its turn.'
                  : null;
          return (
            <Box
              component="li"
              key={item.key}
              aria-current={isActive ? 'step' : undefined}
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 1.25,
                border: 1,
                borderColor: isActive ? 'primary.main' : 'divider',
                borderRadius: 1,
                transition: 'border-color 200ms ease',
              }}
            >
              <Box aria-hidden sx={{ pt: 0.25, color: tone, display: 'flex' }}>
                {isActive ? (
                  <CircularProgress size={20} />
                ) : status === 'sent' ? (
                  <CheckCircleOutlineOutlinedIcon />
                ) : status === 'declined' || (phase === 'done' && !status) ? (
                  <RemoveCircleOutlineOutlinedIcon />
                ) : status ? (
                  <ErrorOutlineOutlinedIcon />
                ) : (
                  <RadioButtonUncheckedOutlinedIcon />
                )}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {i + 1}. {item.label}
                </Typography>
                {line ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: isActive
                        ? 'primary.main'
                        : status === 'failed' || status === 'unknown'
                          ? 'error.main'
                          : 'text.secondary',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {line}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* The live region: the last outcome, the current stage, then the summary. */}
      <Box role="status" aria-live="polite">
        <span className="qmp-visually-hidden">{outcomeLine}</span>
        {stageLine ? <span className="qmp-visually-hidden"> {stageLine}</span> : null}
        {phase === 'done' ? (
          <Alert severity={sent === items.length ? 'success' : 'info'} role="note">
            {summary}
          </Alert>
        ) : null}
      </Box>
    </ResponsiveDialog>
  );
}
