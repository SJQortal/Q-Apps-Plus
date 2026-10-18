/**
 * The words of each + Propose page (pages/decisions/propose/ProposePage.tsx),
 * kept out of the component files: the line under the title (as Propose
 * nomination's "Pick the person, say why, add links."), what the submit bar
 * says before anyone is picked, its button (short on a phone, with the
 * name on wider screens, as Propose nomination's), what happens once it
 * passes, and where Decisions shows it.
 */
import type { DecisionsKind } from '../decisionsViews';
import type { ProposeKind } from '../proposeKinds';

export const PROPOSE_SUBTITLE: Record<ProposeKind, string> = {
  kick: 'Pick the member, say why.',
  decline: 'Pick whose request, say why.',
  ban: 'Pick the account, say why and for how long.',
  addAdmin: 'Pick the member.',
  removeAdmin: 'Pick the Minter Admin.',
  cancelBan: 'Pick whose ban to lift.',
  cancelInvite: 'Pick the invite, or cancel the old ones in one go.',
};

/** The submit bar before anyone is picked. */
export const PICK_FIRST: Record<ProposeKind, string> = {
  kick: 'Pick a member first.',
  decline: 'Pick whose request first.',
  ban: 'Pick an account first.',
  addAdmin: 'Pick a member first.',
  removeAdmin: 'Pick a Minter Admin first.',
  cancelBan: 'Pick a ban first.',
  cancelInvite: 'Pick an invite first.',
};

/** The submit button: short, and with the name where there is room. */
export const SUBMIT_LABEL: Record<ProposeKind, { short: string; named: (name: string) => string }> =
  {
    kick: { short: 'Propose removal', named: (n) => `Propose removing ${n}` },
    decline: { short: 'Propose decline', named: (n) => `Propose declining ${n}` },
    ban: { short: 'Propose ban', named: (n) => `Propose banning ${n}` },
    addAdmin: { short: 'Propose Minter Admin', named: (n) => `Propose ${n} as Minter Admin` },
    removeAdmin: {
      short: 'Propose removal',
      named: (n) => `Propose removing ${n} as Minter Admin`,
    },
    cancelBan: { short: 'Propose lifting', named: (n) => `Propose lifting ${n}’s ban` },
    cancelInvite: {
      short: 'Propose cancelling',
      named: (n) => `Propose cancelling ${n}’s invite`,
    },
  };

/** What it does once enough Minter Admins approve. */
export const ONCE_IT_PASSES: Record<ProposeKind, string> = {
  kick: 'Once it passes they leave MINTER. They keep their level, and can be nominated again.',
  decline: 'Once it passes their join request is gone. They can send a new join request later.',
  ban: 'Once it passes they are banned from MINTER for as long as you set, or until the Minter Admins lift it. A ban also removes a member.',
  addAdmin: 'Once it passes they approve or reject decisions too.',
  removeAdmin: 'Once it passes they are no longer a Minter Admin. They stay a MINTER member.',
  cancelBan: 'Once it passes the ban is lifted, and they can be nominated again.',
  cancelInvite: 'Once it passes their approved invite is gone.',
};

/** Its tab in Decisions (All Decisions narrowed to its kind). */
export const KIND_TAB: Record<ProposeKind, DecisionsKind> = {
  kick: 'removals',
  decline: 'declines',
  ban: 'bans',
  addAdmin: 'newAdmins',
  removeAdmin: 'removeAdmins',
  cancelBan: 'liftBans',
  cancelInvite: 'cancelInvites',
};
