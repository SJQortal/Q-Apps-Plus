export interface LeftSidebarItem {
  id: string
  label: string
  secondaryLabel?: string
  ariaLabel?: string
  icon?: string
  disabled?: boolean
  hidden?: boolean
  badgeText?: string
}

export interface LeftSidebarState {
  mode: 'desktop' | 'mobile'
  open: boolean
  pinned: boolean
  activeItemId: string | null
  items: LeftSidebarItem[]
  overlayPreview?: boolean
  closing?: boolean
}

export interface LeftSidebarConfig {
  appId: string
  items: LeftSidebarItem[]
  breakpointPx?: number
  storageKey?: string
  defaults?: {
    pinned?: boolean
    openDesktop?: boolean
    openMobile?: boolean
  }
  preview?: {
    closeDelayMs?: number
    closeAnimationMs?: number
  }
}

export interface LeftSidebarDeps {
  storage: {
    get<T>(key: string): T | null
    set<T>(key: string, value: T): void
    remove?(key: string): void
  }
  getViewportWidth: () => number
}

export interface LeftSidebarController {
  getState(): LeftSidebarState
  subscribe(listener: (state: LeftSidebarState) => void): () => void
  setItems(items: LeftSidebarItem[]): void
  setActiveItem(id: string | null): void
  open(): void
  close(): void
  toggle(): void
  openPreview(): void
  schedulePreviewClose(delayMs?: number): void
  cancelPreviewClose(): void
  promotePreview(): void
  setPinned(value: boolean): void
  togglePinned(): void
  setViewportWidth(width: number): void
  handleEscapeKey(): void
  handleOutsideInteraction(): void
  dispose(): void
}

export type LeftSidebarAnchorClickMode = 'toggleOpen' | 'togglePinnedDesktop'

export interface LeftSidebarHoverPreviewBindings {
  onAnchorPointerEnter: () => void
  onAnchorPointerLeave: () => void
  onSidebarPointerEnter: () => void
  onSidebarPointerLeave: () => void
  onAnchorClick: () => void
}

export interface LeftSidebarHoverPreviewOptions {
  closeDelayMs?: number
  onAnchorClickMode?: LeftSidebarAnchorClickMode
}
