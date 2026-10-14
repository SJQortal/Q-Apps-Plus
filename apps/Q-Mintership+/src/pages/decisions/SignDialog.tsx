/**
 * Sign one decision: what it approves, what Hub's raw-data dialog will show
 * (GROUP_APPROVAL, approval true, the pending signature, a tick box) and the
 * fee, then signDecision. The card turns "Signed ✓ (confirming…)" at once.
 * An admin change first says what it does to the target; when that changes
 * any waiting decision, "I've checked these" must be ticked before Hub opens.
 */
import { Box, Typography } from '@mui/material';
import type { Decision } from '../../rules/decision';
import { decisionTitle } from '../../rules/decision';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import { SignaturePrefix } from '../../components/common/SignaturePrefix';
import { useDisplayName } from '../../hooks/useDisplayName';
import { signDecision } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { hasImpact, type ShiftScenario } from '../../rules/targetShift';
import { TargetImpact } from './TargetImpact';
import type { LabelOf } from './targetShiftUi';
import { useAcknowledge } from './useAcknowledge';

export function SignDialog({
  decision: d,
  signer,
  onClose,
  impact,
  labelOf,
  returnFocus,
}: {
  decision: Decision | null;
  signer: Signer | null;
  onClose: () => void;
  /** An admin change: what it does to the target if it passes. */
  impact?: ShiftScenario | null;
  labelOf?: LabelOf;
  /** Where focus goes on close when the card that opened it is gone. */
  returnFocus?: () => HTMLElement | null;
}) {
  const subject = useDisplayName(d?.subject ?? '', d?.subject ? undefined : null);
  const shift = impact && labelOf ? impact : null;
  const ack = useAcknowledge(d && shift ? d.signature : null);
  const mustCheck = hasImpact(shift);
  const who = d?.subject ? subject.label : 'an approved invite (Core doesn’t say for whom)';
  const tally = d?.tally;
  return (
    <HubStepDialog
      open={Boolean(d && signer)}
      onClose={onClose}
      returnFocus={returnFocus}
      title="Sign this decision"
      intro={
        d ? (
          <>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {decisionTitle(d)}: {who}
            </Typography>
            <Typography sx={{ mt: 0.5 }}>
              Your signature approves it. It counts once it is in a block
              {tally ? `; ${tally.approvalCount} of ${tally.needed} signatures so far` : ''}. Core
              applies it by itself when enough Minter Admins have signed.
            </Typography>
            {shift && labelOf ? (
              <Box sx={{ mt: 1.5 }}>
                <TargetImpact
                  scenario={shift}
                  labelOf={labelOf}
                  lead="If this passes"
                  ack={mustCheck ? ack : null}
                />
              </Box>
            ) : null}
          </>
        ) : null
      }
      beforeStart={mustCheck ? ack.confirm : undefined}
      steps={[
        {
          action: 'SIGN_TRANSACTION',
          title: 'Sign it',
          detail: d ? (
            <Typography variant="body2" component="div">
              For this decision, &quot;pendingSignature&quot; starts with{' '}
              <SignaturePrefix signature={d.signature} />.
            </Typography>
          ) : null,
          feeTxType: 'GROUP_APPROVAL',
        },
      ]}
      run={async (report) => {
        if (!d || !signer)
          return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        const outcome = await signDecision(signer, d.signature, (stage) => report(0, stage));
        return { outcome };
      }}
      confirmLabel="Continue to Hub"
      successTitle="Signed"
      successText={
        <Typography variant="body2">
          It counts once it is in a block, usually within a couple of minutes. Until then the card
          says Signed ✓ (confirming…).
        </Typography>
      }
    />
  );
}
