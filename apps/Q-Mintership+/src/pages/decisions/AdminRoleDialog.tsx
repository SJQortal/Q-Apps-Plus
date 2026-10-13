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
 */
import { Typography } from '@mui/material';
import {
  ADMIN_CHANGE_TITLE,
  OWN_ADMIN_ROLE_LEAD,
  type OwnAdminRole,
} from '../../rules/adminChange';
import { shortAddress } from '../../utils/format';
import type { Signer } from '../../writes/runner';
import { ProposeSignDialog, type ProposalFacts } from './ProposeSignDialog';

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
  if (!signer) return null;
  const become = mode === 'become';
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
            {/* An optional short statement (published as a public comment) goes here. */}
          </>
        ) : (
          <Typography>
            You stay a MINTER member, and your level and minting don’t change. Until it is approved
            you are still a Minter Admin and can sign as usual.
          </Typography>
        )
      }
      onClose={onClose}
      returnFocus={returnFocus}
    />
  );
}
