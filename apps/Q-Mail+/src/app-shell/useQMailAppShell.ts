import { useEffect, useMemo, useRef } from 'react';
import {
  createBrowserDeps,
  createQortalRatingAdapter,
} from '@qortal/qapp-lib/app-shell/adapters';
import type {
  AppShellController,
  AppShellDeps,
  AppShellState,
  ResolvedTheme,
} from '@qortal/qapp-lib/app-shell/core';
import { useAppShellController, useAppShellState } from '@qortal/qapp-lib/app-shell/react';
import packageJson from '../../package.json';
import { errorMessage, isAccountRefusal, isHubDecline } from '../utils/hubErrors';

type AuthIdentity = {
  address?: string;
  name?: string;
} | null;

interface UseQMailAppShellInput {
  authenticated: boolean;
  identity: AuthIdentity;
  authenticate: () => Promise<void>;
  onThemeChange: (theme: ResolvedTheme) => void;
}

interface UseQMailAppShellResult {
  controller: AppShellController;
  state: AppShellState;
}

declare const qortalRequest: (
  request: Record<string, unknown>
) => Promise<unknown>;

/** Thrown for a request the user declined in Hub: the shell logs nothing for it. */
export class HubDeclinedError extends Error {
  constructor(action: unknown) {
    super(typeof action === 'string' ? `${action} was declined` : 'Request was declined');
    this.name = 'HubDeclinedError';
  }
}

/**
 * Normalises what Hub rejects with (a string, `{error}`, `{message}`) into an
 * Error, and marks declines in any of Hub's languages so the shell treats
 * them as a cancel rather than an error (docs/QORTAL.md pitfall 11).
 */
async function qortalRequestSafe(
  request: Record<string, unknown>
): Promise<unknown> {
  try {
    return await qortalRequest(request);
  } catch (error) {
    if (isHubDecline(error)) throw new HubDeclinedError(request.action);
    throw new Error(
      errorMessage(
        error,
        typeof request.action === 'string' ? `${request.action} request failed` : 'Request failed'
      )
    );
  }
}

export const useQMailAppShell = (
  input: UseQMailAppShellInput
): UseQMailAppShellResult => {
  const authRef = useRef({
    authenticated: input.authenticated,
    identity: input.identity,
    authenticate: input.authenticate,
  });

  const themeChangeRef = useRef(input.onThemeChange);

  authRef.current = {
    authenticated: input.authenticated,
    identity: input.identity,
    authenticate: input.authenticate,
  };

  themeChangeRef.current = input.onThemeChange;

  const deps = useMemo<AppShellDeps>(
    () =>
      createBrowserDeps({
        auth: {
          isAuthenticated: () => authRef.current.authenticated,
          getIdentity: () => authRef.current.identity,
          authenticate: async () => {
            await authRef.current.authenticate();
          },
        },
        rating: createQortalRatingAdapter({
          qortalRequest: qortalRequestSafe,
        }),
        storage: {
          prefix: '',
        },
        // The theme kit (src/hub-theme) owns <html data-theme> and reads
        // Hub's _qdnTheme itself, so the app-shell writes to spare keys.
        theme: {
          root: document.documentElement,
          datasetKey: 'hostTheme',
          themeDataKey: '_qmailHostTheme',
          themeEventName: 'qmail:host-theme-changed',
        },
      }),
    []
  );

  const controller = useAppShellController(
    {
      appId: 'qmail',
      appName: 'Q-Mail',
      appVersion:
        typeof packageJson?.version === 'string' ? packageJson.version : '0.0.0',
      changelog: {
        onOpen: () => {},
      },
      rating: {
        enabled: true,
        pollName: 'app-library-APP-rating-qmails',
      },
      defaults: {
        textSize: 'medium',
        authOnStartup: true,
        themeMode: 'hub',
      },
      events: {
        onThemeChanged: ({ resolvedTheme }) => {
          themeChangeRef.current(resolvedTheme);
        },
        onError: ({ phase, message }) => {
          // A declined Hub dialog (Authenticate, a list) is a cancel, not an error.
          if (/was declined$/.test(message) || isHubDecline(message) || isAccountRefusal(message)) return;
          console.warn(`[qmail-shell:${phase}] ${message}`);
        },
      },
    },
    deps
  );

  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    void controller.maybeAuthOnStartup();
  }, [controller]);

  const state = useAppShellState(controller);

  return {
    controller,
    state,
  };
};
