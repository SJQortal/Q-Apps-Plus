import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { addUser } from '../../state/features/authSlice'
import { addToHashMapMail, clearMessages } from '../../state/features/mailSlice'
import { resetAvatarCache } from '../../utils/avatarCache'
import { resetNameCache } from '../../utils/nameCache'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetEarlierMessagesCache } from './earlierMessages'
import { ShowMessageV2 } from './ShowMessageV2'
import { escapeHtmlText, exactMailDate, readerMailDate } from './readerTime'
import { mailDateTime } from './MessageDate'

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
  it('formats exact reader dates and escapes HTML', () => {
    expect(readerMailDate(now - 5 * 60_000, now)).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}$/)
    expect(readerMailDate(now - 400 * 24 * 3600_000, now)).toMatch(/ \d{4}, \d{2}:\d{2}$/)
    expect(readerMailDate(undefined)).toBe('')
    expect(escapeHtmlText('<b>&"x"')).toBe('&lt;b&gt;&amp;&quot;x&quot;')
  })

  it('gives <time> a machine-readable datetime, and none for a bad timestamp', () => {
    expect(mailDateTime(1700000000000)).toBe('2023-11-14T22:13:20.000Z')
    expect(mailDateTime('1700000000000')).toBe('2023-11-14T22:13:20.000Z')
    expect(mailDateTime(undefined)).toBeUndefined()
    expect(mailDateTime('soon')).toBeUndefined()
    expect(mailDateTime(0)).toBeUndefined()
    expect(mailDateTime(1e20)).toBeUndefined()
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
    expect(screen.getByText('alice', { selector: 'p' })).toBeTruthy()
    expect(screen.getByText('to bob')).toBeTruthy()
    // One h1 per view (the PaneHeader's): the subject is the pane's h2, the only heading here.
    expect(screen.queryAllByRole('heading', { level: 1 })).toHaveLength(0)
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Lunch <plan>'])
    expect(screen.getByRole('heading', { level: 2, name: 'Lunch <plan>' })).toBeTruthy()
    const shortDate = readerMailDate(message.createdAt)
    expect(screen.getByText(shortDate)).toBeTruthy()
    expect(screen.getByText(shortDate).closest('time')?.getAttribute('datetime')).toBe(new Date(message.createdAt).toISOString())
    expect(screen.getByRole('button', { name: `Sent ${shortDate}. Show the full date` })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(setReplyTo).toHaveBeenCalledWith(message)
    fireEvent.click(screen.getByRole('button', { name: 'Reply all' }))
    expect(onReplyAll).toHaveBeenCalledWith(message)
    expect(screen.getByRole('button', { name: 'Save all (2)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close message' })).toBeTruthy()
    // the date toggles to the full form, with seconds, on tap
    fireEvent.click(screen.getByText(shortDate))
    expect(screen.getByText(exactMailDate(message.createdAt))).toBeTruthy()
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
    // Entries come from the sender's body: quoted, never styled as the viewer's own.
    expect(screen.queryByText('You')).toBeNull()
    expect(screen.getAllByText(/^Quoted by /)).toHaveLength(2)
    // the newest earlier message is open by default, the older one collapsed
    expect(screen.getByText('second')).toBeTruthy()
    expect(screen.queryByText('first')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expand message from alice' }))
    expect(screen.getByText('first')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide earlier' }))
    expect(screen.queryByText('second')).toBeNull()
  })

  it('offers Archive and Mark unread as labelled buttons in a wide pane, with the e / u shortcuts', () => {
    const onArchive = vi.fn()
    const onMarkUnread = vi.fn()
    wrap(<ShowMessageV2 message={message} onArchive={onArchive} onMarkUnread={onMarkUnread} />)
    const archive = screen.getByRole('button', { name: 'Archive' })
    const unread = screen.getByRole('button', { name: 'Mark unread' })
    expect(archive.textContent).toBe('Archive')
    expect(archive.getAttribute('aria-keyshortcuts')).toBe('e')
    expect(unread.getAttribute('aria-keyshortcuts')).toBe('u')
    fireEvent.click(archive)
    expect(onArchive).toHaveBeenCalledWith(message)
    fireEvent.click(unread)
    expect(onMarkUnread).toHaveBeenCalledWith(message)
  })

  it('reads "Move to inbox" for an archived message and hides both actions when not offered', () => {
    const onArchive = vi.fn()
    const { unmount } = wrap(<ShowMessageV2 message={message} onArchive={onArchive} archived />)
    fireEvent.click(screen.getByRole('button', { name: 'Move to inbox' }))
    expect(onArchive).toHaveBeenCalledWith(message)
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    unmount()
    wrap(<ShowMessageV2 message={message} />)
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Move to inbox' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Mark unread' })).toBeNull()
  })

  it('uses 44 px icon buttons with aria-labels in a phone-width pane', () => {
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
    try {
      const onArchive = vi.fn()
      wrap(<ShowMessageV2 message={message} onArchive={onArchive} onMarkUnread={vi.fn()} />)
      const archive = screen.getByRole('button', { name: 'Archive' })
      expect(archive.textContent).toBe('')
      expect(archive.getAttribute('aria-keyshortcuts')).toBe('e')
      expect(getComputedStyle(archive).minWidth).toBe('44px')
      expect(getComputedStyle(archive).minHeight).toBe('44px')
      expect(screen.getByRole('button', { name: 'Mark unread' }).textContent).toBe('')
      fireEvent.click(archive)
      expect(onArchive).toHaveBeenCalledWith(message)
    } finally {
      width.mockRestore()
    }
  })

  it('renders the body with images constrained to the pane width', () => {
    wrap(<ShowMessageV2 message={message} />)
    const img = document.querySelector('.ql-editor-display img') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(getComputedStyle(img).maxWidth).toBe('100%')
  })
})

