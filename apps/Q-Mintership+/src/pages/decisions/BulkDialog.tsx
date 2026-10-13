/**
 * Several writes one after another (bulk sign, cancel every stale invite):
 * the intro says each one is its own Hub confirmation and what they cost in
 * total, then a progress list shows each outcome. A cancel in Hub stops the
 * run; the rest are not sent.
 *
 * An item can take two Hub confirmations (`steps`: a proposal, then the
 * proposer's own signature on it). Its line then says which step is
 * running, and step 2 shows the start of the transaction it signs, as Hub's
 * "pendingSignature" will. An item whose step 1 went through and step 2
 * didn't says so in its own words (`partial`).
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
import { SignaturePrefix } from '../../components/common/SignaturePrefix';
import { friendlyError } from '../../utils/friendlyError';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import type { GroupTxType } from '../../data/types';
import { HUB_DIALOGS, HUB_DIALOG_SECONDS } from '../../writes/explain';
import type { WriteOutcome, WriteStage } from '../../writes/runner';

export interface BulkItem {
  key: string;
  label: string;
}

/** One Hub confirmation each item takes, in a run of two per item. */
export interface BulkStep {
  /** The Hub action (a key of HUB_DIALOGS). */
  action: string;
  title: string;
  /** What to check in Hub's dialog, in place of the action's usual list. */
  check?: string[];
}

/** One item's result. */
export type BulkOutcome = WriteOutcome & {
  /** Two-step items: step 1 went through and step 2 didn't. What happened, in plain words. */
  partial?: string;
  /** The run stopped at this item (a cancel in Hub at step 2). */
  stopped?: boolean;
};

/** Where an item is: its stage and, in a run of two steps, which one and what step 2 signs. */
export interface BulkProgress {
  stage: WriteStage;
  /** 0 or 1 in a run of two steps per item. */
  step?: number;
  /** Step 2: the signature of the transaction it signs (Hub's "pendingSignature"). */
  signature?: string;
}

export type BulkReport = (
  index: number,
  outcome: BulkOutcome | null,
  progress?: WriteStage | BulkProgress
) => void;

/** What the run ended with, for the summary. */
export interface BulkCounts {
  total: number;
  /** Every step went through. */
  sent: number;
  /** Step 1 went through, step 2 didn't. */
  partial: number;
  /** A cancel in Hub stopped the run. */
  stopped: boolean;
}

export interface BulkDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  intro?: ReactNode;
  /** The Hub action each item opens (a key of HUB_DIALOGS), for one confirmation per item. */
  action?: string;
  /** Two confirmations per item, in place of `action`. */
  steps?: BulkStep[];
  /** Every confirmation's fee type (the fee is counted once per confirmation). */
  feeTxType: GroupTxType;
  items: BulkItem[];
  run: (report: BulkReport) => Promise<BulkOutcome[]>;
  confirmLabel: string;
  /** An item whose every step went through (default "Sent ✓"). */
  sentLabel?: string;
  /** The summary at the end, in place of "2 of 3 sent." */
  summarize?: (counts: BulkCounts) => string;
  /** Called once the run is over (to clear a selection). */
  onFinished?: (outcomes: BulkOutcome[]) => void;
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
  progress?: BulkProgress;
  outcome?: BulkOutcome;
}

function defaultSummary({ total, sent, partial, stopped }: BulkCounts): string {
  const done = sent + partial;
  return `${done} of ${total} sent.${stopped ? ' You cancelled one in Hub, so the rest were not sent.' : ''}${done ? ' Each counts once it is in a block.' : ''}`;
}

