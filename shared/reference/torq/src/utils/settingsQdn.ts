import { EnumCollisionStrength, objectToBase64 } from 'qapp-core';
import { invalidateQdnResource } from './qdnMemoryCache';
import {
  addHiddenUsers,
  addHiddenWords,
} from './contentFilters';
import {
  normalizeUiTheme,
  UI_THEME_HUB,
  type TorqUiThemeId,
} from '../state/global/settings';

export const SETTINGS_ENTITY = 'settings';
export const SETTINGS_SNAPSHOT_VERSION = 1;

export type TorqSettingsSnapshot = {
  version: number;
  uiTheme: TorqUiThemeId;
  trendingEnabled: boolean;
  expandNestedReplies: boolean;
  sidePanelsHideOnScroll: boolean;
  nameSwitcherOnHome: boolean;
  rightPanelNotificationsEnabled: boolean;
  notificationAlerts: boolean;
  notificationSound: boolean;
  subscriptionsEnabled: boolean;
  editHistoryEnabled: boolean;
  hiddenWords: string[];
  hiddenUsers: string[];
  updatedAt: number;
};

export type SettingsValues = Omit<
  TorqSettingsSnapshot,
  'version' | 'updatedAt'
>;

declare const qortalRequest: (params: {
  action: string;
  service?: string;
  name?: string;
  identifier?: string;
  data64?: string;
  title?: string;
  filename?: string;
}) => Promise<unknown>;

type IdentifierOperations = {
  hashString: (
    value: string,
    strength: unknown
  ) => Promise<string | null | undefined>;
};

export async function buildSettingsIdentifier(
  identifierOperations: IdentifierOperations
): Promise<string> {
  const strength =
    typeof EnumCollisionStrength.HIGH === 'number'
      ? EnumCollisionStrength.HIGH
      : 14;
  const settingsHash = await identifierOperations.hashString(
    SETTINGS_ENTITY,
    strength
  );

  if (!settingsHash) {
    throw new Error('Failed to create settings identifier');
  }

  return settingsHash;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function looksLikeSettings(record: Record<string, unknown>): boolean {
  return (
    typeof record.version === 'number' ||
    record.uiTheme !== undefined ||
    Array.isArray(record.hiddenWords) ||
    Array.isArray(record.hiddenUsers) ||
    typeof record.trendingEnabled === 'boolean' ||
    typeof record.expandNestedReplies === 'boolean' ||
    typeof record.sidePanelsHideOnScroll === 'boolean' ||
    typeof record.nameSwitcherOnHome === 'boolean' ||
    typeof record.rightPanelNotificationsEnabled === 'boolean' ||
    typeof record.notificationAlerts === 'boolean' ||
    typeof record.notificationSound === 'boolean' ||
    typeof record.subscriptionsEnabled === 'boolean' ||
    typeof record.editHistoryEnabled === 'boolean'
  );
}

function decodeFetchedJson(response: unknown): Record<string, unknown> | null {
  if (!response) return null;
  if (typeof response === 'object') {
    return response as Record<string, unknown>;
  }
  if (typeof response !== 'string') return null;

  try {
    const parsed = JSON.parse(response);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Try base64 next.
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(response))));
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

export function defaultSettingsValues(): SettingsValues {
  return {
    uiTheme: UI_THEME_HUB,
    trendingEnabled: false,
    expandNestedReplies: true,
    sidePanelsHideOnScroll: true,
    nameSwitcherOnHome: false,
    rightPanelNotificationsEnabled: true,
    notificationAlerts: true,
    notificationSound: true,
    subscriptionsEnabled: false,
    editHistoryEnabled: false,
    hiddenWords: [],
    hiddenUsers: [],
  };
}

export function collectSettingsSnapshot(
  values: SettingsValues,
  updatedAt = Date.now()
): TorqSettingsSnapshot {
  const defaults = defaultSettingsValues();
  return {
    version: SETTINGS_SNAPSHOT_VERSION,
    uiTheme: normalizeUiTheme(values.uiTheme),
    trendingEnabled: readBoolean(values.trendingEnabled, defaults.trendingEnabled),
    expandNestedReplies: readBoolean(
      values.expandNestedReplies,
      defaults.expandNestedReplies
    ),
    sidePanelsHideOnScroll: readBoolean(
      values.sidePanelsHideOnScroll,
      defaults.sidePanelsHideOnScroll
    ),
    nameSwitcherOnHome: readBoolean(
      values.nameSwitcherOnHome,
      defaults.nameSwitcherOnHome
    ),
    rightPanelNotificationsEnabled: readBoolean(
      values.rightPanelNotificationsEnabled,
      defaults.rightPanelNotificationsEnabled
    ),
    notificationAlerts: readBoolean(
      values.notificationAlerts,
      defaults.notificationAlerts
    ),
    notificationSound: readBoolean(
      values.notificationSound,
      defaults.notificationSound
    ),
    subscriptionsEnabled: readBoolean(
      values.subscriptionsEnabled,
      defaults.subscriptionsEnabled
    ),
    editHistoryEnabled: readBoolean(
      values.editHistoryEnabled,
      defaults.editHistoryEnabled
    ),
    hiddenWords: addHiddenWords([], values.hiddenWords.join(', ')),
    hiddenUsers: addHiddenUsers([], values.hiddenUsers.join(', ')),
    updatedAt,
  };
}

