import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { HubThemeProvider } from '../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../theme/qplus-theme'
import { layoutModeForWidth } from './useLayoutMode'
import { appHeightValue } from './useAppViewport'
import { MailShell } from './MailShell'
import { BottomNav } from './BottomNav'
import { Rail, groupRailItems, NAME_FILTER_THRESHOLD } from './Rail'
import { fetchingLabel } from './states'

function wrap(ui: React.ReactElement) {
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {ui}
    </HubThemeProvider>
  )
}

describe('layoutModeForWidth', () => {
  it('maps widths to the three layouts', () => {
    expect(layoutModeForWidth(360)).toBe('phone')
    expect(layoutModeForWidth(599)).toBe('phone')
    expect(layoutModeForWidth(600)).toBe('medium')
    expect(layoutModeForWidth(700)).toBe('medium')
    expect(layoutModeForWidth(899)).toBe('medium')
    expect(layoutModeForWidth(900)).toBe('desktop')
    expect(layoutModeForWidth(1440)).toBe('desktop')
  })
})

describe('appHeightValue', () => {
  const fakeWindow = (opts: { parent?: unknown; inner: number; visual?: number }) =>
    ({
      parent: opts.parent ?? 'self',
      innerHeight: opts.inner,
      visualViewport: opts.visual === undefined ? null : { height: opts.visual },
    }) as unknown as Window

  it('uses 100dvh outside an iframe when no keyboard is open', () => {
    const w = fakeWindow({ inner: 800, visual: 800 })
    ;(w as any).parent = w
    expect(appHeightValue(w)).toBe('100dvh')
  })

  it('uses the frame height inside Hub or GO', () => {
    const w = fakeWindow({ parent: {}, inner: 640, visual: 640 })
    expect(appHeightValue(w)).toBe('640px')
  })

  it('shrinks to the visual viewport when the keyboard is open', () => {
    const w = fakeWindow({ inner: 800, visual: 420 })
    ;(w as any).parent = w
    expect(appHeightValue(w)).toBe('420px')
    const framed = fakeWindow({ parent: {}, inner: 640, visual: 300 })
    expect(appHeightValue(framed)).toBe('300px')
  })
})

describe('MailShell', () => {
  const baseProps = {
    rail: <div>rail content</div>,
    railOpen: false,
    onRailOpenChange: () => {},
    list: <div>the list</div>,
    reading: <div>the message</div>,
    readingPlaceholder: <div>pick one</div>,
    bottomNav: <nav>bottom nav</nav>,
    fab: <button>fab</button>,
  }

  it('shows rail, list and reading pane on desktop', () => {
    wrap(<MailShell mode="desktop" {...baseProps} readingOpen />)
    expect(screen.getByText('rail content')).toBeTruthy()
    expect(screen.getByText('the list')).toBeTruthy()
    expect(screen.getByText('the message')).toBeTruthy()
    expect(screen.queryByText('bottom nav')).toBeNull()
    expect(screen.queryByText('fab')).toBeNull()
  })

  it('shows the placeholder when nothing is open and keeps the rail in a drawer on medium', () => {
    wrap(<MailShell mode="medium" {...baseProps} reading={null} />)
    expect(screen.getByText('the list')).toBeTruthy()
    expect(screen.getByText('pick one')).toBeTruthy()
    expect(screen.queryByText('rail content')).toBeNull()
  })

  it('on a phone shows the list with nav and FAB, then only the message when one is open', () => {
    const { rerender } = wrap(<MailShell mode="phone" {...baseProps} readingOpen={false} />)
    expect(screen.getByText('the list')).toBeTruthy()
    expect(screen.queryByText('the message')).toBeNull()
    expect(screen.getByText('bottom nav')).toBeTruthy()
    expect(screen.getByText('fab')).toBeTruthy()
    rerender(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <MailShell mode="phone" {...baseProps} readingOpen />
      </HubThemeProvider>
    )
    expect(screen.queryByText('the list')).toBeNull()
    expect(screen.getByText('the message')).toBeTruthy()
    expect(screen.queryByText('bottom nav')).toBeNull()
    expect(screen.queryByText('fab')).toBeNull()
  })

  it('a wide view replaces both panes and hides the phone chrome unless it keeps it', () => {
    const { rerender } = wrap(<MailShell mode="phone" {...baseProps} wide={<div>composer</div>} />)
    expect(screen.getByText('composer')).toBeTruthy()
    expect(screen.queryByText('the list')).toBeNull()
    expect(screen.queryByText('bottom nav')).toBeNull()
    rerender(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <MailShell mode="phone" {...baseProps} wide={<div>aliases</div>} wideKeepsChrome />
      </HubThemeProvider>
    )
    expect(screen.getByText('aliases')).toBeTruthy()
    expect(screen.getByText('bottom nav')).toBeTruthy()
  })
})

