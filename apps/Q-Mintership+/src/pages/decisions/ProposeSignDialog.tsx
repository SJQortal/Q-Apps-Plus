/**
 * A Minter Admin's proposal and their own signature on it: one guided step
 * of two Hub confirmations (propose it, then sign it), as for a
 * nomination's first signature, because a proposal doesn't count as its
 * proposer's signature. Both fees are stated up front. If the proposal goes
 * through and the signature doesn't, the result says so plainly: the
 * proposal is waiting, and can be signed from the queue like any decision.
 * An admin change first says what it does to the target; when that changes
 * any waiting decision, "I've checked these" must be ticked before Hub opens.
 *
 * A member who isn't a Minter Admin (Become a Minter Admin) can't sign, so
 * for them (`withSignature` false) it is the proposal alone, one Hub step,
 * and the dialog says the Minter Admins decide from there.
 */
import { useState, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { FeeNote } from '../../components/common/FeeNote';
import { HubStepDialog, type HubStep } from '../../components/common/HubStepDialog';
import { SignaturePrefix } from '../../components/common/SignaturePrefix';
import { plural } from '../../utils/format';
import { SIGN_NEW_TX_CHECK } from '../../writes/explain';
import { PROPOSAL_TX_TYPE, proposeAndSign, type Proposal } from '../../writes/flows';
import type { Signer } from '../../writes/runner';
import { secondStepProblem, signingWindowText } from './decisionUi';
import { PROPOSE_KINDS } from './proposeKinds';
import { hasImpact, type ShiftScenario } from '../../rules/targetShift';
import { TargetImpact } from './TargetImpact';
import type { LabelOf } from './targetShiftUi';
import { useAcknowledge } from './useAcknowledge';

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
  /**
   * The proposer is a Minter Admin, so their own signature follows (default).
   * False for a member who isn't one: one Hub step, then the admins decide.
   */
  withSignature?: boolean;
  onClose: () => void;
  /** Back to the form, keeping what was typed. */
  onBack?: () => void;
  returnFocus?: () => HTMLElement | null;
  /** An admin change: what it does to the target if it passes. */
  impact?: ShiftScenario | null;
  labelOf?: LabelOf;
}

/** How the last run ended, for the result's words. */
type Ending = 'both' | 'partial' | 'proposalOnly';

export function ProposeSignDialog({
  open,
  proposal,
  who,
  signer,
  facts,
  title,
  lead = 'This proposes it.',
  details,
  withSignature = true,
  onClose,
  onBack,
  returnFocus,
  impact,
  labelOf,
}: ProposeSignDialogProps) {
  const [ending, setEnding] = useState<Ending>(withSignature ? 'both' : 'proposalOnly');
  // The proposal step 1 made, which step 2 signs: Hub shows it as "pendingSignature".
  const [newSig, setNewSig] = useState<string | null>(null);
  const shift = impact && labelOf ? impact : null;
  const ack = useAcknowledge(
    open && proposal && shift ? `${proposal.kind}:${proposal.subject}` : null
  );
  const mustCheck = hasImpact(shift);
  if (!proposal) return null;
  const info = PROPOSE_KINDS[proposal.kind];
  const txType = PROPOSAL_TX_TYPE[proposal.kind];
  const after = Math.max(0, facts.needed - 1);
  const window = signingWindowText(facts.maximumBlockDelay, facts.msPerBlock);
  // The address's start, unless `who` already is the short address.
  const start = proposal.subject.slice(0, 6);
  const shown = who.startsWith(start) ? who : `${who} (${start}…)`;
  const proposeStep: HubStep = {
    action: info.action,
    title: 'Propose it',
    detail: <Typography variant="body2">Hub shows {shown} and the group MINTER.</Typography>,
    feeTxType: txType,
  };
  const signStep: HubStep = {
    action: 'SIGN_TRANSACTION',
    title: 'Sign it',
    detail: (
      <Typography variant="body2">
        Hub will show Tx type GROUP_APPROVAL, &quot;approval&quot;: true and a box to tick. The
        &quot;pendingSignature&quot; is your new proposal’s own, made in step 1.
      </Typography>
    ),
    check: SIGN_NEW_TX_CHECK,
    running: newSig ? (
      <>
        For this proposal, &quot;pendingSignature&quot; starts with{' '}
        <SignaturePrefix signature={newSig} />.
      </>
    ) : null,
    feeTxType: 'GROUP_APPROVAL',
  };
  return (
    <HubStepDialog
      open={open && Boolean(signer)}
      onClose={() => {
        onClose();
        setEnding(withSignature ? 'both' : 'proposalOnly');
      }}
      onBack={onBack}
      returnFocus={returnFocus}
      title={title}
      intro={
        <>
          {details}
          <Typography sx={details ? { mt: 1 } : undefined}>
            {lead} It happens only if {facts.needed} Minter Admins sign within {window}.
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
          {withSignature ? (
            <Typography sx={{ mt: 1 }}>
              Your proposal doesn’t count as your signature, so you sign it straight after: two Hub
              confirmations, one after the other.
            </Typography>
          ) : (
            <Typography sx={{ mt: 1 }}>
              Only Minter Admins sign, so this is one Hub confirmation: once it is proposed, the
              Minter Admins decide.
            </Typography>
          )}
          {/* One step states its own fee; two add up here. */}
          {withSignature ? (
            <Typography sx={{ mt: 1 }}>
              <FeeNote txType={txType} times={2} prefix="Fees in total" />
            </Typography>
          ) : null}
        </>
      }
      beforeStart={mustCheck ? ack.confirm : undefined}
      steps={withSignature ? [proposeStep, signStep] : [proposeStep]}
      run={async (report) => {
        if (!signer) return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
        setEnding(withSignature ? 'both' : 'proposalOnly');
        setNewSig(null);
        const result = await proposeAndSign(signer, proposal, (p) => {
          if (p.signature) setNewSig(p.signature);
          report(p.step - 1, p.stage);
        });
        if (result.proposal.status !== 'sent') return { outcome: result.proposal };
        if (!result.withSignature) {
          setEnding('proposalOnly');
          return { outcome: result.proposal };
        }
        if (result.approval?.status === 'sent') return { outcome: result.approval };
        // Step 1 went through, step 2 didn't: show step 1 as the one that is done.
        setEnding('partial');
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
      successTitle={
        ending === 'partial'
          ? 'Step 1 done: proposed'
          : ending === 'proposalOnly'
            ? 'Proposed'
            : 'Proposed and signed'
      }
      successText={
        ending === 'partial' ? null : ending === 'proposalOnly' ? (
          <Typography variant="body2">
            Your proposal counts once it is in a block, usually within a couple of minutes. The
            Minter Admins will now decide: it needs {plural(facts.needed, 'signature')} within{' '}
            {window}, or it expires.
          </Typography>
        ) : (
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
