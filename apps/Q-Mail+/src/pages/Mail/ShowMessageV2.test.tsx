import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { addUser } from '../../state/features/authSlice'
import { resetAvatarCache } from '../../utils/avatarCache'
import { ShowMessageV2 } from './ShowMessageV2'
import { escapeHtmlText, relativeMailDate } from './readerTime'

const now = Date.now()
const message = {
  id: 'msg1',
  user: 'alice',
  recipient: 'bob',
  subject: 'Lunch <plan>',
  createdAt: now - 5 * 60 * 1000,
  textContentV2: '<p>See you at <b>noon</b></p><img src="x.png">',
  attachments: [
    { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'a1', originalFilename: 'menu.pdf', type: 'application/pdf', size: 1000 },
    { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'a2', originalFilename: 'map.png', type: 'image/png', size: 2000 },
  ],
  generalData: {
    thread: [],
    threadV2: [
      { reference: { identifier: 'r2', name: 'bob', service: 'MAIL_PRIVATE' }, data: { id: 'r2', user: 'bob', subject: 'Re: Lunch', createdAt: now - 3600_000, textContentV2: '<p>second</p>' } },
      { reference: { identifier: 'r1', name: 'alice', service: 'MAIL_PRIVATE' }, data: { id: 'r1', user: 'alice', subject: 'Lunch', createdAt: now - 7200_000, textContentV2: '<p>first</p>' } },
      { reference: { identifier: 'msg1', name: 'bob', service: 'MAIL_PRIVATE' }, data: { markedAsReadLocally: true, createdAt: now } },
    ],
  },
}

function wrap(ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

describe('readerTime', () => {
  it('formats relative dates and escapes HTML', () => {
    expect(relativeMailDate(now - 10_000, now)).toBe('Just now')
    expect(relativeMailDate(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(relativeMailDate(now - 400 * 24 * 3600_000, now)).toMatch(/\d{4}$/)
    expect(relativeMailDate(undefined)).toBe('')
    expect(escapeHtmlText('<b>&"x"')).toBe('&lt;b&gt;&amp;&quot;x&quot;')
  })
})

describe('ShowMessageV2', () => {
  beforeEach(() => {
    resetAvatarCache()
    store.dispatch(addUser({ name: 'bob', address: 'Qbob' } as any))
  })

  it('shows sender, recipient (Bugs #17), subject, relative date and real action buttons', () => {
    const setReplyTo = vi.fn()
    const onReplyAll = vi.fn()
    wrap(<ShowMessageV2 message={message} setReplyTo={setReplyTo} setForwardInfo={vi.fn()} onReplyAll={onReplyAll} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { level: 2, name: 'alice' })).toBeTruthy()
    expect(screen.getByText('to bob')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Lunch <plan>' })).toBeTruthy()
    expect(screen.getByText('5 min ago')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(setReplyTo).toHaveBeenCalledWith(message)
    fireEvent.click(screen.getByRole('button', { name: 'Reply all' }))
    expect(onReplyAll).toHaveBeenCalledWith(message)
    expect(screen.getByRole('button', { name: 'Save all (2)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close message' })).toBeTruthy()
    // the date toggles to the exact form on tap
    fireEvent.click(screen.getByText('5 min ago'))
    expect(screen.getByText(/\d{4}, \d{2}:\d{2}:\d{2}$/)).toBeTruthy()
  })

  it('escapes the forward header and hands attachments to onForward when given', () => {
    const setForwardInfo = vi.fn()
    const { unmount } = wrap(<ShowMessageV2 message={message} setForwardInfo={setForwardInfo} />)
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))
    expect(setForwardInfo).toHaveBeenCalledTimes(1)
    const html = setForwardInfo.mock.calls[0][0] as string
    expect(html).toContain('Subject: Lunch &lt;plan&gt;')
    expect(html).toContain('<b>noon</b>')
    unmount()
    const onForward = vi.fn()
    wrap(<ShowMessageV2 message={message} setForwardInfo={setForwardInfo} onForward={onForward} />)
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))
    expect(onForward).toHaveBeenCalledTimes(1)
    expect(onForward.mock.calls[0][0].attachments).toHaveLength(2)
    expect(onForward.mock.calls[0][0].subject).toBe('Lunch <plan>')
    expect(setForwardInfo).toHaveBeenCalledTimes(1)
  })

  it('collapses earlier messages with a count, ignoring the local read marker, and expands in order', () => {
    wrap(<ShowMessageV2 message={message} />)
    const toggle = screen.getByRole('button', { name: /Show earlier · 2 messages/ })
    expect(screen.queryByText('Re: Lunch')).toBeNull()
    fireEvent.click(toggle)
    const articles = screen.getAllByRole('article', { name: /Lunch/ }).filter((a) => a.getAttribute('aria-label') !== 'Lunch <plan>')
    expect(articles.map((a) => a.getAttribute('aria-label'))).toEqual(['alice: Lunch', 'bob: Re: Lunch'])
    expect(screen.getByText('You')).toBeTruthy()
    // the newest earlier message is open by default, the older one collapsed
    expect(screen.getByText('second')).toBeTruthy()
    expect(screen.queryByText('first')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expand message from alice' }))
    expect(screen.getByText('first')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide earlier' }))
    expect(screen.queryByText('second')).toBeNull()
  })

  it('renders the body with images constrained to the pane width', () => {
    wrap(<ShowMessageV2 message={message} />)
    const img = document.querySelector('.ql-editor-display img') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(getComputedStyle(img).maxWidth).toBe('100%')
  })
})
