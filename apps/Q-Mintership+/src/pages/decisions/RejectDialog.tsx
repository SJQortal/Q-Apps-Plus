/**
 * Reject, or Withdraw my signature: on chain both are a GROUP_APPROVAL with
 * approval false. The dialog says what that means before Hub's raw-data
 * dialog opens: it counts towards ending the decision as rejected (against
 * the same target as signatures, and signatures are counted first), it
 * cancels nobody else's signature, only the admin's latest answer counts,
 * and the fee. Withdraw also gives the count once the signature is gone.
 */
import { Box, Typography } from '@mui/material';
import { KIND_LABEL, type Decision } from '../../rules/decision';
import { countsAfter } from '../../rules/tally';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import { SignaturePrefix } from '../../components/common/SignaturePrefix';
import { useDisplayName } from '../../hooks/useDisplayName';
import { plural } from '../../utils/format';
import { SIGN_REJECTION_CHECK } from '../../writes/explain';
import { rejectDecision, withdrawSignature } from '../../writes/flows';
import type { Signer } from '../../writes/runner';

export type RejectMode = 'reject' | 'withdraw';

const TEXT: Record<
  RejectMode,
  { title: string; step: string; confirm: string; successTitle: string; confirming: string }
> = {
  reject: {
    title: 'Reject this decision',
    step: 'Send your rejection',
    confirm: 'Continue to Hub',
    successTitle: 'Rejected',
    confirming: 'Rejected (confirming…)',
  },
  withdraw: {
    title: 'Withdraw your signature',
    step: 'Send the rejection that withdraws it',
    confirm: 'Continue to Hub',
    successTitle: 'Signature withdrawn',
    confirming: 'Withdrawn (confirming…)',
  },
};

export function RejectDialog({
  decision: d,
  mode,
  signer,
  onClose,
}: {
  decision: Decision | null;
  mode: RejectMode;
  signer: Signer | null;
  onClose: () => void;
}) {
  const subject = useDisplayName(d?.subject ?? '', d?.subject ? undefined : null);
  const who = d?.subject ? subject.label : 'an approved invite (Core doesn’t say for whom)';
  const tally = d?.tally ?? null;
  const text = TEXT[mode];
  const after = tally && signer ? countsAfter(tally, signer.publicKey, false) : null;
  const needed = tally?.needed ?? null;
  return (
    <HubStepDialog
      open={Boolean(d && signer)}
      onClose={onClose}
      title={text.title}
      intro={
        d ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {KIND_LABEL[d.kind]}: {who}
            </Typography>
            {mode === 'withdraw' ? (
              <Typography>
                A signature can’t simply be taken back on chain: withdrawing it sends a rejection,
                and only your latest answer counts. So your signature stops counting, and your
                rejection counts towards ending it as rejected.
              </Typography>
            ) : (
              <Typography>
                Your rejection counts once it is in a block. Rejections are measured against the
                same target as signatures: if {needed ?? 'enough'} Minter Admins reject it, it ends
                as rejected. Signatures are counted first, so with {needed ?? 'enough'} of both it
                is approved.
              </Typography>
            )}
            <Typography>
              {mode === 'withdraw'
                ? 'It doesn’t cancel anyone else’s signature, and you can sign again later while there is time.'
                : 'It doesn’t cancel anyone else’s signature, and you can still sign later while there is time: only your latest answer counts.'}
            </Typography>
            {after && needed !== null ? (
              <Typography sx={{ fontWeight: 600 }}>
                {mode === 'withdraw'
                  ? `Once it is in a block: ${after.approvals} of ${needed} signatures, and ${plural(after.rejections, 'rejection')} of the ${needed} that would end it.`
                  : `With yours: ${plural(after.rejections, 'rejection')} of the ${needed} that would end it (${after.approvals} of ${needed} signatures).`}
              </Typography>
            ) : null}
          </Box>
        ) : null
      }
      steps={[
        {
          action: 'SIGN_TRANSACTION',
          title: text.step,
          check: SIGN_REJECTION_CHECK,
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
        const send = mode === 'withdraw' ? withdrawSignature : rejectDecision;
        const outcome = await send(signer, d.signature, (stage) => report(0, stage));
        return { outcome };
      }}
      confirmLabel={text.confirm}
      successTitle={text.successTitle}
      successText={
        <Typography variant="body2">
          It counts once it is in a block, usually within a couple of minutes. Until then the card
          says {text.confirming}.
        </Typography>
      }
    />
  );
}
