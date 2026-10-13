/**
 * A person's own admin role:
 *
 * - "Become a Minter Admin": a MINTER member proposes themselves. Only
 *   Minter Admins sign, so it is one Hub step; then the Minter Admins decide.
 * - "Step down as Minter Admin": an admin proposes their own removal, and
 *   signs it straight after like any admin proposal. It still needs the
 *   other Minter Admins' signatures.
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
import { postComment } from '../../writes/comments';
import {
  ADMIN_CHANGE_TITLE,
  OWN_ADMIN_ROLE_LEAD,
  type OwnAdminRole,
} from '../../rules/adminChange';
import { shortAddress } from '../../utils/format';
import type { Signer } from '../../writes/runner';
import { ProposeSignDialog, type ProposalFacts } from './ProposeSignDialog';

/** A statement is a comment, and comments stay short. */
const STATEMENT_MAX = 500;

export interface AdminRoleDialogProps {
  open: boolean;
  mode: OwnAdminRole;
  signer: Signer | null;
  /** Their own registered name, if any. */
  name: string | null;
  facts: ProposalFacts;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}

export function AdminRoleDialog({
  open,
  mode,
  signer,
  name,
  facts,
  onClose,
  returnFocus,
}: AdminRoleDialogProps) {
  const [statement, setStatement] = useState('');
  if (!signer) return null;
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
                helperText={`Published under ${name} as the first comment on your proposal, for everyone to read: one more Hub step, 0.01 QORT. Leave it empty to skip it.`}
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
      onClose={onClose}
      returnFocus={returnFocus}
    />
  );
}
