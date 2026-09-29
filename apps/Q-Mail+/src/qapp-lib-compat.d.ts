declare module '@qortal/qapp-lib/app-shell/core' {
  export type ResolvedTheme = 'light' | 'dark';
  export type AppThemeMode = 'hub' | 'light' | 'dark';
  export type TextSize = 'small' | 'medium' | 'large';

  export interface AppShellState {
    ui: {
      menuOpen: boolean;
      busy: boolean;
      error: string | null;
    };
    auth: {
      authenticated: boolean;
      identity: { address?: string; name?: string } | null;
    };
    settings: {
      textSize: TextSize;
      authOnStartup: boolean;
      themeMode: AppThemeMode;
      resolvedTheme: ResolvedTheme;
    };
    rating: {
      enabled: boolean;
      average: number | null;
      count: number;
      userVote: number | null;
      hasPendingVote?: boolean;
      loading: boolean;
    };
  }

  export interface AppShellController {
    getState(): AppShellState;
    openMenu(): void;
    closeMenu(): void;
    toggleMenu(): void;
    openChangelog(): void;
    authenticate(): Promise<void>;
    maybeAuthOnStartup(): Promise<void>;
    setTextSize(value: TextSize): void;
    setAuthOnStartup(value: boolean): void;
    setThemeMode(value: AppThemeMode): void;
    refreshRating(): Promise<void>;
    submitRating(value: number): Promise<void>;
    dispose(): void;
  }

  export interface AppShellRatingAdapter {
    getSummary(input: {
      appId: string;
      service: string;
      pollName: string;
      auth?: {
        authenticated: boolean;
        identity?: { address?: string; name?: string } | null;
      };
    }): Promise<{
      average: number | null;
      count: number;
      userVote: number | null;
      hasPendingVote?: boolean;
    }>;
    submitVote(input: {
      appId: string;
      service: string;
      pollName: string;
      value: number;
    }): Promise<void>;
  }

  export interface AppShellDeps {
    storage: unknown;
    auth: unknown;
    rating: AppShellRatingAdapter;
    theme: unknown;
  }
}

declare module '@qortal/qapp-lib/app-shell/adapters' {
  import type {
    AppShellDeps,
    AppShellRatingAdapter,
  } from '@qortal/qapp-lib/app-shell/core';

  export interface CreateQortalRatingAdapterOptions {
    qortalRequest: (request: Record<string, unknown>) => Promise<unknown>;
    fetch?: (input: string, init?: RequestInit) => Promise<Response>;
    apiBaseUrl?: string;
  }

  export function createBrowserDeps(options: {
    auth: {
      isAuthenticated: () => boolean;
      getIdentity: () => { address?: string; name?: string } | null;
      authenticate: () => Promise<void>;
    };
    rating: AppShellRatingAdapter;
    storage?: {
      prefix?: string;
    };
    theme?: {
      root?: HTMLElement;
      datasetKey?: string;
      themeDataKey?: string;
      themeEventName?: string;
    };
  }): AppShellDeps;

  export function createQortalRatingAdapter(
    options: CreateQortalRatingAdapterOptions
  ): AppShellRatingAdapter;
}

declare module '@qortal/qapp-lib/app-shell/react' {
  import type { ComponentType } from 'react';
  import type {
    AppShellController,
    AppShellDeps,
    AppShellState,
  } from '@qortal/qapp-lib/app-shell/core';

  export function useAppShellController(
    config: {
      appId: string;
      appName: string;
      appVersion: string;
      changelog: {
        onOpen: () => void;
      };
      rating: {
        enabled: boolean;
        service?: string;
        appDisplayName?: string;
        pollName?: string;
      };
      defaults?: {
        textSize?: 'small' | 'medium' | 'large';
        authOnStartup?: boolean;
        themeMode?: 'hub' | 'light' | 'dark';
      };
      events?: {
        onThemeChanged?: (theme: { resolvedTheme: 'light' | 'dark' }) => void;
        onError?: (event: { phase: string; message: string }) => void;
      };
    },
    deps: AppShellDeps
  ): AppShellController;

  export function useAppShellState(controller: AppShellController): AppShellState;

  export const AppMenu: ComponentType<any>;
}

