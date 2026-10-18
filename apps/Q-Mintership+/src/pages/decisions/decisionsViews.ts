/**
 * Decisions' two views, in tabs (Simon, 2026-10-17: "merge the Nominations
 * tab into Decisions"): the decisions waiting for the Minter Admins and the
 * open nominations. `?show=` keeps the view, and `?state=` a nomination state
 * on Nominations; without `show` a Minter Admin opens Decisions and everyone
 * else Nominations. The old Nominations page's links (`/nominations?show=<state>`)
 * open the same view here. The list of who asked to join (Ready to mint until
 * 2026-10-18) is Propose → Decline a join request now: its old links
 * (`?show=ready`) open Decisions' own default view.
 */
import { appParam } from '../../routes/hubLocation';
import { PATHS, decisionsViewPath, type DecisionsView } from '../../routes/paths';
import { parseFilter } from '../nominations/filters';
import type { SectionAccent } from './sectionAccents';

export { decisionsViewPath, type DecisionsView };

export const DECISIONS_VIEWS: ReadonlyArray<{ key: DecisionsView; label: string }> = [
  // Simon, 2026-10-18: "I want decisions to be called “All Decisions”".
  { key: 'decisions', label: 'All Decisions' },
  { key: 'nominations', label: 'Nominations' },
];

/** `?show=` as a view, or null for none (the account's own default). */
export function parseDecisionsView(value: string | null): DecisionsView | null {
  return DECISIONS_VIEWS.some((v) => v.key === value) ? (value as DecisionsView) : null;
}

/**
 * All Decisions narrowed to one kind (Simon, 2026-10-18: "in this top bar in
 * Decisions, I would also like there to show the other active ones too, so
 * the: Nominations, Removals, Declines, Bans, New MA's, Remove MA's , Lift
 * Ban, Cancel invite, Clean invites, Ask MA's"): a tab each, after
 * Nominations, shown while something of that kind is open. `?show=<kind>`.
 */
export type DecisionsKind =
  | 'removals'
  | 'declines'
  | 'bans'
  | 'newAdmins'
  | 'removeAdmins'
  | 'liftBans'
  | 'cancelInvites'
  | 'cleanInvites'
  | 'askAdmins';

export const DECISIONS_KINDS: ReadonlyArray<{ key: DecisionsKind; label: string }> = [
  { key: 'removals', label: 'Removals' },
  { key: 'declines', label: 'Declines' },
  { key: 'bans', label: 'Bans' },
  { key: 'newAdmins', label: 'New MAs' },
  { key: 'removeAdmins', label: 'Remove MAs' },
  { key: 'liftBans', label: 'Lift ban' },
  { key: 'cancelInvites', label: 'Cancel invite' },
  { key: 'cleanInvites', label: 'Clean invites' },
  { key: 'askAdmins', label: 'Ask MAs' },
];

/**
 * Each kind's colour: its section's on All Decisions (sectionAccents.ts;
 * Simon, 2026-10-18: "I want then to be colored as well to the correct
 * color"), and Nominations green, as Add to MINTER is (Simon, 2026-10-18:
 * "it should be green color like the nominations (not blue)").
 */
export const TAB_ACCENT: Partial<Record<DecisionsView | DecisionsKind, SectionAccent>> = {
  nominations: 'invite',
  removals: 'removal',
  declines: 'decline',
  bans: 'removal',
  newAdmins: 'admins',
  removeAdmins: 'admins',
  liftBans: 'liftBan',
  cancelInvites: 'cancelInvite',
  cleanInvites: 'cancelInvite',
  askAdmins: 'polls',
};

/** `?show=` as one of those kinds, or null. */
export function parseDecisionsKind(value: string | null): DecisionsKind | null {
  return DECISIONS_KINDS.some((k) => k.key === value) ? (value as DecisionsKind) : null;
}

/** A decision's kind tab (null for one with none: an invite, another group change). */
export function decisionsKindOf(d: { kind: string; decline?: unknown }): DecisionsKind | null {
  switch (d.kind) {
    case 'kick':
      return d.decline ? 'declines' : 'removals';
    case 'ban':
      return 'bans';
    case 'addAdmin':
      return 'newAdmins';
    case 'removeAdmin':
      return 'removeAdmins';
    case 'cancelBan':
      return 'liftBans';
    case 'cancelInvite':
      return 'cancelInvites';
    default:
      return null;
  }
}

/** The kinds that are decisions (not the stale invites or the polls). */
export function isDecisionKind(kind: DecisionsKind | null): boolean {
  return kind !== null && kind !== 'cleanInvites' && kind !== 'askAdmins';
}

/** `/decisions?show=<kind>`. */
export function decisionsKindPath(kind: DecisionsKind): string {
  return `${decisionsViewPath('decisions').split('?')[0]}?show=${kind}`;
}

/**
 * The view Decisions opens on without `?show=`: the queue for a Minter Admin;
 * for anyone else Nominations while some are open, else All Decisions, as
 * an empty Nominations has no tab (Simon, 2026-10-18). `openNominations`:
 * how many are open (undefined while they load, null when they couldn't be
 * read: Nominations then, with its error and Retry); null back means wait.
 */
export function defaultDecisionsView(
  isAdmin: boolean,
  openNominations?: number | null
): DecisionsView | null {
  if (isAdmin) return 'decisions';
  if (openNominations === undefined) return null;
  return openNominations === null || openNominations > 0 ? 'nominations' : 'decisions';
}

/**
 * The views that have a tab: All Decisions always, any other only while it
 * lists something (Simon, 2026-10-18: "If there is 0 nominations do not show
 * this tab"), or while it is on screen.
 */
export function shownDecisionsViews(
  counts: Partial<Record<DecisionsView, number>>,
  view: DecisionsView | DecisionsKind | null
): ReadonlyArray<{ key: DecisionsView; label: string }> {
  return DECISIONS_VIEWS.filter(
    (v) => v.key === 'decisions' || v.key === view || (counts[v.key] ?? 0) > 0
  );
}

/**
 * Where an old `/nominations` link goes: its view (and nomination state) in
 * Decisions, with the rest of its query. Its old Ready to mint view
 * (`?show=ready`) opens Decisions on the account's own default view.
 */
export function nominationsRedirect(search: string): string {
  const params = new URLSearchParams(search);
  const show = appParam(params, 'show');
  if (show === 'ready') return PATHS.decisions;
  params.delete('show');
  params.delete('state');
  const view = decisionsViewPath('nominations', parseFilter(show));
  const rest = params.toString();
  return rest ? `${view}&${rest}` : view;
}

/** The tab of `view` (or a kind), and the panel under the tabs (labelled by the selected tab). */
export const decisionsTabId = (view: DecisionsView | DecisionsKind) => `decisions-tab-${view}`;
export const DECISIONS_PANEL_ID = 'decisions-panel';
