export type ResolvedTheme = 'light' | 'dark'
export type AppThemeMode = 'hub' | 'light' | 'dark'
export type TextSize = 'small' | 'medium' | 'large'

export interface AppShellState {
  ui: {
    menuOpen: boolean
    busy: boolean
    error: string | null
  }
  auth: {
    authenticated: boolean
    identity: { address?: string; name?: string } | null
  }
  settings: {
    textSize: TextSize
    authOnStartup: boolean
    themeMode: AppThemeMode
    resolvedTheme: ResolvedTheme
  }
  rating: {
    enabled: boolean
    average: number | null
    count: number
    userVote: number | null
    hasPendingVote?: boolean
    loading: boolean
  }
}

export interface AppShellController {
  getState(): AppShellState
  openMenu(): void
  closeMenu(): void
  toggleMenu(): void
  openChangelog(): void
  authenticate(): Promise<void>
  maybeAuthOnStartup(): Promise<void>
  setTextSize(value: TextSize): void
  setAuthOnStartup(value: boolean): void
  setThemeMode(value: AppThemeMode): void
  refreshRating(): Promise<void>
  submitRating(value: number): Promise<void>
  dispose(): void
}

export interface AppShellRatingAdapter {
  getSummary(input: {
    appId: string
    service: string
    pollName: string
    auth?: {
      authenticated: boolean
      identity?: { address?: string; name?: string } | null
    }
  }): Promise<{
    average: number | null
    count: number
    userVote: number | null
    hasPendingVote?: boolean
  }>
  submitVote(input: {
    appId: string
    service: string
    pollName: string
    value: number
    auth?: {
      authenticated: boolean
      identity?: { address?: string; name?: string } | null
    }
  }): Promise<void>
}

export interface BrowserStorageAdapter {
  prefix?: string
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
  remove(key: string): void
}

export interface BrowserThemeAdapter {
  root: HTMLElement
  datasetKey: string
  themeDataKey: string
  themeEventName: string
}

export interface BrowserAuthAdapter {
  isAuthenticated: () => boolean
  getIdentity: () => { address?: string; name?: string } | null
  authenticate: () => Promise<void>
}

export interface AppShellDeps {
  storage: BrowserStorageAdapter
  auth: BrowserAuthAdapter
  rating: AppShellRatingAdapter
  theme: BrowserThemeAdapter
}

