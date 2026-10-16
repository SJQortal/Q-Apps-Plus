/** The account page's tabs: their labels and the ids that tie each tab to its panel. */
import type { ExplorerTab } from '../../../routes/paths';

export const TAB_LABEL: Record<ExplorerTab, string> = {
  overview: 'Overview',
  connections: 'Connections',
  transactions: 'Transactions',
  mintership: 'Mintership',
  names: 'Names',
};

/** Every tab of a personal account, in order. */
export const ACCOUNT_TABS: readonly ExplorerTab[] = [
  'overview',
  'connections',
  'transactions',
  'mintership',
  'names',
];

/** An AT (automated contract) has transactions only. */
export const AT_TABS: readonly ExplorerTab[] = ['transactions'];

export const tabIdOf = (tab: ExplorerTab) => `account-tab-${tab}`;
export const panelIdOf = (tab: ExplorerTab) => `account-panel-${tab}`;
