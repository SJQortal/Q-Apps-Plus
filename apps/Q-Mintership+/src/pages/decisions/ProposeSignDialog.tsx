/**
 * A Minter Admin's proposal and their own signature on it: one guided step
 * of two Hub confirmations (propose it, then sign it), as for a
 * nomination's first signature, because a proposal doesn't count as its
 * proposer's signature. Both fees are stated up front. If the proposal goes
 * through and the signature doesn't, the result says so plainly: the
 * proposal is waiting, and can be signed from the queue like any decision.
 */
import { useState, type ReactNode } from 'react';
import { Typography } from '@mui/material';
import { FeeNote } from '../../components/common/FeeNote';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import { plural } from '../../utils/format';
import { PROPOSAL_TX_TYPE, proposeAndSign, type Proposal } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { secondStepProblem, signingWindowText } from './decisionUi';
import { PROPOSE_KINDS } from './proposeKinds';

/** The numbers a proposal's words need. */
export interface ProposalFacts {
  needed: number;
  maximumBlockDelay: number;
  msPerBlock: number;
}

export interface ProposeSignDialogProps {
  open: boolean;
  proposal: Proposal | null;
  /** The account it is about, as shown ("Kai Target"). */
  who: string;
  signer: Signer | null;
  facts: ProposalFacts;
  title: string;
  /** What this proposes, in one sentence. */
  lead?: string;
  /** Extra lines before it (ban length, reason). */
  details?: ReactNode;
  onClose: () => void;
  /** Back to the form, keeping what was typed. */
  onBack?: () => void;
  returnFocus?: () => HTMLElement | null;
}

export function ProposeSignDialog({
  open,
  proposal,
  who,
  signer,
  facts,
  title,
  lead = 'This proposes it.',
  details,
  onClose,
  onBack,
  returnFocus,
}: ProposeSignDialogProps) {
  // Step 1 went through and step 2 didn't.
  const [partial, setPartial] = useState(false);
  if (!proposal) return null;
  const info = PROPOSE_KINDS[proposal.kind];
  const txType = PROPOSAL_TX_TYPE[proposal.kind];
  const after = Math.max(0, facts.needed - 1);
  // The address's start, unless `who` already is the short address.
  const start = proposal.subject.slice(0, 6);
  const shown = who.startsWith(start) ? who : `${who} (${start}…)`;
  return (
    <HubStepDialog
      open={open && Boolean(signer)}
      onClose={() => {
        onClose();
        setPartial(false);
      }}
      onBack={onBack}
      returnFocus={returnFocus}
      title={title}
      intro={
        <>
          {details}
          <Typography sx={details ? { mt: 1 } : undefined}>
            {lead} It happens only if {facts.needed} Minter Admins sign within{' '}
            {signingWindowText(facts.maximumBlockDelay, facts.msPerBlock)}.
          </Typography>
          <Typography sx={{ mt: 1 }}>
            Your proposal doesn’t count as your signature, so you sign it straight after: two Hub
            confirmations, one after the other.
          </Typography>
          <Typography sx={{ mt: 1 }}>
            <FeeNote txType={txType} times={2} prefix="Fees in total" />
          </Typography>
        </>
      }
      steps={[
        {
          action: info.action,
          title: 'Propose it',
          detail: <Typography variant="body2">Hub shows {shown} and the group MINTER.</Typography>,
          feeTxType: txType,
        },
        {
          action: 'SIGN_TRANSACTION',
          title: 'Sign it',
          detail: (
            <Typography variant="body2">
              Hub will show Tx type GROUP_APPROVAL, &quot;approval&quot;: true and a box to tick.
              The &quot;pendingSignature&quot; is your new proposal’s own, made in step 1.
            </Typography>
          ),
          feeTxType: 'GROUP_APPROVAL',
        },
      ]}
      run={async (report) => {
        if (!signer) return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        setPartial(false);
        const result = await proposeAndSign(signer, proposal, (p) => report(p.step - 1, p.stage));
        if (result.proposal.status !== 'sent') return { outcome: result.proposal };
        if (result.approval?.status === 'sent') return { outcome: result.approval };
        // Step 1 went through, step 2 didn't: show step 1 as the one that is done.
        setPartial(true);
        report(0, 'done');
        return {
          outcome: result.proposal,
          message: (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Step 2 didn’t go through: {secondStepProblem(result.approval)} Your proposal is
              waiting for signatures. Once it is in a block, sign it in the queue like any other
              decision.
            </Typography>
          ),
        };
      }}
      successTitle={partial ? 'Step 1 done: proposed' : 'Proposed and signed'}
      successText={
        partial ? null : (
          <Typography variant="body2">
            Your proposal and your signature count once they are in a block, usually within a couple
            of minutes. After yours it needs{' '}
            {after ? plural(after, 'more signature', 'more signatures') : 'no more signatures'}.
          </Typography>
        )
      }
    />
  );
}
