/**
 * Every write goes through this dialog (docs/DESIGN.md → Dialogs: say what
 * will happen and what it costs before Hub's own confirmation opens):
 *
 * 1. Intro: what will happen, each Hub confirmation it takes (with what Hub
 *    will show and what to check), and the fees.
 * 2. Running: which step is waiting, in plain words ("Checking…", "Waiting
 *    for you in Hub…", "Hub stopped waiting: looking for the transaction…").
 * 3. Result: sent (or found after a timeout), cancelled, stopped by a guard
 *    (with the reason), unknown (check again before retrying), or failed.
 *
 * Screen readers hear each stage and the result through one live region
 * that is there from the start (a region that appears already filled is
 * not reliably read); a failure is an alert. When the result shows, focus
 * moves to its main button, never left on the dialog's frame.
 */
import { useState, type ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RadioButtonUncheckedOutlinedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined';
import type { GroupTxType } from '../../data/types';
import { HUB_DIALOGS, HUB_DIALOG_SECONDS } from '../../writes/explain';
import type { WriteOutcome, WriteStage } from '../../writes/runner';
import { friendlyError } from '../../utils/friendlyError';
import { focusDialogTitle } from '../../utils/focus';
import { FeeNote } from './FeeNote';
import { ResponsiveDialog } from './ResponsiveDialog';

export interface HubStep {
  /** The Hub action this step opens (a key of HUB_DIALOGS). */
  action: string;
  title: string;
  /** Extra things to check in Hub's dialog for this step. */
  detail?: ReactNode;
  /** What to check in Hub's dialog, in place of the action's usual list. */
  check?: string[];
  /** Inline words shown (and spoken) under the stage while this step runs. */
  running?: ReactNode;
  feeTxType: GroupTxType | 'ARBITRARY';
}

export interface StepRunResult {
  outcome: WriteOutcome;
  /** Extra words for the result (e.g. step 1 sent but step 2 didn't). */
  message?: ReactNode;
}

export interface HubStepDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** What will happen, in plain words. */
  intro?: ReactNode;
  steps: HubStep[];
  /** Runs the write(s); call `report(step, stage)` as each step moves on. */
  run: (report: (step: number, stage: WriteStage) => void) => Promise<StepRunResult>;
  successTitle?: string;
  successText?: ReactNode;
  confirmLabel?: string;
  onSuccess?: (result: StepRunResult) => void;
  /**
   * Back to the form this dialog came from, keeping what was typed: offered
   * in place of "Not now", and after a cancel in Hub, a stop or a failure.
   */
  onBack?: () => void;
  /** Where focus goes on close when the button that opened it is gone (ResponsiveDialog). */
  returnFocus?: () => HTMLElement | null;
  /**
   * Called when the intro's confirm button is pressed: return false to stay
   * on the intro (it should say why and move focus, e.g. to a box to tick).
   */
  beforeStart?: () => boolean;
}

type Phase = 'intro' | 'running' | 'done';

const STAGE_TEXT: Record<WriteStage, string> = {
  checking: 'Checking the latest state on your node…',
  waitingForHub: 'Waiting for you in Hub…',
  lookingUp: 'Hub stopped waiting. Looking for the transaction on your node…',
  done: 'Done',
};

