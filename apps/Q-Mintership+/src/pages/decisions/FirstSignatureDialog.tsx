/**
 * The first Minter Admin's signature on a nomination: one guided step made
 * of two Hub confirmations (create the invite on chain, then sign it),
 * because in MINTER an admin's own proposal isn't approved by itself. If
 * the invite goes through but the signature doesn't, the nomination is
 * still on chain and can be signed from the queue like any decision.
 */
import { useState } from 'react';
import { Typography } from '@mui/material';
import { FeeNote } from '../../components/common/FeeNote';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import type { Nomination } from '../../data/nominations';
import { formatCount, formatDuration, plural } from '../../utils/format';
import { firstSignature, type FirstSignatureOutcome } from '../../writes/flows';
import type { Signer, WriteOutcome } from '../../writes/runner';
import { useDisplayName } from '../../hooks/useDisplayName';

export interface FirstSignatureFacts {
  needed: number;
  totalAdmins: number;
  maximumBlockDelay: number;
  msPerBlock: number;
}

function step2Problem(outcome: WriteOutcome | null): string {
  switch (outcome?.status) {
    case 'declined':
      return 'You cancelled step 2 in Hub.';
    case 'blocked':
      return outcome.reason;
    case 'unknown':
    case 'failed':
      return outcome.message;
    default:
      return 'Step 2 did not run.';
  }
}

export function FirstSignatureDialog({
  nomination: n,
  signer,
  facts,
  onClose,
}: {
  nomination: Nomination | null;
  signer: Signer | null;
  facts: FirstSignatureFacts;
  onClose: () => void;
}) {
  const nominee = useDisplayName(n?.nominee ?? '', n ? n.nomineeName : null);
  const [partial, setPartial] = useState<FirstSignatureOutcome | null>(null);
  const windowText = `${formatCount(facts.maximumBlockDelay)} blocks (about ${formatDuration(
    facts.maximumBlockDelay * facts.msPerBlock,
    { precise: true }
  )})`;
  return (
    <HubStepDialog
      open={Boolean(n && signer)}
      onClose={() => {
        onClose();
        setPartial(null);
      }}
      title={`First signature: ${nominee.label}`}
      intro={
        <>
          <Typography>
            No Minter Admin has signed this nomination yet. As the first, you put it on chain and
            sign it: two Hub confirmations, one after the other.
          </Typography>
          <Typography sx={{ mt: 1 }}>
            The clock starts once it is in a block. The other Minter Admins then have {windowText}{' '}
            to reach {facts.needed} of {facts.totalAdmins} signatures.
          </Typography>
          <Typography sx={{ mt: 1 }}>
            <FeeNote txType="GROUP_INVITE" times={2} prefix="Fees in total" />
          </Typography>
        </>
      }
      steps={[
        {
          action: 'INVITE_TO_GROUP',
          title: 'Create the nomination on chain',
          detail: (
            <Typography variant="body2">
              Hub shows the invitee ({nominee.label}) and the group MINTER.
            </Typography>
          ),
          feeTxType: 'GROUP_INVITE',
        },
        {
          action: 'SIGN_TRANSACTION',
          title: 'Sign it',
          detail: (
            <Typography variant="body2">
              Hub will show Tx type GROUP_APPROVAL, &quot;approval&quot;: true and a box to tick.
              The &quot;pendingSignature&quot; is the new nomination’s own, made in step 1.
            </Typography>
          ),
          feeTxType: 'GROUP_APPROVAL',
        },
      ]}
      run={async (report) => {
        if (!n || !signer)
          return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        setPartial(null);
        const result = await firstSignature(signer, n.nominee, (p) => report(p.step - 1, p.stage));
        if (result.invite.status !== 'sent') return { outcome: result.invite };
        if (result.approval?.status === 'sent') return { outcome: result.approval };
        // Step 1 went through, step 2 didn't: show step 1 as the one that is done.
        setPartial(result);
        report(0, 'done');
        return {
          outcome: result.invite,
          message: (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Step 2 didn’t go through: {step2Problem(result.approval)} The nomination is on chain
              and waiting. Once it shows in the queue, sign it there like any other decision.
            </Typography>
          ),
        };
      }}
      successTitle={
        partial ? 'Step 1 done: the nomination is on chain' : 'Signed: the clock has started'
      }
      successText={
        partial ? null : (
          <Typography variant="body2">
            The nomination and your signature count once they are in a block, usually within a
            couple of minutes. After yours it needs{' '}
            {plural(Math.max(0, facts.needed - 1), 'more signature', 'more signatures')}.
          </Typography>
        )
      }
    />
  );
}