export function normalizeSettingsSnapshot(
  value: unknown
): TorqSettingsSnapshot | null {
  const record = asRecord(value);
  if (!record) return null;

  const candidates: Record<string, unknown>[] = [record];
  if (record.data !== undefined) {
    if (typeof record.data === 'object' && record.data) {
      candidates.push(record.data as Record<string, unknown>);
    } else if (typeof record.data === 'string') {
      const decoded = decodeFetchedJson(record.data);
      if (decoded) candidates.push(decoded);
    }
  }

  const payload = candidates.find(looksLikeSettings);
  if (!payload) return null;

  const hiddenWords = Array.isArray(payload.hiddenWords)
    ? addHiddenWords([], payload.hiddenWords.join(', '))
    : [];
  const hiddenUsers = Array.isArray(payload.hiddenUsers)
    ? addHiddenUsers([], payload.hiddenUsers.join(', '))
    : [];

  const updatedAt =
    typeof payload.updatedAt === 'number' && Number.isFinite(payload.updatedAt)
      ? payload.updatedAt
      : Date.now();

  return collectSettingsSnapshot(
    {
      uiTheme: normalizeUiTheme(payload.uiTheme),
      trendingEnabled: readBoolean(payload.trendingEnabled, false),
      expandNestedReplies: readBoolean(payload.expandNestedReplies, true),
      sidePanelsHideOnScroll: readBoolean(payload.sidePanelsHideOnScroll, true),
      nameSwitcherOnHome: readBoolean(payload.nameSwitcherOnHome, false),
      rightPanelNotificationsEnabled: readBoolean(
        payload.rightPanelNotificationsEnabled,
        true
      ),
      notificationAlerts: readBoolean(payload.notificationAlerts, true),
      notificationSound: readBoolean(payload.notificationSound, true),
      subscriptionsEnabled: readBoolean(payload.subscriptionsEnabled, false),
      editHistoryEnabled: readBoolean(payload.editHistoryEnabled, false),
      hiddenWords,
      hiddenUsers,
    },
    updatedAt
  );
}

function readSettingsPayload(response: unknown): TorqSettingsSnapshot | null {
  const record = decodeFetchedJson(response);
  if (!record) return null;
  return normalizeSettingsSnapshot(record);
}

export async function fetchSettingsFromQdn(
  userName: string,
  identifierOperations: IdentifierOperations
): Promise<TorqSettingsSnapshot | null> {
  if (!userName) return null;

  const identifier = await buildSettingsIdentifier(identifierOperations);

  try {
    const response = await qortalRequest({
      action: 'FETCH_QDN_RESOURCE',
      name: userName,
      service: 'DOCUMENT',
      identifier,
    });

    return readSettingsPayload(response);
  } catch {
    return null;
  }
}

export async function publishSettingsToQdn(
  userName: string,
  values: SettingsValues,
  identifierOperations: IdentifierOperations
): Promise<string> {
  if (!userName) {
    throw new Error('A Qortal name is required to save settings');
  }

  const identifier = await buildSettingsIdentifier(identifierOperations);
  const snapshot = collectSettingsSnapshot(values);
  const data64 = await objectToBase64({
    version: snapshot.version,
    uiTheme: snapshot.uiTheme,
    trendingEnabled: snapshot.trendingEnabled,
    expandNestedReplies: snapshot.expandNestedReplies,
    sidePanelsHideOnScroll: snapshot.sidePanelsHideOnScroll,
    nameSwitcherOnHome: snapshot.nameSwitcherOnHome,
    rightPanelNotificationsEnabled: snapshot.rightPanelNotificationsEnabled,
    notificationAlerts: snapshot.notificationAlerts,
    notificationSound: snapshot.notificationSound,
    editHistoryEnabled: snapshot.editHistoryEnabled,
    hiddenWords: snapshot.hiddenWords,
    hiddenUsers: snapshot.hiddenUsers,
    updatedAt: snapshot.updatedAt,
  });

  await qortalRequest({
    action: 'PUBLISH_QDN_RESOURCE',
    service: 'DOCUMENT',
    name: userName,
    identifier,
    data64,
    title: 'settings',
    filename: 'settings.json',
  });

  invalidateQdnResource({
    name: userName,
    service: 'DOCUMENT',
    identifier,
  });

  return identifier;
}
