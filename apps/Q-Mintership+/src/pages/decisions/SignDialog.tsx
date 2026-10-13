/**
 * Sign one decision: what it approves, what Hub's raw-data dialog will show
 * (GROUP_APPROVAL, approval true, the pending signature, a tick box) and the
 * fee, then signDecision. The card turns "Signed ✓ (confirming…)" at once.
 */
import { Typography } from '@mui/material';
import type { Decision } from '../../rules/decision';
import { KIND_LABEL } from '../../rules/decision';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import { SignaturePrefix } from '../../components/common/SignaturePrefix';
import { useDisplayName } from '../../hooks/useDisplayName';
import { signDecision } from '../../writes/flows';
import type { Signer } from '../../writes/runner';

export function SignDialog({
  decision: d,
  signer,
  onClose,
}: {
  decision: Decision | null;
  signer: Signer | null;
  onClose: () => void;
}) {
  const subject = useDisplayName(d?.subject ?? '', d?.subject ? undefined : null);
  const who = d?.subject ? subject.label : 'an approved invite (Core doesn’t say for whom)';
  const tally = d?.tally;
  return (
    <HubStepDialog
      open={Boolean(d && signer)}
      onClose={onClose}
      title="Sign this decision"
      intro={
        d ? (
          <>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {KIND_LABEL[d.kind]}: {who}
            </Typography>
            <Typography sx={{ mt: 0.5 }}>
              Your signature approves it. It counts once it is in a block
              {tally ? `; ${tally.approvalCount} of ${tally.needed} signatures so far` : ''}. Core
              applies it by itself when enough Minter Admins have signed.
            </Typography>
          </>
        ) : null
      }
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
