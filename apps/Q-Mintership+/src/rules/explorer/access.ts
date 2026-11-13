/**
 * Who sees the Explorer's detailed parts (Simon, 2026-10-18: "only show them
 * to DEV + MA's and lvl5+ minters"): the Connections tab (and its preview,
 * Direct links, on the Overview), the Trades tab, Compare, the lists of the accounts a
 * sponsor sponsored or funded, the activity chart, QORT minted, purchased /
 * sold and received / sent, and exchanges named as such. Minter Admins, MINTER
 * members at level 5 or above (the nominators) and Dev Admins (the admins of
 * the dev group) do; everyone else sees the rest of the Explorer, and nothing
 * says that anything is left out. Pure.
 */
import { NOMINATOR_MIN_LEVEL } from '../../data/constants';

export interface ExplorerViewer {
  isAdmin: boolean;
  isMember: boolean;
  level: number;
}

/** A Minter Admin, or a MINTER member at level 5 or above. */
export function fullExplorerByRole(viewer: ExplorerViewer): boolean {
  return viewer.isAdmin || (viewer.isMember && viewer.level >= NOMINATOR_MIN_LEVEL);
}

/** By role, or as a Dev Admin. */
export function fullExplorerAccess(viewer: ExplorerViewer, isDevAdmin: boolean): boolean {
  return fullExplorerByRole(viewer) || isDevAdmin;
}
