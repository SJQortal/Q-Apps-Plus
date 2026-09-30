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

export interface AppShellContextValue {
  user: AppShellUser | null;
  userAvatar: string;
  /** Make one of the account's registered names the active mailbox. */
  setActiveName: (name: string) => void;
  authenticate: () => Promise<void>;
  controller: AppShellController;
  state: AppShellState;
}

export const AppShellContext = createContext<AppShellContextValue | null>(null);

export function useAppShell(): AppShellContextValue {
  const value = useContext(AppShellContext);
  if (!value) throw new Error('useAppShell must be used inside GlobalWrapper');
  return value;
}
