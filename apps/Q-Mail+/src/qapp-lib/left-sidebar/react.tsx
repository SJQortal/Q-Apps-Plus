import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import type {
  LeftSidebarConfig,
  LeftSidebarController,
  LeftSidebarDeps,
  LeftSidebarHoverPreviewBindings,
  LeftSidebarHoverPreviewOptions,
  LeftSidebarItem,
  LeftSidebarState,
} from './core'

type InternalLeftSidebarController = LeftSidebarController & {
  update(config: LeftSidebarConfig, deps: LeftSidebarDeps): void
}

const getStorageKey = (config: LeftSidebarConfig) =>
  config.storageKey || `${config.appId}:left-sidebar`

const getMode = (width: number, breakpointPx: number) =>
  width < breakpointPx ? 'mobile' : 'desktop'

const createInitialState = (
  config: LeftSidebarConfig,
  deps: LeftSidebarDeps
): LeftSidebarState => {
  const breakpointPx = config.breakpointPx ?? 960
  const mode = getMode(deps.getViewportWidth(), breakpointPx)
  const stored =
    deps.storage.get<{
      pinned?: boolean
      open?: boolean
      activeItemId?: string | null
    }>(getStorageKey(config)) || {}
  const pinned =
    mode === 'desktop'
      ? typeof stored.pinned === 'boolean'
        ? stored.pinned
        : config.defaults?.pinned ?? true
      : false
  const open =
    typeof stored.open === 'boolean'
      ? stored.open
      : mode === 'desktop'
        ? (config.defaults?.openDesktop ?? true) || pinned
        : config.defaults?.openMobile ?? false

  return {
    mode,
    open: mode === 'desktop' ? open || pinned : open,
    pinned,
    activeItemId: stored.activeItemId ?? null,
    items: config.items,
    overlayPreview: false,
    closing: false,
  }
}

const persistState = (config: LeftSidebarConfig, deps: LeftSidebarDeps, state: LeftSidebarState) => {
  deps.storage.set(getStorageKey(config), {
    pinned: state.pinned,
    open: state.open,
    activeItemId: state.activeItemId,
  })
}

const createLeftSidebarController = (
  initialConfig: LeftSidebarConfig,
  initialDeps: LeftSidebarDeps
): InternalLeftSidebarController => {
  let config = initialConfig
  let deps = initialDeps
  let state = createInitialState(config, deps)
  const listeners = new Set<(state: LeftSidebarState) => void>()
  let closeTimer: number | null = null
  let disposed = false

  const emit = () => {
    if (disposed) return
    persistState(config, deps, state)
    listeners.forEach(listener => listener(state))
  }

  const setState = (updater: LeftSidebarState | ((prev: LeftSidebarState) => LeftSidebarState)) => {
    state = typeof updater === 'function' ? updater(state) : updater
    emit()
  }

  const clearCloseTimer = () => {
    if (closeTimer !== null) {
      window.clearTimeout(closeTimer)
      closeTimer = null
    }
  }

  const closeTransient = () => {
    setState(prev => ({
      ...prev,
      open: prev.pinned && prev.mode === 'desktop' ? true : false,
      overlayPreview: false,
      closing: false,
    }))
  }

  return {
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
      setState(prev => ({
        ...prev,
        items: nextConfig.items,
      }))
    },
    setItems(items) {
      setState(prev => ({
        ...prev,
        items,
      }))
    },
    setActiveItem(id) {
      setState(prev => ({
        ...prev,
        activeItemId: id,
      }))
    },
    open() {
      clearCloseTimer()
      setState(prev => ({
        ...prev,
        open: true,
        overlayPreview: prev.mode === 'desktop' && !prev.pinned,
        closing: false,
      }))
    },
    close() {
      clearCloseTimer()
      closeTransient()
    },
    toggle() {
      if (state.open && (state.mode === 'mobile' || !state.pinned || state.overlayPreview)) {
        closeTransient()
        return
      }
      this.open()
    },
    openPreview() {
      if (state.mode !== 'desktop' || state.pinned) return
      clearCloseTimer()
      setState(prev => ({
        ...prev,
        open: true,
        overlayPreview: true,
        closing: false,
      }))
    },
    schedulePreviewClose(delayMs) {
      if (state.mode !== 'desktop' || state.pinned || !state.overlayPreview) return
      clearCloseTimer()
      closeTimer = window.setTimeout(() => {
        closeTransient()
      }, delayMs ?? config.preview?.closeDelayMs ?? 180)
    },
    cancelPreviewClose() {
      clearCloseTimer()
      setState(prev => ({
        ...prev,
        closing: false,
      }))
    },
    promotePreview() {
      if (state.mode !== 'desktop') return
      clearCloseTimer()
      setState(prev => ({
        ...prev,
        open: true,
        pinned: true,
        overlayPreview: false,
        closing: false,
      }))
    },
    setPinned(value) {
      clearCloseTimer()
      setState(prev => ({
        ...prev,
        pinned: prev.mode === 'desktop' ? value : false,
        open: prev.mode === 'desktop' ? value : prev.open,
        overlayPreview: false,
        closing: false,
      }))
    },
    togglePinned() {
      if (state.mode !== 'desktop') {
        this.toggle()
        return
      }
      if (!state.open) {
        this.setPinned(true)
        return
      }
      this.setPinned(!state.pinned)
    },
    setViewportWidth(width) {
      const breakpointPx = config.breakpointPx ?? 960
      const mode = getMode(width, breakpointPx)
      if (mode === state.mode) return
      setState(prev => ({
        ...prev,
        mode,
        pinned: mode === 'desktop' ? prev.pinned || (config.defaults?.pinned ?? true) : false,
        open:
          mode === 'desktop'
            ? prev.pinned || (config.defaults?.openDesktop ?? true)
            : config.defaults?.openMobile ?? false,
        overlayPreview: false,
        closing: false,
      }))
    },
    handleEscapeKey() {
      if (!state.open) return
      if (state.mode === 'mobile' || state.overlayPreview || !state.pinned) {
        closeTransient()
      }
    },
    handleOutsideInteraction() {
      if (!state.open) return
      if (state.mode === 'mobile' || state.overlayPreview || !state.pinned) {
        closeTransient()
      }
    },
    dispose() {
      disposed = true
      clearCloseTimer()
      listeners.clear()
    },
  }
}

