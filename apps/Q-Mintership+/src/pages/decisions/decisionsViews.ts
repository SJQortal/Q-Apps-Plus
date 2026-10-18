/**
 * Decisions' three views, in tabs (Simon, 2026-10-17: "merge the Nominations
 * tab into Decisions"): the decisions waiting for the Minter Admins, the open
 * nominations, and the people ready to mint. `?show=` keeps the view, and
 * `?state=` a nomination state on Nominations; without `show` a Minter Admin
 * opens Decisions and everyone else Nominations. The old Nominations page's
 * links (`/nominations?show=<state>`, `?show=ready`) open the same view here.
 */
import { appParam } from '../../routes/hubLocation';
import { decisionsViewPath, type DecisionsView } from '../../routes/paths';
import { parseFilter } from '../nominations/filters';

export { decisionsViewPath, type DecisionsView };

export const DECISIONS_VIEWS: ReadonlyArray<{ key: DecisionsView; label: string }> = [
  // Simon, 2026-10-18: "I want decisions to be called “All Decisions”".
  { key: 'decisions', label: 'All Decisions' },
  { key: 'nominations', label: 'Nominations' },
  { key: 'ready', label: 'Ready to mint' },
];

/** `?show=` as a view, or null for none (the account's own default). */
export function parseDecisionsView(value: string | null): DecisionsView | null {
  return DECISIONS_VIEWS.some((v) => v.key === value) ? (value as DecisionsView) : null;
}

/**
 * All Decisions narrowed to one kind (Simon, 2026-10-18: "in this top bar in
 * Decisions, I would also like there to show the other active ones too, so
 * the: Nominations, Removals, Declines, Bans, New MA's, Remove MA's , Lift
 * Ban, Cancel invite, Clean invites, Ask MA's"): a tab each, after Ready to
 * mint, shown while something of that kind is open. `?show=<kind>`.
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

/** The view Decisions opens on without `?show=`: the queue for a Minter Admin, else Nominations. */
export function defaultDecisionsView(isAdmin: boolean): DecisionsView {
  return isAdmin ? 'decisions' : 'nominations';
}

/**
 * Where an old `/nominations` link goes: its view (and nomination state) in
 * Decisions, with the rest of its query (Ready to mint's `sort`).
 */
export function nominationsRedirect(search: string): string {
  const params = new URLSearchParams(search);
  const show = appParam(params, 'show');
  params.delete('show');
  params.delete('state');
  const view =
    show === 'ready'
      ? decisionsViewPath('ready')
      : decisionsViewPath('nominations', parseFilter(show));
  const rest = params.toString();
  return rest ? `${view}&${rest}` : view;
}

/** The tab of `view` (or a kind), and the panel under the tabs (labelled by the selected tab). */
export const decisionsTabId = (view: DecisionsView | DecisionsKind) => `decisions-tab-${view}`;
export const DECISIONS_PANEL_ID = 'decisions-panel';
