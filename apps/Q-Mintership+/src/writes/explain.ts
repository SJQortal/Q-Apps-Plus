/**
 * What each Hub confirmation will show, in plain words, so the app can
 * explain it before it opens (docs/DESIGN.md → Dialogs). Taken from Hub's
 * own texts (get.ts getUserPermission calls, 2026-10-12).
 */
export interface HubDialogText {
  /** What Hub's dialog asks. */
  hubAsks: string;
  /** What the person should check in it. */
  check: string[];
  /** Extra notes about this dialog. */
  notes?: string[];
}

export const HUB_DIALOGS: Record<string, HubDialogText> = {
  INVITE_TO_GROUP: {
    hubAsks: 'Hub asks you to allow inviting this person to the group MINTER.',
    check: [
      'The name or address is the person you are nominating.',
      'The group is MINTER.',
      'The fee.',
    ],
  },
  SIGN_TRANSACTION: {
    hubAsks:
      'Hub asks you to sign and process a transaction, and shows it as raw data with a box to tick.',
    check: [
      'Tx type: GROUP_APPROVAL.',
      '"approval": true.',
      '"pendingSignature" starts with the characters shown here.',
      'Tick the box, then Accept.',
    ],
    notes: ['Hub shows the fee inside the data as "fee": "0.01000000".'],
  },
  JOIN_GROUP: {
    hubAsks: 'Hub asks you to confirm joining the group MINTER.',
    check: ['The group is MINTER.', 'The fee.'],
  },
  KICK_FROM_GROUP: {
    hubAsks: 'Hub asks you to allow removing this member from MINTER.',
    check: ['The member.', 'The group is MINTER.', 'The fee.'],
    notes: ['This only proposes the removal. It happens if enough Minter Admins sign.'],
  },
  BAN_FROM_GROUP: {
    hubAsks: 'Hub asks you to allow banning this account from MINTER.',
    check: ['The account.', 'The group is MINTER.', 'The fee.'],
    notes: ['This only proposes the ban. It happens if enough Minter Admins sign.'],
  },
  CANCEL_GROUP_BAN: {
    hubAsks: 'Hub asks you to allow cancelling the ban on this account.',
    check: ['The account.', 'The group is MINTER.', 'The fee.'],
    notes: ['This only proposes lifting the ban. It happens if enough Minter Admins sign.'],
  },
  CANCEL_GROUP_INVITE: {
    hubAsks: 'Hub asks you to allow cancelling the group invite for this account.',
    check: ['The account.', 'The group is MINTER.', 'The fee.'],
    notes: ['This only proposes the cancellation. It happens if enough Minter Admins sign.'],
  },
  ADD_GROUP_ADMIN: {
    hubAsks: 'Hub asks you to allow adding this member as an admin.',
    check: ['The member.', 'The group is MINTER.', 'The fee.'],
    notes: ['This only proposes it. It happens if enough Minter Admins sign.'],
  },
  REMOVE_GROUP_ADMIN: {
    hubAsks: 'Hub asks you to allow removing this admin.',
    check: ['The admin.', 'The group is MINTER.', 'The fee.'],
    notes: ['This only proposes it. It happens if enough Minter Admins sign.'],
  },
  PUBLISH_QDN_RESOURCE: {
    hubAsks: 'Hub asks you to publish a small record to QDN under your name.',
    check: ['The service is JSON.', 'The identifier starts with qmp-.', 'The fee.'],
  },
};

/** Hub's approval queue gives up after this long; mention it so nobody waits on a closed dialog. */
export const HUB_DIALOG_SECONDS = 60;