export function useLeftSidebarController(
  config: LeftSidebarConfig,
  deps: LeftSidebarDeps
): LeftSidebarController {
  const controller = useMemo(
    () => createLeftSidebarController(config, deps),
    []
  ) as InternalLeftSidebarController

  useEffect(() => {
    controller.update(config, deps)
  }, [config, controller, deps])

  return controller
}

export function useLeftSidebarState(controller: LeftSidebarController): LeftSidebarState {
  const internalController = controller as InternalLeftSidebarController
  return useSyncExternalStore(
    listener => internalController.subscribe(() => listener()),
    internalController.getState,
    internalController.getState
  )
}

export function useLeftSidebarHoverPreview(
  controller: LeftSidebarController,
  options?: LeftSidebarHoverPreviewOptions
): LeftSidebarHoverPreviewBindings {
  return useMemo(
    () => ({
      onAnchorPointerEnter: () => {
        controller.openPreview()
      },
      onAnchorPointerLeave: () => {
        controller.schedulePreviewClose(options?.closeDelayMs)
      },
      onSidebarPointerEnter: () => {
        controller.cancelPreviewClose()
      },
      onSidebarPointerLeave: () => {
        controller.schedulePreviewClose(options?.closeDelayMs)
      },
      onAnchorClick: () => {
        const state = controller.getState()
        if (options?.onAnchorClickMode === 'togglePinnedDesktop' && state.mode === 'desktop') {
          controller.togglePinned()
          return
        }
        controller.toggle()
      },
    }),
    [controller, options?.closeDelayMs, options?.onAnchorClickMode]
  )
}

