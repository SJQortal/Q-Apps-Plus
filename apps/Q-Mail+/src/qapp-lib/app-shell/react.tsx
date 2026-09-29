import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  MenuItem,
  Rating,
  Select,
  Switch,
  Typography,
} from '@mui/material'
import type {
  AppShellController,
  AppShellDeps,
  AppShellState,
  AppThemeMode,
  ResolvedTheme,
  TextSize,
} from './core'

type AppShellConfig = {
  appId: string
  appName: string
  appVersion: string
  changelog: {
    onOpen: () => void
  }
  rating: {
    enabled: boolean
    service?: string
    appDisplayName?: string
    pollName?: string
  }
  defaults?: {
    textSize?: TextSize
    authOnStartup?: boolean
    themeMode?: AppThemeMode
  }
  events?: {
    onThemeChanged?: (theme: { resolvedTheme: ResolvedTheme }) => void
    onError?: (event: { phase: string; message: string }) => void
  }
}

type Listener = () => void

type InternalAppShellController = AppShellController & {
  subscribe(listener: Listener): () => void
  update(config: AppShellConfig, deps: AppShellDeps): void
  syncExternalState(): void
}

const APP_SHELL_STORAGE_KEY = 'app-shell'

const getStoredSettings = (deps: AppShellDeps) => {
  return (
    deps.storage.get<{
      textSize?: TextSize
      authOnStartup?: boolean
      themeMode?: AppThemeMode
    }>(APP_SHELL_STORAGE_KEY) || {}
  )
}

const persistSettings = (deps: AppShellDeps, state: AppShellState) => {
  deps.storage.set(APP_SHELL_STORAGE_KEY, {
    textSize: state.settings.textSize,
    authOnStartup: state.settings.authOnStartup,
    themeMode: state.settings.themeMode,
  })
}

const readHubTheme = (deps: AppShellDeps): ResolvedTheme => {
  const root = deps.theme.root
  const datasetValue = root.dataset?.[deps.theme.datasetKey]
  const globalValue = ((window as unknown) as Record<string, string | undefined>)[
    deps.theme.themeDataKey
  ]
  const theme = String(datasetValue || globalValue || '').toLowerCase()
  return theme === 'light' ? 'light' : 'dark'
}

const applyResolvedTheme = (
  config: AppShellConfig,
  deps: AppShellDeps,
  resolvedTheme: ResolvedTheme
) => {
  deps.theme.root.dataset[deps.theme.datasetKey] = resolvedTheme
  ;((window as unknown) as Record<string, string | undefined>)[deps.theme.themeDataKey] =
    resolvedTheme
  window.dispatchEvent(new CustomEvent(deps.theme.themeEventName, { detail: resolvedTheme }))
  config.events?.onThemeChanged?.({ resolvedTheme })
}

const resolveTheme = (
  config: AppShellConfig,
  deps: AppShellDeps,
  themeMode: AppThemeMode
): ResolvedTheme => {
  return themeMode === 'hub' ? readHubTheme(deps) : themeMode
}

const createInitialState = (config: AppShellConfig, deps: AppShellDeps): AppShellState => {
  const stored = getStoredSettings(deps)
  const themeMode = stored.themeMode || config.defaults?.themeMode || 'hub'
  return {
    ui: {
      menuOpen: false,
      busy: false,
      error: null,
    },
    auth: {
      authenticated: deps.auth.isAuthenticated(),
      identity: deps.auth.getIdentity(),
    },
    settings: {
      textSize: stored.textSize || config.defaults?.textSize || 'medium',
      authOnStartup:
        typeof stored.authOnStartup === 'boolean'
          ? stored.authOnStartup
          : Boolean(config.defaults?.authOnStartup),
      themeMode,
      resolvedTheme: resolveTheme(config, deps, themeMode),
    },
    rating: {
      enabled: config.rating.enabled,
      average: null,
      count: 0,
      userVote: null,
      hasPendingVote: false,
      loading: false,
    },
  }
}

