/**
 * A person's own admin role:
 *
 * - "Become a Minter Admin": a MINTER member proposes themselves. Only
 *   Minter Admins sign, so it is one Hub step; then the Minter Admins decide.
 * - "Step down as Minter Admin": an admin proposes their own removal, and
 *   signs it straight after like any admin proposal. It still needs the
 *   other Minter Admins' signatures. Like any admin removal it moves the
 *   target: what it would tip over shows first, and Hub only opens once
 *   "I've checked these" is ticked.
 *
 * Both are ProposeSignDialog with the app's words (rules/adminChange.ts).
 * The guards check again before Hub opens.
 *
 * Becoming one can come with a short statement, posted under the member's
 * registered name as the proposal's first public comment: one more Hub step
 * (PUBLISH_QDN_RESOURCE, 0.01 QORT), only when something is written.
 */
import { useState } from 'react';
import { TextField, Typography } from '@mui/material';
import { decisionCommentKey } from '../../data/commentRecords';
import type { DecisionsData } from '../../data/decisions';
import { peekQuery } from '../../data/query';
import { postComment } from '../../writes/comments';
import {
  ADMIN_CHANGE_TITLE,
  OWN_ADMIN_ROLE_LEAD,
  type OwnAdminRole,
} from '../../rules/adminChange';
import { decisionTitle } from '../../rules/decision';
import { projectShift } from '../../rules/targetShift';
import { displayName, shortAddress } from '../../utils/format';
import type { Signer } from '../../writes/runner';
import { ProposeSignDialog, type ProposalFacts } from './ProposeSignDialog';
import type { LabelOf } from './targetShiftUi';
import { useShift } from './useShift';

/** A statement is a comment, and comments stay short. */
const STATEMENT_MAX = 500;

export interface AdminRoleDialogProps {
  open: boolean;
  mode: OwnAdminRole;
  signer: Signer | null;
  /** Their own registered name, if any. */
  name: string | null;
  facts: ProposalFacts;
  /**
   * The waiting decisions, for a step-down: what it would do to the target
   * (and the "I've checked these" box when it tips any over), as Propose does.
   */
  queue?: DecisionsData | null;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}

export function AdminRoleDialog({
  open,
  mode,
  signer,
  name,
  facts,
  queue,
  onClose,
  returnFocus,
}: AdminRoleDialogProps) {
  const [statement, setStatement] = useState('');
  const shift = useShift(mode === 'stepDown' ? queue : null);
  if (!signer) return null;
  const impact = shift
    ? projectShift(shift.state, shift.list, [{ kind: 'removeAdmin', subject: signer.address }])
    : null;
  const labelOf: LabelOf = (signature) => {
    const d = queue?.decisions.find((x) => x.signature === signature);
    if (!d) return 'A waiting decision';
    if (!d.subject) return `${decisionTitle(d)} (Core doesn’t say for whom)`;
    const admin = queue?.admins.admins.find((a) => a.member === d.subject);
    const known = admin?.primaryName ?? peekQuery<string | null>(`name:${d.subject}`) ?? null;
    return `${decisionTitle(d)}: ${displayName(known, d.subject)}`;
  };
  const become = mode === 'become';
  const text = statement.trim();
  const followUp =
    become && name && text
      ? {
          step: {
            action: 'PUBLISH_QDN_RESOURCE',
            title: 'Post your statement',
            detail: (
              <Typography variant="body2">
                Hub shows a small JSON record published under {name}: your statement, as the first
                comment on your proposal.
              </Typography>
            ),
            feeTxType: 'ARBITRARY' as const,
          },
          run: async (proposalSignature: string, onStage: Parameters<typeof postComment>[2]) =>
            (
              await postComment(
                { ...signer, name },
                { key: decisionCommentKey(proposalSignature), text },
                onStage
              )
            ).outcome,
        }
      : null;
  return (
    <ProposeSignDialog
      open={open}
      proposal={{ kind: become ? 'addAdmin' : 'removeAdmin', subject: signer.address }}
      who={name ?? shortAddress(signer.address)}
      signer={signer}
      facts={facts}
      title={ADMIN_CHANGE_TITLE[mode]}
      // Only a Minter Admin can sign: stepping down is signed too, becoming one isn't.
      withSignature={!become}
      lead={OWN_ADMIN_ROLE_LEAD[mode]}
      details={
        become ? (
          <>
            <Typography>
              Minter Admins sign MINTER’s decisions: new minters, removals and bans, and changes to
              the Minter Admins. It works best when you can look at Decisions every few days.
            </Typography>
            {name ? (
              <TextField
                label="A short statement (optional)"
                helperText={`Published under ${name} as the first comment on your proposal, for everyone to read: one more Hub step, 0.01 QORT. Leave it empty to skip it. ${text.length} / ${STATEMENT_MAX}`}
                value={statement}
                onChange={(e) => setStatement(e.target.value.slice(0, STATEMENT_MAX))}
                multiline
                minRows={2}
                fullWidth
                sx={{ mt: 2 }}
                slotProps={{ htmlInput: { maxLength: STATEMENT_MAX } }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                With a registered name you could add a short statement, posted as a public comment.
                You can propose without one.
              </Typography>
            )}
          </>
        ) : (
          <Typography>
            You stay a MINTER member, and your level and minting don’t change. Until it is approved
            you are still a Minter Admin and can sign as usual.
          </Typography>
        )
      }
      followUp={followUp}
      impact={impact}
      labelOf={impact ? labelOf : undefined}
      onClose={onClose}
      returnFocus={returnFocus}
    />
  );
}
