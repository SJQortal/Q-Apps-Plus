/**
 * What a Minter Admin can propose from the Decisions screen, with the Hub
 * action and fee type each one uses, and the check run before Hub opens.
 */
import { getNameOwner, isAddress } from '../../data/accounts';
import { getMembership } from '../../data/group';
import type { GroupTxType } from '../../data/types';
import type { ProposalKind } from '../../writes/flows';
import {
  guardAddAdmin,
  guardBan,
  guardCancelBan,
  guardCancelInvite,
  guardKick,
  guardRemoveAdmin,
} from '../../writes/guards';
import type { Signer } from '../../writes/runner';

export type ProposeKind = ProposalKind;

export interface ProposeKindInfo {
  /** Menu label. */
  label: string;
  /** One line under the label. */
  description: string;
  action: string;
  txType: GroupTxType;
}

export const PROPOSE_KINDS: Record<ProposeKind, ProposeKindInfo> = {
  kick: {
    label: 'Remove a member',
    description: 'Out of MINTER, or decline a join request. They keep their level.',
    action: 'KICK_FROM_GROUP',
    txType: 'GROUP_KICK',
  },
  ban: {
    label: 'Ban an account',
    description: 'Permanent, or up to 24 days. A ban also removes a member.',
    action: 'BAN_FROM_GROUP',
    txType: 'GROUP_BAN',
  },
  addAdmin: {
    label: 'Make a Minter Admin',
    description: 'A MINTER member who then signs decisions too.',
    action: 'ADD_GROUP_ADMIN',
    txType: 'ADD_GROUP_ADMIN',
  },
  removeAdmin: {
    label: 'Remove a Minter Admin',
    description: 'Takes away the admin role. They stay a MINTER member.',
    action: 'REMOVE_GROUP_ADMIN',
    txType: 'REMOVE_GROUP_ADMIN',
  },
  cancelBan: {
    label: 'Lift a ban',
    description: 'So they can be nominated again.',
    action: 'CANCEL_GROUP_BAN',
    txType: 'CANCEL_GROUP_BAN',
  },
  cancelInvite: {
    label: 'Cancel an approved invite',
    description: 'One approved invite you pick, with your signature added.',
    action: 'CANCEL_GROUP_INVITE',
    txType: 'CANCEL_GROUP_INVITE',
  },
};

export const PROPOSE_ORDER: ProposeKind[] = [
  'kick',
  'ban',
  'addAdmin',
  'removeAdmin',
  'cancelBan',
  'cancelInvite',
];

export type Resolved = { address: string; name: string | null | undefined } | { error: string };

/** A registered name or an address, as typed, to an address. */
export async function resolvePerson(input: string): Promise<Resolved> {
  const text = input.trim().replace(/^@/, '');
  if (!text) return { error: 'Enter a registered name or a Qortal address.' };
  if (isAddress(text)) return { address: text, name: undefined };
  const owner = await getNameOwner(text);
  if (owner) return { address: owner, name: text };
  if (/^Q[1-9A-HJ-NP-Za-km-z]{20,}$/.test(text))
    return { error: 'That isn’t a valid Qortal address. Check it and try again.' };
  return { error: `No account owns the name “${text}”.` };
}

export type SubjectCheck =
  | { status: 'ok' }
  | { status: 'blocked'; reason: string }
  /** Kick or ban of a Minter Admin: their admin role has to go first. */
  | { status: 'admin' };

/** The same guard the write runs, shown before Hub opens. */
export async function checkSubject(
  kind: ProposeKind,
  signer: Signer,
  address: string
): Promise<SubjectCheck> {
  if (kind === 'kick' || kind === 'ban') {
    const membership = await getMembership(address, { force: true });
    if (membership.isAdmin) return { status: 'admin' };
  }
  const reason = await {
    kick: () => guardKick(signer, address),
    // The length is checked on its own in the form.
    ban: () => guardBan(signer, address, 0),
    addAdmin: () => guardAddAdmin(signer, address),
    removeAdmin: () => guardRemoveAdmin(signer, address),
    cancelBan: () => guardCancelBan(signer, address),
    cancelInvite: () => guardCancelInvite(signer, address),
  }[kind]();
  return reason ? { status: 'blocked', reason } : { status: 'ok' };
}
