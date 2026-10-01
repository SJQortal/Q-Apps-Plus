/**
 * What the Settings page and the navigation need from GlobalWrapper: the
 * signed-in user, the name switcher, and the qapp-lib app-shell controller
 * (text size, authenticate-on-startup, ratings, authentication).
 */
import { createContext, useContext } from 'react';
import type {
  AppShellController,
  AppShellState,
} from '@qortal/qapp-lib/app-shell/core';

export interface AppShellUser {
  address?: string;
  publicKey?: string;
  name?: string;
  names?: { name: string; owner?: string }[];
}

/**
 * What the mail page exposes to Settings → Sync: the same publish path the rail's
 * "Publish Q-Mail State" uses, plus whether anything is waiting to be published.
 */
export interface MailSyncState {
  /** Publishes qmail_state_v1 (one QDN publish). The caller confirms first. */
  publishMailState: () => Promise<void>;
  isPublishing: boolean;
  /** Local read state, subjects or archived ids differ from the last published/loaded document. */
  hasPendingChanges: boolean;
}

export interface AppShellContextValue {
  user: AppShellUser | null;
  userAvatar: string;
  /** Make one of the account's registered names the active mailbox. */
  setActiveName: (name: string) => void;
  authenticate: () => Promise<void>;
  controller: AppShellController;
  state: AppShellState;
  /** Set by the mail page while it is mounted; null otherwise. */
  mailSync: MailSyncState | null;
  registerMailSync: (sync: MailSyncState | null) => void;
}

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue {
  const value = useContext(AppShellContext);
  if (!value) throw new Error('useAppShell must be used inside GlobalWrapper');
  return value;
}
