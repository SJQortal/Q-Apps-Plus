/** The account page's tabs: their labels and the ids that tie each tab to its panel. */
import type { ExplorerTab } from '../../../routes/paths';

export const TAB_LABEL: Record<ExplorerTab, string> = {
  overview: 'Overview',
  connections: 'Connections',
  transactions: 'Transactions',
  // The Q-Assets it holds (Simon, 2026-10-21: "In between transactions and minter profile").
  assets: 'Assets',
  // An account's Minter Profile, its one place (Simon, 2026-10-17: "I want it to be called :
  // "Minter Profile""); its URL stays `mintership`.
  mintership: 'Minter Profile',
  names: 'Names',
};

/** Every tab of a personal account, in order. */
export const ACCOUNT_TABS: readonly ExplorerTab[] = [
  'overview',
  'connections',
  'transactions',
  'assets',
  'mintership',
  'names',
];

/**
 * The tabs for a viewer who doesn't see the Explorer's detailed parts
 * (rules/explorer/access.ts): all but Connections.
 */
export const BASIC_ACCOUNT_TABS: readonly ExplorerTab[] = ACCOUNT_TABS.filter(
  (tab) => tab !== 'connections'
);

/** An AT (automated contract) has transactions only. */
export const AT_TABS: readonly ExplorerTab[] = ['transactions'];

export const tabIdOf = (tab: ExplorerTab) => `account-tab-${tab}`;
export const panelIdOf = (tab: ExplorerTab) => `account-panel-${tab}`;
