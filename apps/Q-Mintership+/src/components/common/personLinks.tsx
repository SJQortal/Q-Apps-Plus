/**
 * Where a person's name and avatar link to. Everywhere in the app it is
 * their page (`/people/<address>`, "open their page"); inside the Explorer
 * it is their account in the Explorer ("explore this account"), with router
 * state that tells the account page the link came from the Explorer (so the
 * trail grows instead of starting again). PersonChip, PersonInline and
 * AvatarStack (Person.tsx) read it, and so does every list built from them,
 * such as History's TimelineList, so a reused list follows the page it is on.
 *
 *   <PersonLinkContext value={EXPLORER_PERSON_LINKS}>…</PersonLinkContext>
 */
import { createContext, useContext } from 'react';
import { explorerAccountPath, personPath } from '../../routes/paths';

export interface PersonLinks {
  /** The path a person's link opens. */
  to: (address: string) => string;
  /** Router state the link carries. */
  state?: unknown;
  /** What the link does, after the name in its accessible name: "Ada: open their page". */
  verb: string;
}

export const DEFAULT_PERSON_LINKS: PersonLinks = {
  to: personPath,
  verb: 'open their page',
};

/** Inside the Explorer: every person opens their account there. */
export const EXPLORER_PERSON_LINKS: PersonLinks = {
  to: (address) => explorerAccountPath(address),
  state: { via: 'explorer' },
  verb: 'explore this account',
};

/**
 * The Explorer's landing page: accounts open in the Explorer, but each one
 * starts a new trail (it isn't a step from another account).
 */
export const EXPLORER_START_LINKS: PersonLinks = {
  to: (address) => explorerAccountPath(address),
  verb: 'explore this account',
};

export const PersonLinkContext = createContext<PersonLinks>(DEFAULT_PERSON_LINKS);

export function usePersonLinks(): PersonLinks {
  return useContext(PersonLinkContext);
}
