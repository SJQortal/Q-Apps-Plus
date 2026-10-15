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
import { SignaturePrefix } from '../../components/common/SignaturePrefix';
import type { Nomination } from '../../data/nominations';
import { plural } from '../../utils/format';
import { SIGN_NEW_TX_CHECK } from '../../writes/explain';
import { firstSignature, type FirstSignatureOutcome } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { useDisplayName } from '../../hooks/useDisplayName';
import { secondStepProblem, signingWindowText } from './decisionUi';

export interface FirstSignatureFacts {
  needed: number;
  totalAdmins: number;
  maximumBlockDelay: number;
  msPerBlock: number;
}

export function FirstSignatureDialog({
  nomination: n,
  signer,
  facts,
  onClose,
  returnFocus,
}: {
  nomination: Nomination | null;
  signer: Signer | null;
  facts: FirstSignatureFacts;
  onClose: () => void;
  /** Where focus goes on close once the nomination's card has left its list. */
  returnFocus?: () => HTMLElement | null;
}) {
  const nominee = useDisplayName(n?.nominee ?? '', n ? n.nomineeName : null);
  const [partial, setPartial] = useState<FirstSignatureOutcome | null>(null);
  // The invite step 1 made, which step 2 signs: Hub shows it as "pendingSignature".
  const [newSig, setNewSig] = useState<string | null>(null);
  const windowText = signingWindowText(facts.maximumBlockDelay, facts.msPerBlock);
  return (
    <HubStepDialog
      open={Boolean(n && signer)}
      returnFocus={returnFocus}
      onClose={() => {
        onClose();
        setPartial(null);
      }}
      title={`First approval: ${nominee.label}`}
      intro={
        <>
          <Typography>
            No Minter Admin has approved this nomination yet. As the first, you put it on chain and
            approve it: two Hub confirmations, one after the other.
          </Typography>
          <Typography sx={{ mt: 1 }}>
            The clock starts once it is in a block. The other Minter Admins then have {windowText}{' '}
            to reach {facts.needed} approvals.
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
          title: 'Approve it',
          detail: (
            <Typography variant="body2">
              Hub will show Tx type GROUP_APPROVAL, &quot;approval&quot;: true and a box to tick:
              that is your approval. The &quot;pendingSignature&quot; is the new nomination’s own,
              made in step 1.
            </Typography>
          ),
          check: SIGN_NEW_TX_CHECK,
          running: newSig ? (
            <>
              For this nomination, &quot;pendingSignature&quot; starts with{' '}
              <SignaturePrefix signature={newSig} />.
            </>
          ) : null,
          feeTxType: 'GROUP_APPROVAL',
        },
      ]}
      run={async (report) => {
        if (!n || !signer)
          return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        setPartial(null);
        setNewSig(null);
        const result = await firstSignature(signer, n.nominee, (p) => {
          if (p.signature) setNewSig(p.signature);
          report(p.step - 1, p.stage);
        });
        if (result.invite.status !== 'sent') return { outcome: result.invite };
        if (result.approval?.status === 'sent') return { outcome: result.approval };
        // Step 1 went through, step 2 didn't: show step 1 as the one that is done.
        setPartial(result);
        report(0, 'done');
        return {
          outcome: result.invite,
          message: (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Step 2 didn’t go through: {secondStepProblem(result.approval)} The nomination is on
              chain and waiting. Once it shows in the queue, approve it there like any other
              decision.
            </Typography>
          ),
        };
      }}
      successTitle={
        partial ? 'Step 1 done: the nomination is on chain' : 'Approved: the clock has started'
      }
      successText={
        partial ? null : (
          <Typography variant="body2">
            The nomination and your approval count once they are in a block, usually within a couple
            of minutes. After yours it needs{' '}
            {plural(Math.max(0, facts.needed - 1), 'more approval', 'more approvals')}.
          </Typography>
        )
      }
    />
  );
}
