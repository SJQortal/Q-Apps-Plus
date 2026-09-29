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

function extractErrorMessage(value: unknown, depth = 0): string | null {
  if (depth > 4) {
    return null;
  }
  if (value instanceof Error) {
    return value.message || null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractErrorMessage(entry, depth + 1);
      if (nested) {
        return nested;
      }
    }
    return null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const keys = ['message', 'errorMessage', 'error', 'details', 'description', 'info'];
  for (const key of keys) {
    const nested = extractErrorMessage(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }
  return null;
}

async function qortalRequestSafe(
  request: Record<string, unknown>
): Promise<unknown> {
  try {
    return await qortalRequest(request);
  } catch (error) {
    const message =
      extractErrorMessage(error) ||
      (typeof request.action === 'string'
        ? `${request.action} request was declined`
        : 'Request was declined');
    throw new Error(message);
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
        theme: {
          root: document.documentElement,
          datasetKey: 'theme',
          themeDataKey: '_qdnTheme',
          themeEventName: 'THEME_CHANGED',
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
