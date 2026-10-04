import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import { HubThemeProvider } from '../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../theme/qplus-theme'
import { layoutModeForWidth } from './useLayoutMode'
import { appHeightValue } from './useAppViewport'
import { LIST_CONTAINER, LIST_WIDTH_DESKTOP, MailShell, RAIL_WIDTH } from './MailShell'
import { paneWidthsKey, readPaneWidths } from './usePaneWidths'
import { BottomNav, badgeLabel } from './BottomNav'
import { Rail, badgeFor, groupRailItems, NAME_FILTER_THRESHOLD } from './Rail'
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

  it('keeps the rail in a drawer on medium, and with nothing open shows no reading pane', () => {
    wrap(<MailShell mode="medium" {...baseProps} reading={null} />)
    expect(screen.getByText('the list')).toBeTruthy()
    expect(screen.queryByLabelText('Reading pane')).toBeNull()
    expect(screen.queryByText('rail content')).toBeNull()
  })

  it('lets the list take the full width until something opens, and again after it closes', () => {
    const { rerender } = wrap(<MailShell mode="desktop" {...baseProps} reading={null} />)
    const list = () => screen.getByLabelText('Messages')
    expect(screen.queryByLabelText('Reading pane')).toBeNull()
    expect(getComputedStyle(list()).flexGrow).toBe('1')
    expect(getComputedStyle(list()).width).toBe('100%')
    const again = (reading: React.ReactNode) =>
      rerender(
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <MailShell mode="desktop" {...baseProps} reading={reading} readingOpen={Boolean(reading)} />
        </HubThemeProvider>
      )
    again(<div>the message</div>)
    expect(screen.getByLabelText('Reading pane').textContent).toBe('the message')
    expect(getComputedStyle(list()).flexGrow).toBe('0')
    again(null)
    expect(screen.queryByLabelText('Reading pane')).toBeNull()
    expect(getComputedStyle(list()).flexGrow).toBe('1')
  })

  it('offers resize handles between rail | list | reading on desktop, list | reading on medium, none on phones', () => {
    const shell = (mode: 'desktop' | 'medium' | 'phone', reading: React.ReactNode) => (
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <MailShell mode={mode} {...baseProps} reading={reading} readingOpen={Boolean(reading)} />
      </HubThemeProvider>
    )
    const handles = () => screen.queryAllByRole('separator').map((h) => h.getAttribute('aria-label'))
    const { rerender } = render(shell('desktop', <div>the message</div>))
    expect(handles()).toEqual(['Resize the mailboxes column', 'Resize the message list'])
    // Nothing open: the list is full width, only the rail resizes.
    rerender(shell('desktop', null))
    expect(handles()).toEqual(['Resize the mailboxes column'])
    rerender(shell('medium', <div>the message</div>))
    expect(handles()).toEqual(['Resize the message list'])
    rerender(shell('phone', <div>the message</div>))
    expect(handles()).toEqual([])
    rerender(shell('phone', null))
    expect(handles()).toEqual([])
  })

  it('restores the saved widths of the account and saves keyboard resizes', () => {
    window.localStorage.setItem(paneWidthsKey('QAlice'), JSON.stringify({ rail: 300, list: 420 }))
    wrap(<MailShell mode="desktop" {...baseProps} readingOpen paneWidthsAccount="QAlice" />)
    const rail = screen.getByRole('separator', { name: 'Resize the mailboxes column' })
    const list = screen.getByRole('separator', { name: 'Resize the message list' })
    expect(screen.getByLabelText('Mailboxes').style.width).toBe('300px')
    expect(screen.getByLabelText('Messages').style.width).toBe('420px')
    expect(rail.getAttribute('aria-valuenow')).toBe('300')
    expect(rail.getAttribute('aria-valuemin')).toBe('180')
    expect(rail.getAttribute('aria-valuemax')).toBe('360')
    expect(list.getAttribute('aria-valuemin')).toBe('260')
    expect(list.getAttribute('aria-controls')).toBe(screen.getByLabelText('Messages').id)

    fireEvent.keyDown(list, { key: 'ArrowRight', shiftKey: true })
    expect(screen.getByLabelText('Messages').style.width).toBe('484px')
    expect(readPaneWidths('QAlice')).toEqual({ rail: 300, list: 484 })
    fireEvent.keyDown(rail, { key: 'ArrowRight', shiftKey: true })
    expect(screen.getByLabelText('Mailboxes').style.width).toBe('360px')
    // Home: back to the default, and forgotten.
    fireEvent.keyDown(rail, { key: 'Home' })
    expect(screen.getByLabelText('Mailboxes').style.width).toBe(`${RAIL_WIDTH}px`)
    expect(readPaneWidths('QAlice')).toEqual({ list: 484 })
  })

  it('uses the default widths when nothing is saved', () => {
    wrap(<MailShell mode="desktop" {...baseProps} readingOpen paneWidthsAccount="QBob" />)
    expect(screen.getByLabelText('Mailboxes').style.width).toBe(`${RAIL_WIDTH}px`)
    expect(screen.getByLabelText('Messages').style.width).toBe(`${LIST_WIDTH_DESKTOP}px`)
  })

  it('makes the list pane a size container, so rows can lay out as columns when it is wide', () => {
    wrap(<MailShell mode="desktop" {...baseProps} reading={null} />)
    const css = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n')
    expect(css).toMatch(new RegExp(`container-name:${LIST_CONTAINER}`))
    expect(css).toMatch(/container-type:inline-size/)
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

describe('Rail and BottomNav badges', () => {
  it('shows numeric badges as counts with 99+, keeps text badges, and never a badge on Threads', () => {
    expect(badgeFor('5')).toEqual({ kind: 'count', value: 5 })
    expect(badgeFor('0')).toBeNull()
    expect(badgeFor('!')).toEqual({ kind: 'text', value: '!' })
    expect(badgeFor(undefined)).toBeNull()
    const items = [
      { id: 'inbox', label: 'Inbox', badgeText: '120' },
      { id: 'inbox-instance:alice', label: 'alice', badgeText: '3' },
      { id: 'threads', label: 'Q-Mail Threads', badgeText: '+' },
      { id: 'threads-group:7', label: 'Devs', badgeText: '2' },
    ]
    wrap(<Rail items={items} activeItemId="inbox" onSelect={() => {}} onOpenSettings={() => {}} version="1.0.0" />)
    expect(screen.getByRole('button', { name: 'Inbox, 120 unread' })).toBeTruthy()
    expect(screen.getByText('99+')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'alice, 3 unread' })).toBeTruthy()
    const threads = screen.getByRole('button', { name: 'Threads' })
    expect(threads.getAttribute('aria-expanded')).toBe('false')
    expect(threads.textContent).not.toContain('+')
    // Collapsed: the group child is hidden from the rail by Mail.tsx (hidden flag); here it is listed with its count.
    expect(screen.getByRole('button', { name: 'Devs, 2 unread' })).toBeTruthy()
  })

  it('closes the drawer after any selection', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const onOpenSettings = vi.fn()
    const items = [
      { id: 'compose', label: 'Compose' },
      { id: 'inbox', label: 'Inbox' },
      { id: 'inbox-instance:bob', label: 'bob' },
    ]
    wrap(<Rail items={items} activeItemId="inbox" onSelect={onSelect} onOpenSettings={onOpenSettings} version="1.0.0" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'bob' }))
    expect(onSelect).toHaveBeenCalledWith('inbox-instance:bob')
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('bottom nav badges read as counts and cap at 99+', () => {
    const items = [
      { id: 'inbox', label: 'Inbox', icon: <InboxOutlinedIcon />, badge: 250 },
      { id: 'threads', label: 'Threads', icon: <InboxOutlinedIcon />, badge: 4 },
      { id: 'sent', label: 'Sent', icon: <InboxOutlinedIcon /> },
    ]
    wrap(<BottomNav items={items} activeId="inbox" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Inbox, 250 unread' })).toBeTruthy()
    expect(screen.getByText('99+')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Threads, 4 unread' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sent' })).toBeTruthy()
    expect(badgeLabel({ id: 'x', label: 'X', icon: null, badge: '7' })).toBe('X, 7 unread')
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