function outcomeText(outcome: BulkOutcome, sentLabel: string): string {
  if (outcome.partial) return outcome.partial;
  switch (outcome.status) {
    case 'sent':
      return outcome.recovered
        ? `${sentLabel} (found on your node after Hub stopped waiting)`
        : sentLabel;
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
    steps,
    feeTxType,
    items,
    run,
    confirmLabel,
    sentLabel = 'Sent ✓',
    summarize = defaultSummary,
    onFinished,
    returnFocus,
  } = props;
  const [phase, setPhase] = useState<'intro' | 'running' | 'done'>('intro');
  const [states, setStates] = useState<ItemState[]>([]);
  const [active, setActive] = useState(-1);
  /** The item whose outcome came in last (for the live region). */
  const [lastDone, setLastDone] = useState(-1);
  // One confirmation per item (`action`), or the steps of each item.
  const perItem: BulkStep[] = steps ?? (action ? [{ action, title: '' }] : []);
  const twoStep = perItem.length > 1;

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
    let outcomes: BulkOutcome[] = [];
    try {
      outcomes = await run((index, outcome, progress) => {
        setActive(index);
        if (outcome) setLastDone(index);
        setStates((current) => {
          const next = [...current];
          next[index] = outcome
            ? { outcome }
            : { progress: typeof progress === 'string' ? { stage: progress } : progress };
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

  const counts: BulkCounts = {
    total: items.length,
    sent: states.filter((s) => s.outcome?.status === 'sent' && !s.outcome.partial).length,
    partial: states.filter((s) => s.outcome?.status === 'sent' && Boolean(s.outcome.partial))
      .length,
    stopped: states.some((s) => s.outcome?.status === 'declined' || Boolean(s.outcome?.stopped)),
  };
  const summary = summarize(counts);

  /** "Step 2 of 2, sign it: Waiting for you in Hub…", or the stage alone for one step. */
  const progressText = (progress: BulkProgress): string => {
    const step = progress.step ?? 0;
    const title = perItem[step]?.title;
    return twoStep && title
      ? `Step ${step + 1} of ${perItem.length}, ${title.charAt(0).toLowerCase()}${title.slice(1)}: ${STAGE_TEXT[progress.stage]}`
      : STAGE_TEXT[progress.stage];
  };

  // Two parts, so a screen reader reads only the one that changed.
  const doneOutcome = states[lastDone]?.outcome;
  const outcomeLine =
    doneOutcome && items[lastDone]
      ? `${lastDone + 1}. ${items[lastDone].label}: ${outcomeText(doneOutcome, sentLabel)}`
      : '';
  const activeProgress =
    active >= 0 && !states[active]?.outcome ? states[active]?.progress : undefined;
  const stageLine =
    phase === 'running' && activeProgress && items[active]
      ? `${active + 1}. ${items[active].label}: ${progressText(activeProgress)}`
      : '';
  // Step 2 signs the transaction step 1 made: its start, to compare in Hub.
  const signingNow =
    phase === 'running' && activeProgress?.signature && (activeProgress.step ?? 0) > 0
      ? activeProgress.signature
      : null;

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
          {perItem.length ? (
            <Box>
              <Typography variant="body2" color="text.secondary">
                {hubCountText(items.length, perItem.length)}
                {twoStep ? null : ` ${HUB_DIALOGS[perItem[0].action]?.hubAsks ?? ''}`}
              </Typography>
              {perItem.map((step, i) => (
                <StepChecks key={step.action} step={step} n={twoStep ? i + 1 : null} />
              ))}
              <Typography variant="body2" color="text.secondary">
                If you cancel one in Hub, the rest are not sent.
              </Typography>
            </Box>
          ) : null}
          <FeeNote
            txType={feeTxType}
            times={items.length * Math.max(1, perItem.length)}
            prefix="Fees in total"
          />
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
          const partial = Boolean(state.outcome?.partial);
          const tone = partial
            ? 'warning.main'
            : status === 'sent'
              ? 'success.main'
              : status === 'failed' || status === 'unknown'
                ? 'error.main'
                : status === 'blocked'
                  ? 'warning.main'
                  : 'text.secondary';
          const line = state.outcome
            ? outcomeText(state.outcome, sentLabel)
            : isActive && state.progress
              ? progressText(state.progress)
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
                ) : status === 'sent' && !partial ? (
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
                {isActive && signingNow ? (
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    For this proposal, &quot;pendingSignature&quot; starts with{' '}
                    <SignaturePrefix signature={signingNow} />.
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
        {stageLine ? (
          <span className="qmp-visually-hidden">
            {' '}
            {stageLine}
            {signingNow
              ? ` For this proposal, "pendingSignature" starts with ${signingNow.slice(0, 8)}.`
              : ''}
          </span>
        ) : null}
        {phase === 'done' ? (
          <Alert severity={counts.sent === items.length ? 'success' : 'info'} role="note">
            {summary}
          </Alert>
        ) : null}
      </Box>
    </ResponsiveDialog>
  );
}

/** "6 Hub confirmations, two for each, one after another:" */
function hubCountText(items: number, perItem: number): string {
  if (perItem > 1)
    return `${items * perItem} Hub confirmations, ${perItem === 2 ? 'two' : perItem} for each, one after another:`;
  return items === 1 ? 'One Hub confirmation.' : `${items} Hub confirmations, one for each.`;
}

/** What Hub's dialog for one step asks (numbered in a run of two), and what to check in it. */
function StepChecks({ step, n }: { step: BulkStep; n: number | null }) {
  const dialog = HUB_DIALOGS[step.action];
  if (!dialog) return null;
  return (
    <Box sx={n ? { mt: 0.5 } : undefined}>
      {n ? (
        <Typography variant="body2" color="text.secondary">
          <Box component="span" sx={{ fontWeight: 700 }}>
            {n}. {step.title}.
          </Box>{' '}
          {dialog.hubAsks}
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary" component="div">
        Check each time:
        <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
          {(step.check ?? dialog.check).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </Box>
      </Typography>
    </Box>
  );
}
