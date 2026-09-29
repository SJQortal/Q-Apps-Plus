import type {
  AppShellDeps,
  AppShellRatingAdapter,
  BrowserAuthAdapter,
  BrowserStorageAdapter,
  BrowserThemeAdapter,
} from './core'

export interface CreateQortalRatingAdapterOptions {
  qortalRequest: (request: Record<string, unknown>) => Promise<unknown>
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  apiBaseUrl?: string
}

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

const writeJson = <T,>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function createBrowserDeps(options: {
  auth: BrowserAuthAdapter
  rating: AppShellRatingAdapter
  storage?: {
    prefix?: string
  }
  theme?: {
    root?: HTMLElement
    datasetKey?: string
    themeDataKey?: string
    themeEventName?: string
  }
}): AppShellDeps {
  const storagePrefix = options.storage?.prefix ?? 'qmail'
  const storage: BrowserStorageAdapter = {
    prefix: storagePrefix,
    get: <T,>(key: string) => readJson<T>(`${storagePrefix}:${key}`),
    set: <T,>(key: string, value: T) => writeJson(`${storagePrefix}:${key}`, value),
    remove: (key: string) => {
      try {
        localStorage.removeItem(`${storagePrefix}:${key}`)
      } catch {
        /* ignore */
      }
    },
  }

  const theme: BrowserThemeAdapter = {
    root: options.theme?.root ?? document.documentElement,
    datasetKey: options.theme?.datasetKey ?? 'theme',
    themeDataKey: options.theme?.themeDataKey ?? '_qdnTheme',
    themeEventName: options.theme?.themeEventName ?? 'THEME_CHANGED',
  }

  return {
    auth: options.auth,
    rating: options.rating,
    storage,
    theme,
  }
}

interface StoredVoteMap {
  [identity: string]: number
}

const getVoteStorageKey = (service: string, pollName: string, appId: string) =>
  `qapp-lib:ratings:${service}:${pollName}:${appId}`

const getIdentityKey = (
  auth?: {
    authenticated: boolean
    identity?: { address?: string; name?: string } | null
  }
) => {
  if (!auth?.authenticated) return 'anonymous'
  return auth.identity?.address || auth.identity?.name || 'authenticated'
}

export function createQortalRatingAdapter(
  _options: CreateQortalRatingAdapterOptions
): AppShellRatingAdapter {
  return {
    async getSummary({ appId, service, pollName, auth }) {
      const storageKey = getVoteStorageKey(service, pollName, appId)
      const votes = readJson<StoredVoteMap>(storageKey) || {}
      const values = Object.values(votes).filter(
        value => Number.isFinite(value) && value >= 1 && value <= 5
      )
      const count = values.length
      const average = count
        ? Number((values.reduce((sum, value) => sum + value, 0) / count).toFixed(2))
        : null
      const userVote = votes[getIdentityKey(auth)] ?? null
      return {
        average,
        count,
        userVote,
      }
    },
    async submitVote({ appId, service, pollName, value, auth }) {
      const normalizedValue = Math.max(1, Math.min(5, Math.round(value)))
      const storageKey = getVoteStorageKey(service, pollName, appId)
      const votes = readJson<StoredVoteMap>(storageKey) || {}
      votes[getIdentityKey(auth)] = normalizedValue
      writeJson(storageKey, votes)
    },
  }
}