describe('BottomNav', () => {
  it('renders at most five items and marks the active one', () => {
    const onSelect = vi.fn()
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, label: id.toUpperCase(), icon: <InboxOutlinedIcon /> }))
    wrap(<BottomNav items={items} activeId="b" onSelect={onSelect} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'B' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(onSelect).toHaveBeenCalledWith('c')
  })
})

describe('Rail', () => {
  const items = [
    { id: 'compose', label: 'Compose' },
    { id: 'inbox', label: 'Inbox' },
    { id: 'inbox-instance:alice', label: 'alice' },
    { id: 'inbox-instance:bob', label: 'bob' },
    { id: 'aliases', label: 'Aliases' },
    { id: 'sent', label: 'Sent' },
    { id: 'threads', label: 'Q-Mail Threads', badgeText: '-' },
    { id: 'threads-group:7', label: 'Devs' },
    { id: 'publish-mail-state', label: 'Publish Q-Mail State', badgeText: '!' },
  ]

  it('groups children under their section', () => {
    const grouped = groupRailItems(items)
    expect(grouped.compose?.id).toBe('compose')
    expect(grouped.publishState?.id).toBe('publish-mail-state')
    expect(grouped.sections.map((s) => s.item.id)).toEqual(['inbox', 'aliases', 'sent', 'threads'])
    expect(grouped.sections[0].children.map((c) => c.label)).toEqual(['alice', 'bob'])
    expect(grouped.sections[3].children.map((c) => c.label)).toEqual(['Devs'])
  })

  it('renders the model and forwards selections', () => {
    const onSelect = vi.fn()
    const onOpenSettings = vi.fn()
    wrap(<Rail items={items} activeItemId="inbox" onSelect={onSelect} onOpenSettings={onOpenSettings} version="1.0.0" />)
    expect(screen.getByRole('button', { name: 'Inbox' }).getAttribute('aria-current')).toBe('page')
    fireEvent.click(screen.getByRole('button', { name: 'bob' }))
    expect(onSelect).toHaveBeenCalledWith('inbox-instance:bob')
    fireEvent.click(screen.getByRole('button', { name: 'Compose' }))
    expect(onSelect).toHaveBeenCalledWith('compose')
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalled()
    expect(screen.queryByLabelText('Find a name')).toBeNull()
  })

  it('offers a name filter above the threshold', () => {
    const many = [
      { id: 'inbox', label: 'Inbox' },
      ...Array.from({ length: NAME_FILTER_THRESHOLD + 1 }, (_, i) => ({ id: `inbox-instance:name${i}`, label: `name${i}` })),
    ]
    wrap(<Rail items={many} activeItemId={null} onSelect={() => {}} onOpenSettings={() => {}} version="1.0.0" />)
    const filter = screen.getByLabelText('Find a name')
    fireEvent.change(filter, { target: { value: 'name1' } })
    expect(screen.getByRole('button', { name: 'name1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'name15' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'name2' })).toBeNull()
  })
})

describe('fetchingLabel', () => {
  it('describes QDN download states in plain words', () => {
    expect(fetchingLabel(undefined)).toBe('Fetching from peers…')
    expect(fetchingLabel('DOWNLOADING')).toBe('Fetching from peers…')
    expect(fetchingLabel('REFETCHING')).toBe('Refetching from peers…')
    expect(fetchingLabel('MISSING_DATA')).toBe('Not enough peers have this yet')
  })
})
