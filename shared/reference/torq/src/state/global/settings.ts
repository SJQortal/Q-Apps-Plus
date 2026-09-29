import { atomWithStorage } from 'jotai/utils';
import {
  UI_THEME_HUB,
  isUiThemeId,
  type TorqUiThemeId,
} from '../../styles/theme/theme';

export const TRENDING_ENABLED_STORAGE_KEY = 'torq-trending-enabled-v2';
export const RIGHT_PANEL_NOTIFICATIONS_STORAGE_KEY =
  'torq-right-panel-notifications';
export const EXPAND_NESTED_REPLIES_STORAGE_KEY = 'torq-expand-nested-replies';
export const SIDE_PANELS_HIDE_ON_SCROLL_STORAGE_KEY =
  'torq-side-panels-hide-on-scroll';
export const NAME_SWITCHER_ON_HOME_STORAGE_KEY = 'torq-name-switcher-on-home';
export const SUBSCRIPTIONS_ENABLED_STORAGE_KEY = 'torq-subscriptions-enabled';
export const EDIT_HISTORY_ENABLED_STORAGE_KEY = 'torq-edit-history-enabled';
export const HIDDEN_WORDS_STORAGE_KEY = 'torq-hidden-words';
export const HIDDEN_USERS_STORAGE_KEY = 'torq-hidden-users';
export const UI_THEME_STORAGE_KEY = 'torq-ui-theme-v2';

export type { TorqUiThemeId };
export {
  UI_THEME_QUITTER,
  UI_THEME_HUB,
  UI_THEME_X,
  UI_THEME_WHITE,
} from '../../styles/theme/theme';

export const trendingEnabledAtom = atomWithStorage<boolean>(
  TRENDING_ENABLED_STORAGE_KEY,
  false,
  undefined,
  { getOnInit: true }
);

export const rightPanelNotificationsEnabledAtom = atomWithStorage<boolean>(
  RIGHT_PANEL_NOTIFICATIONS_STORAGE_KEY,
  true
);

export const expandNestedRepliesAtom = atomWithStorage<boolean>(
  EXPAND_NESTED_REPLIES_STORAGE_KEY,
  true,
  undefined,
  { getOnInit: true }
);

/**
 * Encrypted group posts and the Subscribe button.
 * Off until the viewer turns it on, so existing feeds stay public.
 */
export function readSubscriptionsEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return JSON.parse(
      localStorage.getItem(SUBSCRIPTIONS_ENABLED_STORAGE_KEY) || 'false'
    ) === true;
  } catch {
    return false;
  }
}

export const subscriptionsEnabledAtom = atomWithStorage<boolean>(
  SUBSCRIPTIONS_ENABLED_STORAGE_KEY,
  false,
  undefined,
  { getOnInit: true }
);

/** Quiet Edited mark and its history. Off until the viewer turns it on. */
export const editHistoryEnabledAtom = atomWithStorage<boolean>(
  EDIT_HISTORY_ENABLED_STORAGE_KEY,
  false,
  undefined,
  { getOnInit: true }
);

/** When on, side-column contents scroll with the feed. The column background stays. */
export const sidePanelsHideOnScrollAtom = atomWithStorage<boolean>(
  SIDE_PANELS_HIDE_ON_SCROLL_STORAGE_KEY,
  true,
  undefined,
  { getOnInit: true }
);

/**
 * Name switcher at the bottom of the left panel instead of the top of Settings.
 * Off until the viewer turns it on. Phones keep it in Settings.
 */
export const nameSwitcherOnHomeAtom = atomWithStorage<boolean>(
  NAME_SWITCHER_ON_HOME_STORAGE_KEY,
  false,
  undefined,
  { getOnInit: true }
);

export function shouldHideRightPanel(
  trendingEnabled: boolean,
  rightPanelNotificationsEnabled: boolean
): boolean {
  return !trendingEnabled && !rightPanelNotificationsEnabled;
}

export const hiddenWordsAtom = atomWithStorage<string[]>(
  HIDDEN_WORDS_STORAGE_KEY,
  []
);

export const hiddenUsersAtom = atomWithStorage<string[]>(
  HIDDEN_USERS_STORAGE_KEY,
  [],
  undefined,
  { getOnInit: true }
);

export const uiThemeAtom = atomWithStorage<TorqUiThemeId>(
  UI_THEME_STORAGE_KEY,
  UI_THEME_HUB,
  undefined,
  { getOnInit: true }
);

export function normalizeUiTheme(value: unknown): TorqUiThemeId {
  return isUiThemeId(value) ? value : UI_THEME_HUB;
}