export function HubStepDialog(props: HubStepDialogProps) {
  const {
    open,
    onClose,
    title,
    intro,
    steps,
    run,
    successTitle,
    successText,
    confirmLabel = 'Continue to Hub',
    onSuccess,
    onBack,
    returnFocus,
    beforeStart,
  } = props;
  const [phase, setPhase] = useState<Phase>('intro');
  const [active, setActive] = useState<{ step: number; stage: WriteStage }>({
    step: 0,
    stage: 'checking',
  });
  const [result, setResult] = useState<StepRunResult | null>(null);

  // Each opening starts at the intro (React's adjust-while-rendering pattern).
  // Not a timer after closing: one could fire after a quick reopen and
  // wipe that run's result.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && phase !== 'running') {
      setPhase('intro');
      setResult(null);
    }
  }

  const leave = (to: () => void) => {
    if (phase === 'running') return;
    to();
  };
  const close = () => leave(onClose);
  const back = onBack ? () => leave(onBack) : null;

  const start = async () => {
    // Its buttons go while it runs: focus waits on the title, never on the page.
    focusDialogTitle(document.activeElement);
    setPhase('running');
    setResult(null);
    setActive({ step: 0, stage: 'checking' });
    let final: StepRunResult;
    try {
      final = await run((step, stage) => setActive({ step, stage }));
    } catch (error) {
      final = {
        outcome: {
          status: 'failed',
          message: friendlyError(error) || 'Something went wrong.',
        },
      };
    }
    setResult(final);
    setPhase('done');
    if (final.outcome.status === 'sent') onSuccess?.(final);
  };

  const outcome = result?.outcome;
  // The buttons that appear with the result take focus (autoFocus): after a
  // failure the one that doesn't send again.
  const backButton = (variant: 'text' | 'contained', focus = false) =>
    back ? (
      <Button variant={variant} onClick={back} autoFocus={focus}>
        Back to the form
      </Button>
    ) : null;
  const actions =
    phase === 'intro' ? (
      <>
        {back ? backButton('text') : <Button onClick={close}>Not now</Button>}
        <Button
          variant="contained"
          onClick={() => {
            if (beforeStart && !beforeStart()) return;
            void start();
          }}
        >
          {confirmLabel}
        </Button>
      </>
    ) : phase === 'running' ? null : outcome?.status === 'failed' ? (
      <>
        {back ? (
          backButton('text', true)
        ) : (
          <Button onClick={close} autoFocus>
            Close
          </Button>
        )}
        <Button variant="contained" onClick={start}>
          Try again
        </Button>
      </>
    ) : back && (outcome?.status === 'declined' || outcome?.status === 'blocked') ? (
      <>
        <Button onClick={close}>Close</Button>
        {backButton('contained', true)}
      </>
    ) : (
      <Button variant="contained" onClick={close} autoFocus>
        {outcome?.status === 'sent' ? 'Done' : 'Close'}
      </Button>
    );
  const stageText = `${steps.length > 1 ? `Step ${active.step + 1} of ${steps.length}: ` : ''}${STAGE_TEXT[active.stage]}`;
  const runningNow = phase === 'running' ? steps[active.step]?.running : null;

  return (
    <ResponsiveDialog
      open={open}
      onClose={phase === 'running' ? undefined : close}
      title={title}
      actions={actions}
      returnFocus={returnFocus}
    >
      {phase === 'intro' && intro ? <Box sx={{ typography: 'body1' }}>{intro}</Box> : null}

      <Box
        component="ol"
        aria-label="Steps"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        {steps.map((step, i) => {
          const dialog = HUB_DIALOGS[step.action];
          const isActive = phase === 'running' && active.step === i;
          const isDone =
            (phase === 'running' && active.step > i) ||
            (phase === 'done' && outcome?.status === 'sent' && i <= active.step);
          return (
            <Box
              component="li"
              key={`${step.action}-${i}`}
              aria-current={isActive ? 'step' : undefined}
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 1.5,
                border: 1,
                borderColor: isActive ? 'primary.main' : 'divider',
                borderRadius: 1,
                transition: 'border-color 200ms ease',
              }}
            >
              <Box aria-hidden sx={{ pt: 0.25, color: isDone ? 'success.main' : 'text.secondary' }}>
                {isActive ? (
                  <CircularProgress size={20} />
                ) : isDone ? (
                  <CheckCircleOutlineOutlinedIcon />
                ) : (
                  <RadioButtonUncheckedOutlinedIcon />
                )}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {steps.length > 1 ? `Step ${i + 1} of ${steps.length}: ` : ''}
                  {step.title}
                </Typography>
                {isActive ? (
                  <Typography variant="body2" sx={{ color: 'primary.main', mt: 0.5 }}>
                    {STAGE_TEXT[active.stage]}
                    {active.stage === 'waitingForHub'
                      ? ` Hub's dialog closes by itself after ${HUB_DIALOG_SECONDS} seconds.`
                      : ''}
                  </Typography>
                ) : null}
                {isActive && step.running ? (
                  <Box sx={{ mt: 0.5, typography: 'body2', overflowWrap: 'anywhere' }}>
                    {step.running}
                  </Box>
                ) : null}
                {phase === 'intro' && dialog ? (
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {dialog.hubAsks}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" component="div">
                      Check:
                      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                        {(step.check ?? dialog.check).map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </Box>
                    </Typography>
                    {step.detail ? (
                      <Box sx={{ mt: 0.5, typography: 'body2' }}>{step.detail}</Box>
                    ) : null}
                    {dialog.notes?.map((n) => (
                      <Typography key={n} variant="body2" color="text.secondary">
                        {n}
                      </Typography>
                    ))}
                    <FeeNote txType={step.feeTxType} />
                  </Box>
                ) : null}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* One live region, there from the start: the stage while running, then the result. */}
      <Box role="status" aria-live="polite">
        {phase === 'running' ? (
          <span className="qmp-visually-hidden">
            {stageText}
            {runningNow ? <> {runningNow}</> : null}
          </span>
        ) : null}
        {phase === 'done' && outcome && outcome.status !== 'failed' ? (
          <OutcomeMessage
            outcome={outcome}
            successTitle={successTitle}
            successText={successText}
            extra={result?.message}
          />
        ) : null}
      </Box>
      {/* A failure is an alert of its own. */}
      {phase === 'done' && outcome?.status === 'failed' ? (
        <OutcomeMessage outcome={outcome} extra={result?.message} />
      ) : null}
    </ResponsiveDialog>
  );
}

function OutcomeMessage({
  outcome,
  successTitle,
  successText,
  extra,
}: {
  outcome: WriteOutcome;
  successTitle?: string;
  successText?: ReactNode;
  extra?: ReactNode;
}) {
  switch (outcome.status) {
    case 'sent':
      return (
        <Alert severity="success" role="note">
          <Typography sx={{ fontWeight: 700 }}>{successTitle ?? 'Sent'}</Typography>
          {successText}
          {outcome.recovered ? (
            <Typography variant="body2">
              Hub stopped waiting, but the transaction is on your node.
            </Typography>
          ) : null}
          {extra}
        </Alert>
      );
    case 'declined':
      return (
        <Alert severity="info" role="note">
          Cancelled in Hub. Nothing was sent.
          {extra}
        </Alert>
      );
    case 'blocked':
      return (
        <Alert severity="warning" role="note">
          {outcome.reason}
          {extra}
        </Alert>
      );
    case 'unknown':
      return (
        <Alert severity="warning" role="note">
          {outcome.message}
          {extra}
        </Alert>
      );
    case 'failed':
      return (
        <Alert severity="error" role="alert">
          {outcome.message}
          {extra}
        </Alert>
      );
  }
}