const createAppShellController = (
  initialConfig: AppShellConfig,
  initialDeps: AppShellDeps
): InternalAppShellController => {
  let config = initialConfig
  let deps = initialDeps
  let state = createInitialState(config, deps)
  const listeners = new Set<Listener>()
  let disposed = false

  const emit = () => {
    listeners.forEach(listener => listener())
  }

  const setState = (updater: AppShellState | ((prev: AppShellState) => AppShellState)) => {
    if (disposed) return
    state = typeof updater === 'function' ? updater(state) : updater
    emit()
  }

  const setError = (phase: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    setState(prev => ({
      ...prev,
      ui: {
        ...prev.ui,
        busy: false,
        error: message,
      },
    }))
    config.events?.onError?.({ phase, message })
  }

  const syncExternalState = () => {
    const authenticated = deps.auth.isAuthenticated()
    const identity = deps.auth.getIdentity()
    const resolvedTheme = resolveTheme(config, deps, state.settings.themeMode)
    setState(prev => {
      if (
        prev.auth.authenticated === authenticated &&
        prev.auth.identity?.address === identity?.address &&
        prev.auth.identity?.name === identity?.name &&
        prev.settings.resolvedTheme === resolvedTheme &&
        prev.rating.enabled === config.rating.enabled
      ) {
        return prev
      }
      return {
        ...prev,
        auth: {
          authenticated,
          identity,
        },
        settings: {
          ...prev.settings,
          resolvedTheme,
        },
        rating: {
          ...prev.rating,
          enabled: config.rating.enabled,
        },
      }
    })
  }

  const refreshRating = async () => {
    if (!config.rating.enabled) {
      setState(prev => ({
        ...prev,
        rating: {
          ...prev.rating,
          average: null,
          count: 0,
          userVote: null,
          loading: false,
        },
      }))
      return
    }

    setState(prev => ({
      ...prev,
      rating: {
        ...prev.rating,
        loading: true,
      },
    }))

    try {
      const summary = await deps.rating.getSummary({
        appId: config.appId,
        service: config.rating.service || 'APP',
        pollName: config.rating.pollName || `${config.appId}-rating`,
        auth: {
          authenticated: deps.auth.isAuthenticated(),
          identity: deps.auth.getIdentity(),
        },
      })
      setState(prev => ({
        ...prev,
        rating: {
          ...prev.rating,
          average: summary.average,
          count: summary.count,
          userVote: summary.userVote,
          hasPendingVote: summary.hasPendingVote,
          loading: false,
        },
      }))
    } catch (error) {
      setError('rating:refresh', error)
    }
  }

  const controller: InternalAppShellController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update(nextConfig, nextDeps) {
      config = nextConfig
      deps = nextDeps
      syncExternalState()
    },
    syncExternalState,
    openMenu() {
      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          menuOpen: true,
        },
      }))
    },
    closeMenu() {
      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          menuOpen: false,
        },
      }))
    },
    toggleMenu() {
      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          menuOpen: !prev.ui.menuOpen,
        },
      }))
    },
    openChangelog() {
      config.changelog.onOpen()
    },
    async authenticate() {
      setState(prev => ({
        ...prev,
        ui: {
          ...prev.ui,
          busy: true,
          error: null,
        },
      }))
      try {
        await deps.auth.authenticate()
        syncExternalState()
        setState(prev => ({
          ...prev,
          ui: {
            ...prev.ui,
            busy: false,
          },
        }))
        await refreshRating()
      } catch (error) {
        setError('auth', error)
      }
    },
    async maybeAuthOnStartup() {
      if (!state.settings.authOnStartup || deps.auth.isAuthenticated()) {
        syncExternalState()
        return
      }
      await controller.authenticate()
    },
    setTextSize(value) {
      setState(prev => {
        const next = {
          ...prev,
          settings: {
            ...prev.settings,
            textSize: value,
          },
        }
        persistSettings(deps, next)
        return next
      })
    },
    setAuthOnStartup(value) {
      setState(prev => {
        const next = {
          ...prev,
          settings: {
            ...prev.settings,
            authOnStartup: value,
          },
        }
        persistSettings(deps, next)
        return next
      })
    },
    setThemeMode(value) {
      setState(prev => {
        const resolvedTheme = resolveTheme(config, deps, value)
        applyResolvedTheme(config, deps, resolvedTheme)
        const next = {
          ...prev,
          settings: {
            ...prev.settings,
            themeMode: value,
            resolvedTheme,
          },
        }
        persistSettings(deps, next)
        return next
      })
    },
    async refreshRating() {
      await refreshRating()
    },
    async submitRating(value) {
      setState(prev => ({
        ...prev,
        rating: {
          ...prev.rating,
          hasPendingVote: true,
          loading: true,
        },
      }))
      try {
        await deps.rating.submitVote({
          appId: config.appId,
          service: config.rating.service || 'APP',
          pollName: config.rating.pollName || `${config.appId}-rating`,
          value,
          auth: {
            authenticated: deps.auth.isAuthenticated(),
            identity: deps.auth.getIdentity(),
          },
        })
        await refreshRating()
        setState(prev => ({
          ...prev,
          rating: {
            ...prev.rating,
            hasPendingVote: false,
          },
        }))
      } catch (error) {
        setError('rating:submit', error)
      }
    },
    dispose() {
      disposed = true
      listeners.clear()
    },
  }

  applyResolvedTheme(config, deps, state.settings.resolvedTheme)

  return controller
}

