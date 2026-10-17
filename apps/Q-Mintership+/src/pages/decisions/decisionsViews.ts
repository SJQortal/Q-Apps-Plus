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
  { key: 'decisions', label: 'Decisions' },
  { key: 'nominations', label: 'Nominations' },
  { key: 'ready', label: 'Ready to mint' },
];

/** `?show=` as a view, or null for none (the account's own default). */
export function parseDecisionsView(value: string | null): DecisionsView | null {
  return DECISIONS_VIEWS.some((v) => v.key === value) ? (value as DecisionsView) : null;
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

/** The tab of `view`, and the panel under the tabs (labelled by the selected tab). */
export const decisionsTabId = (view: DecisionsView) => `decisions-tab-${view}`;
export const DECISIONS_PANEL_ID = 'decisions-panel';