declare module '@qortal/qapp-lib/typography' {
  export function ensureLexendIllinoisTypographyStyle(options?: {
    id?: string;
    textSizeScale?: Partial<Record<'small' | 'medium' | 'large', number>>;
  }): HTMLStyleElement;

  export function applyQAppTextSize(
    root: HTMLElement,
    textSize: 'small' | 'medium' | 'large'
  ): void;
}

declare module '@qortal/qapp-lib/left-sidebar/core' {
  export interface LeftSidebarItem {
    id: string;
    label: string;
    secondaryLabel?: string;
    ariaLabel?: string;
    icon?: string;
    disabled?: boolean;
    hidden?: boolean;
    badgeText?: string;
  }

  export interface LeftSidebarState {
    mode: 'desktop' | 'mobile';
    open: boolean;
    pinned: boolean;
    activeItemId: string | null;
    items: LeftSidebarItem[];
    overlayPreview?: boolean;
    closing?: boolean;
  }

  export interface LeftSidebarConfig {
    appId: string;
    items: LeftSidebarItem[];
    breakpointPx?: number;
    storageKey?: string;
    defaults?: {
      pinned?: boolean;
      openDesktop?: boolean;
      openMobile?: boolean;
    };
    preview?: {
      closeDelayMs?: number;
      closeAnimationMs?: number;
    };
  }

  export interface LeftSidebarDeps {
    storage: {
      get<T>(key: string): T | null;
      set<T>(key: string, value: T): void;
      remove?(key: string): void;
    };
    getViewportWidth: () => number;
  }

  export interface LeftSidebarController {
    getState(): LeftSidebarState;
    subscribe(listener: (state: LeftSidebarState) => void): () => void;
    setItems(items: LeftSidebarItem[]): void;
    setActiveItem(id: string | null): void;
    open(): void;
    close(): void;
    toggle(): void;
    openPreview(): void;
    schedulePreviewClose(delayMs?: number): void;
    cancelPreviewClose(): void;
    promotePreview(): void;
    setPinned(value: boolean): void;
    togglePinned(): void;
    setViewportWidth(width: number): void;
    handleEscapeKey(): void;
    handleOutsideInteraction(): void;
    dispose(): void;
  }

  export type LeftSidebarAnchorClickMode = 'toggleOpen' | 'togglePinnedDesktop';

  export interface LeftSidebarHoverPreviewBindings {
    onAnchorPointerEnter: () => void;
    onAnchorPointerLeave: () => void;
    onSidebarPointerEnter: () => void;
    onSidebarPointerLeave: () => void;
    onAnchorClick: () => void;
  }

  export interface LeftSidebarHoverPreviewOptions {
    closeDelayMs?: number;
    onAnchorClickMode?: LeftSidebarAnchorClickMode;
  }
}

declare module '@qortal/qapp-lib/left-sidebar/react' {
  import type { ComponentType, ReactNode } from 'react';
  import type {
    LeftSidebarConfig,
    LeftSidebarController,
    LeftSidebarDeps,
    LeftSidebarItem,
    LeftSidebarState,
  } from '@qortal/qapp-lib/left-sidebar/core';

  export function useLeftSidebarController(
    config: LeftSidebarConfig,
    deps: LeftSidebarDeps
  ): LeftSidebarController;

  export function useLeftSidebarHoverPreview(
    controller: LeftSidebarController,
    options?: import('@qortal/qapp-lib/left-sidebar/core').LeftSidebarHoverPreviewOptions
  ): import('@qortal/qapp-lib/left-sidebar/core').LeftSidebarHoverPreviewBindings;

  export function useLeftSidebarState(
    controller: LeftSidebarController
  ): LeftSidebarState;

  export const LeftSidebar: ComponentType<{
    state: LeftSidebarState;
    controller?: LeftSidebarController;
    onSelectItem?: (itemId: string) => void;
    renderItemIcon?: (item: LeftSidebarItem) => ReactNode;
    hoverPreviewBindings?: Partial<
      Pick<
        import('@qortal/qapp-lib/left-sidebar/core').LeftSidebarHoverPreviewBindings,
        'onSidebarPointerEnter' | 'onSidebarPointerLeave'
      >
    >;
  }>;
}