export function useAppShellController(
  config: AppShellConfig,
  deps: AppShellDeps
): AppShellController {
  const controller = useMemo(
    () => createAppShellController(config, deps),
    []
  ) as InternalAppShellController

  useEffect(() => {
    controller.update(config, deps)
  }, [controller, config, deps])

  useEffect(() => {
    controller.syncExternalState()
  })

  useEffect(() => {
    void controller.refreshRating()
  }, [controller])

  return controller
}

export function useAppShellState(controller: AppShellController): AppShellState {
  const internalController = controller as InternalAppShellController
  return useSyncExternalStore(
    internalController.subscribe,
    internalController.getState,
    internalController.getState
  )
}

export const AppMenu = ({
  state,
  controller,
  sections = ['auth', 'settings', 'rating'],
  labels = {},
}: {
  state: AppShellState
  controller: AppShellController
  sections?: string[]
  labels?: Record<string, string>
}) => {
  const hasSection = (section: string) => sections.includes(section)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 280 }}>
      {hasSection('auth') && (
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {labels.authSectionTitle || 'Authentication'}
          </Typography>
          <Button
            variant="contained"
            fullWidth
            disabled={state.ui.busy}
            onClick={() => {
              void controller.authenticate()
            }}
          >
            {state.ui.busy
              ? labels.authenticatingButton || 'Authenticating'
              : state.auth.authenticated
                ? state.auth.identity?.name || state.auth.identity?.address || 'Authenticated'
                : labels.authenticateButton || 'Authenticate'}
          </Button>
        </Box>
      )}

      {hasSection('settings') && (
        <>
          <Divider />
          <Box sx={{ p: 2, display: 'grid', gap: 2 }}>
            <Typography variant="subtitle2">
              {labels.settingsSectionTitle || 'Settings'}
            </Typography>
            <FormControl size="small" fullWidth>
              <Typography variant="caption" sx={{ mb: 0.5 }}>
                {labels.textSizeLabel || 'Text size'}
              </Typography>
              <Select
                value={state.settings.textSize}
                onChange={event => {
                  controller.setTextSize(event.target.value as TextSize)
                }}
              >
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" fullWidth>
              <Typography variant="caption" sx={{ mb: 0.5 }}>
                {labels.themeModeLabel || 'Theme mode'}
              </Typography>
              <Select
                value={state.settings.themeMode}
                onChange={event => {
                  controller.setThemeMode(event.target.value as AppThemeMode)
                }}
              >
                <MenuItem value="hub">Hub</MenuItem>
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={state.settings.authOnStartup}
                  onChange={event => {
                    controller.setAuthOnStartup(event.target.checked)
                  }}
                />
              }
              label={labels.authOnStartupLabel || 'Authenticate on startup'}
            />
          </Box>
        </>
      )}

      {hasSection('rating') && state.rating.enabled && (
        <>
          <Divider />
          <Box sx={{ p: 2, display: 'grid', gap: 1 }}>
            <Typography variant="subtitle2">
              {labels.ratingSectionTitle || 'Rate this app'}
            </Typography>
            <Rating
              value={state.rating.userVote || 0}
              onChange={(_event, value) => {
                if (!value) return
                void controller.submitRating(value)
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {state.rating.count > 0
                ? `Average ${state.rating.average} from ${state.rating.count} rating${state.rating.count === 1 ? '' : 's'}`
                : labels.ratingNoRatingsLabel || 'No ratings yet'}
            </Typography>
            <Button
              size="small"
              onClick={() => {
                void controller.refreshRating()
              }}
            >
              {labels.ratingRefreshButton || 'Refresh'}
            </Button>
          </Box>
        </>
      )}

      {state.ui.error && (
        <>
          <Divider />
          <Typography color="error" variant="caption" sx={{ p: 2, pt: 1 }}>
            {state.ui.error}
          </Typography>
        </>
      )}
    </Box>
  )
}
