/**
 * Who may propose a change to the Minter Admins in this app. Core allows
 * more; the app keeps to these rules (Simon, 2026-10-13):
 *
 * - Adding a Minter Admin: any MINTER member may propose themselves
 *   ("Become a Minter Admin"); a Minter Admin may also propose another
 *   MINTER member. Becoming one is suggested from level 5: below it, it is
 *   still possible, and a note says level 5+ is suggested.
 * - Removing a Minter Admin: only Minter Admins may propose removing another
 *   admin; any admin may step down (their own removal, which still needs
 *   the other admins' signatures). MINTER's owner account, never.
 *
 * Only a Minter Admin can sign, so only an admin's proposal is followed by
 * the proposer's own signature; a member's is one Hub step, and the admins
 * decide. Pure; the guards (writes/guards.ts) feed it fresh reads.
 */

export type AdminChangeKind = 'addAdmin' | 'removeAdmin';

/** What a proposal about the admin role is, in the app's words. */
export type AdminChangeMode =
  /** A member proposes themselves. */
  | 'become'
  /** A Minter Admin proposes another member. */
  | 'promote'
  /** A Minter Admin proposes their own removal. */
  | 'stepDown'
  /** A Minter Admin proposes removing another admin. */
  | 'remove';

export function adminChangeMode(kind: AdminChangeKind, self: boolean): AdminChangeMode {
  if (kind === 'addAdmin') return self ? 'become' : 'promote';
  return self ? 'stepDown' : 'remove';
}

/** What a person can propose about their own role. */
export type OwnAdminRole = Extract<AdminChangeMode, 'become' | 'stepDown'>;

/** Become one (a MINTER member), step down (a Minter Admin), or nothing (anyone else). */
export function ownAdminRole(facts: { isMember: boolean; isAdmin: boolean }): OwnAdminRole | null {
  if (facts.isAdmin) return 'stepDown';
  return facts.isMember ? 'become' : null;
}

/** The button and dialog title for each mode. */
export const ADMIN_CHANGE_TITLE: Record<AdminChangeMode, string> = {
  become: 'Become a Minter Admin',
  promote: 'Make a Minter Admin',
  stepDown: 'Step down as Minter Admin',
  remove: 'Remove a Minter Admin',
};

/** Becoming a Minter Admin is suggested from this level. Below it, it is still possible. */
export const BECOME_SUGGESTED_LEVEL = 5;

/** The note beside Become a Minter Admin for a member below the suggested level; null from it. */
export function becomeLevelNote(level: number): string | null {
  if (level >= BECOME_SUGGESTED_LEVEL) return null;
  return `Level ${BECOME_SUGGESTED_LEVEL}+ is suggested for Minter Admins, and you’re level ${level}. You can still propose yourself.`;
}

/** What a proposal about one's own role does, in one sentence, before Hub opens. */
export const OWN_ADMIN_ROLE_LEAD: Record<OwnAdminRole, string> = {
  become: 'This proposes you as a Minter Admin.',
  stepDown: 'This proposes that you step down: you give up your Minter Admin role.',
};

export interface AdminChangeFacts {
  kind: AdminChangeKind;
  /** The proposer is the account it is about. */
  self: boolean;
  proposerIsAdmin: boolean;
  /** The account it is about, as the chain says now. */
  subjectIsMember: boolean;
  subjectIsAdmin: boolean;
  /** The account it is about is MINTER's owner (the null account). */
  subjectIsOwner: boolean;
  /** The same change is already waiting for signatures. */
  waiting: boolean;
}

export type AdminChangeBlock =
  /** MINTER's owner account can't be removed. */
  | 'owner'
  /** Only a Minter Admin can propose this (someone else's role, or stepping down). */
  | 'adminsOnly'
  /** Only MINTER members can become Minter Admins. */
  | 'notMember'
  | 'alreadyAdmin'
  | 'notAdmin'
  | 'waiting';

/** Why this proposal can't go ahead under the app's rules, or null. */
export function adminChangeBlock(f: AdminChangeFacts): AdminChangeBlock | null {
  if (f.kind === 'removeAdmin' && f.subjectIsOwner) return 'owner';
  // A member may propose only themselves, and only for the role; everything else is for admins.
  const memberMayPropose = f.kind === 'addAdmin' && f.self;
  if (!memberMayPropose && !f.proposerIsAdmin) return 'adminsOnly';
  if (f.kind === 'addAdmin') {
    if (f.subjectIsAdmin) return 'alreadyAdmin';
    if (!f.subjectIsMember) return 'notMember';
  } else if (!f.subjectIsAdmin) return 'notAdmin';
  if (f.waiting) return 'waiting';
  return null;
}

/** The block in plain words, as the person proposing reads it. */
export function adminChangeBlockText(
  block: AdminChangeBlock,
  kind: AdminChangeKind,
  self: boolean
): string {
  const mode = adminChangeMode(kind, self);
  switch (block) {
    case 'owner':
      return "MINTER's owner account can't be removed.";
    case 'adminsOnly':
      if (mode === 'promote')
        return 'Only Minter Admins can propose another member. Any member can propose themselves with Become a Minter Admin.';
      if (mode === 'stepDown') return 'You’re not a Minter Admin right now.';
      return 'Only Minter Admins can do this, and your account is not one right now.';
    case 'notMember':
      return self
        ? 'Only MINTER members can become Minter Admins, and your account isn’t in MINTER.'
        : 'Only MINTER members can become Minter Admins.';
    case 'alreadyAdmin':
      return self ? 'You’re already a Minter Admin.' : 'Already a Minter Admin.';
    case 'notAdmin':
      return 'Not a Minter Admin.';
    case 'waiting':
      switch (mode) {
        case 'become':
          return 'Your proposal to become a Minter Admin is already waiting for approvals.';
        case 'promote':
          return 'Making this member an admin is already waiting for approvals.';
        case 'stepDown':
          return 'Your step-down is already waiting for approvals.';
        case 'remove':
          return 'Removing this admin is already waiting for approvals.';
      }
  }
}

/**
 * Whether the proposer's own signature follows the proposal: only a Minter
 * Admin can sign, so a member's proposal is the one step.
 */
export function chainsOwnSignature(proposerIsAdmin: boolean): boolean {
  return proposerIsAdmin;
}
