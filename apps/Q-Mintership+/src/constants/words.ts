/**
 * Words used on more than one screen, kept in one place so every screen says
 * the same thing (docs/DESIGN.md → Copy: sentence case) and a change of
 * wording is one edit.
 */

/**
 * The main action of level 5+ members and Minter Admins: start a nomination.
 * Every button, link, page title and empty-state action that offers it reads
 * this one constant, in sentence case (docs/DESIGN.md → Copy). To show it in
 * title case instead, change it here to 'Propose Nomination'.
 */
export const PROPOSE_NOMINATION = 'Propose nomination';

/** The same action for one person: "Propose nomination for Kit Kicked". */
export function proposeNominationFor(who: string): string {
  return `${PROPOSE_NOMINATION} for ${who}`;
}

/**
 * An open join request to MINTER, however it was sent: by accepting a
 * nomination, or with "Show you're ready to mint". The same words wherever
 * the person sees their own.
 */
export const READY_DONE = "You're ready ✓";

/** What follows READY_DONE while the nomination still needs signatures. */
export const READY_DONE_NEXT = "when the admins approve, you're in at once.";

/** Someone else's open join request, on their nomination card. */
export const READY_LABEL = 'Ready to mint';