describe('ShowMessageV2 earlier messages by reference (1.0.1 replies)', () => {
  const mailJson = (subject: string, createdAt: number) =>
    btoa(JSON.stringify({ subject, createdAt, version: 1, attachments: [], textContentV2: `<p>${subject} body</p>`, generalData: { thread: [], threadV2: [] } }))
  const reply = (count: number) => ({
    id: 'reply',
    user: 'alice',
    recipient: 'bob',
    subject: 'Re: Plan',
    createdAt: now,
    textContentV2: '<p>latest</p>',
    attachments: [],
    generalData: {
      thread: [],
      threadV2: Array.from({ length: count }, (_, i) => ({
        reference: { identifier: `m${i}`, name: i % 2 ? 'bob' : 'alice', service: 'MAIL_PRIVATE' },
      })),
    },
  })

  beforeEach(() => {
    resetAvatarCache()
    resetNameCache()
    resetEarlierMessagesCache()
    store.dispatch(clearMessages())
    store.dispatch(addUser({ name: 'bob', address: 'Qbob' } as any))
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ owner: `Q${request.name}` }))
    mockQortalAction('GET_ACCOUNT_DATA', { publicKey: 'PK' })
    mockQortalAction('GET_QDN_RESOURCE_URL', '')
    mockQortalAction('FETCH_QDN_RESOURCE', (request: any) => (request.identifier === 'm2' ? 'D' : `ENC:${request.identifier}`))
    mockQortalAction('DECRYPT_DATA', (request: any) => {
      const id = String(request.encryptedData).slice(4)
      if (id === 'm1') throw new Error('Unable to decrypt')
      return mailJson(`Message ${id}`, 1000 + Number(id.slice(1)))
    })
  })

  it('fetches nothing until Show earlier, then the newest five, verified, with the newest open', async () => {
    wrap(<ShowMessageV2 message={reply(7)} />)
    expect(screen.getByRole('button', { name: 'Show earlier · 7 messages' })).toBeTruthy()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 7 messages' }))
    expect(await screen.findByText('Message m6 body')).toBeTruthy()
    await screen.findByRole('article', { name: 'alice: Message m4' })
    expect(qortalCalls('FETCH_QDN_RESOURCE').map(request => request.identifier).sort()).toEqual(['m2', 'm3', 'm4', 'm5', 'm6'])
    expect(qortalCalls('ENCRYPT_DATA')).toHaveLength(0)
    // fetched under the publisher's name: no "Quoted by" note
    expect(screen.queryByText(/^Quoted by /)).toBeNull()
    expect(screen.getByText('The sender deleted this message.')).toBeTruthy()
    expect(screen.queryByText('Message m5 body')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 older · 2 more' }))
    expect(await screen.findByText('This message was not sent to you, so it can\'t be opened.')).toBeTruthy()
    await screen.findByRole('article', { name: 'alice: Message m0' })
    expect(screen.queryByRole('button', { name: /older/ })).toBeNull()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(7)
  })

  it('uses a message already decrypted this session without asking Qortal', async () => {
    store.dispatch(addToHashMapMail({ id: 'm0', user: 'alice', isValid: true, subject: 'Opened before', createdAt: 5, textContentV2: '<p>cached</p>', attachments: [] }))
    wrap(<ShowMessageV2 message={reply(1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 1 message' }))
    expect(await screen.findByText('cached')).toBeTruthy()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
  })

  it('offers Retry when the node has not got a message yet', async () => {
    let available = false
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      if (!available) throw new Error('Unable to decrypt: some other failure')
      return 'ENC:m0'
    })
    wrap(<ShowMessageV2 message={reply(1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 1 message' }))
    expect(await screen.findByText('This message could not be loaded.')).toBeTruthy()
    available = true
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Message m0 body')).toBeTruthy()
  })
})