export const LeftSidebar = ({
  state,
  controller,
  onSelectItem,
  renderItemIcon,
  hoverPreviewBindings,
}: {
  state: LeftSidebarState
  controller?: LeftSidebarController
  onSelectItem?: (itemId: string) => void
  renderItemIcon?: (item: LeftSidebarItem) => React.ReactNode
  hoverPreviewBindings?: Partial<
    Pick<LeftSidebarHoverPreviewBindings, 'onSidebarPointerEnter' | 'onSidebarPointerLeave'>
  >
}) => {
  const visible = state.open || (state.mode === 'desktop' && state.pinned)
  if (!visible) {
    return null
  }

  const filteredItems = state.items.filter(item => !item.hidden)
  const sidebarWidth = state.mode === 'mobile' ? 'min(88vw, 20rem)' : 'clamp(14rem, 20vw, 18rem)'

  return (
    <>
      {state.mode === 'mobile' && state.open && (
        <Box
          onClick={() => controller?.handleOutsideInteraction()}
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.36)',
            zIndex: 5,
          }}
        />
      )}
      <Box
        data-qapp-lib='left-sidebar'
        onPointerEnter={hoverPreviewBindings?.onSidebarPointerEnter}
        onPointerLeave={hoverPreviewBindings?.onSidebarPointerLeave}
        sx={{
          position: state.mode === 'mobile' ? 'absolute' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 6,
          width: sidebarWidth,
          minWidth: state.mode === 'mobile' ? 0 : sidebarWidth,
          maxWidth: '100%',
          borderRight: '1px solid var(--qmail-shell-border, rgba(255,255,255,0.12))',
          background:
            'var(--qmail-shell-sidebar-bg, linear-gradient(180deg, rgba(17,24,39,0.96), rgba(10,15,24,0.94)))',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          overflowX: 'hidden',
          boxShadow:
            state.mode === 'mobile' || state.overlayPreview
              ? '0 16px 40px rgba(0, 0, 0, 0.28)'
              : 'none',
        }}
      >
        <Box
          sx={{
            px: '0.75rem',
            py: '1rem',
            display: 'grid',
            gap: '0.4rem',
            overflowY: 'auto',
            overflowX: 'hidden',
            minWidth: 0,
          }}
        >
          {filteredItems.map(item => {
            const isActive = item.id === state.activeItemId
            const isNested = item.id.includes(':')
            const isComposeItem = item.id === 'compose'
            const isSectionItem = !isNested
            const hasWarningState = item.badgeText === '!'
            return (
              <ButtonBase
                key={item.id}
                disabled={item.disabled}
                onClick={() => {
                  controller?.setActiveItem(item.id)
                  onSelectItem?.(item.id)
                }}
                sx={{
                  width: '100%',
                  justifyContent: 'flex-start',
                  minWidth: 0,
                  borderRadius: isComposeItem ? '1rem' : '0.875rem',
                  px: isComposeItem ? '1rem' : '0.75rem',
                  py: isComposeItem ? '0.95rem' : '0.75rem',
                  textAlign: 'left',
                  gap: isComposeItem ? '0.85rem' : '0.75rem',
                  pl: isComposeItem
                    ? '1rem'
                    : isNested
                      ? '1.5rem'
                      : '0.75rem',
                  backgroundColor: isActive
                    ? 'var(--qmail-shell-selected-bg, rgba(255,255,255,0.1))'
                    : isComposeItem
                      ? 'var(--qmail-compose-button-bg, rgba(255,255,255,0.08))'
                      : hasWarningState
                        ? 'var(--qmail-warning-bg, rgba(255, 153, 0, 0.18))'
                        : 'transparent',
                  border: isActive
                    ? '1px solid var(--qmail-brand-strong, rgba(103,195,255,0.85))'
                    : isComposeItem
                      ? '1px solid var(--qmail-compose-button-border, rgba(255,255,255,0.16))'
                      : hasWarningState
                        ? '1px solid var(--qmail-warning-border, rgba(255, 171, 64, 0.95))'
                        : '1px solid transparent',
                  outline: isActive
                    ? '2px solid var(--qmail-brand-strong, #67c3ff)'
                    : hasWarningState
                      ? '2px solid var(--qmail-warning-border, rgba(255, 171, 64, 0.95))'
                      : '2px solid transparent',
                  outlineOffset: '-1px',
                  boxShadow: isActive
                    ? '0 0 0 0.1rem var(--qmail-brand-soft, rgba(57,175,255,0.2))'
                    : 'none',
                  color: 'var(--qmail-thread-text, inherit)',
                  opacity: item.disabled ? 0.5 : 1,
                  '&:hover': {
                    backgroundColor: isComposeItem
                      ? 'var(--qmail-compose-button-hover-bg, rgba(255,255,255,0.12))'
                      : hasWarningState
                        ? 'var(--qmail-warning-hover-bg, rgba(255, 153, 0, 0.24))'
                        : 'var(--qmail-shell-hover, rgba(255,255,255,0.06))',
                  },
                }}
              >
                <Box
                  sx={{
                    width: isComposeItem ? '1.75rem' : '1.25rem',
                    minWidth: isComposeItem ? '1.75rem' : '1.25rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {renderItemIcon?.(item) || null}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant='body2'
                    sx={{
                      fontWeight: isComposeItem ? 700 : isNested ? 400 : 650,
                      fontSize: isComposeItem
                        ? '1rem'
                        : isSectionItem
                          ? '1.02rem'
                          : '0.92rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.label}
                  </Typography>
                  {item.secondaryLabel ? (
                    <Typography
                      variant='caption'
                      className='qapp-lib-left-sidebar-item-secondary-label'
                      sx={{
                        display: 'block',
                        mt: '0.2rem',
                        fontSize: '0.74rem',
                        lineHeight: 1.3,
                        color: 'var(--qmail-thread-muted, rgba(193,210,235,0.84))',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.secondaryLabel}
                    </Typography>
                  ) : null}
                </Box>
                {item.badgeText ? (
                  <Typography
                    variant='caption'
                    sx={{
                      opacity: 1,
                      flexShrink: 0,
                      fontSize: isComposeItem ? '0.8rem' : '0.7rem',
                      color: hasWarningState
                        ? 'var(--qmail-warning-border, rgba(255, 171, 64, 0.95))'
                        : 'inherit',
                      fontWeight: hasWarningState ? 800 : 500,
                    }}
                  >
                    {item.badgeText}
                  </Typography>
                ) : null}
              </ButtonBase>
            )
          })}
        </Box>
      </Box>
    </>
  )
}
