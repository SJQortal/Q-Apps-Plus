import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
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
import { ShowMessageV2, olderLabel } from './ShowMessageV2'
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

  it('names the To of the send on every copy, not the copy\'s own recipient', () => {
    // The copy delivered to a Cc name: recipient is that name, to is the To.
    wrap(<ShowMessageV2 message={{ ...message, recipient: 'dana', to: ['bob'], cc: ['dana'] }} />)
    expect(screen.getByText('to bob')).toBeTruthy()
    expect(screen.getByText((_, el) => el?.textContent === 'cc dana' && el.tagName === 'P')).toBeTruthy()
  })

  it('shows a crafted message with an object subject and recipient and an impossible date', () => {
    wrap(<ShowMessageV2 message={{ ...message, subject: { a: 1 }, recipient: { b: 2 }, to: [{ c: 3 }], createdAt: 1e16, generalData: { thread: [], threadV2: [] } }} />)
    expect(screen.getByRole('heading', { level: 2, name: '(no subject)' })).toBeTruthy()
    expect(screen.queryByText(/^to /)).toBeNull()
    expect(document.querySelector('time')).toBeNull()
    expect(screen.getByText('noon')).toBeTruthy()
  })

  it('folds a long Cc list into "and N more", which shows every name', () => {
    const cc = ['carl', 'dana', 'erin', 'fay', 'gus', 'Custom Node on Qortal Hub']
    const ccLine = () => screen.getByText((_, el) => el?.tagName === 'P' && /^cc /.test(el.textContent || ''))
    const { unmount } = wrap(<ShowMessageV2 message={{ ...message, cc }} />)
    expect(ccLine().textContent).toBe('cc carl, dana, erin and 3 more Cc names')
    fireEvent.click(screen.getByRole('button', { name: 'and 3 more Cc names' }))
    expect(ccLine().textContent).toBe(`cc ${cc.join(', ')}`)
    expect(screen.queryByRole('button', { name: /Cc names/ })).toBeNull()
    // Focus moved to the line the button left.
    expect(document.activeElement).toBe(ccLine())
    unmount()
    // Four names are all shown: "and 1 more" would save nothing.
    wrap(<ShowMessageV2 message={{ ...message, cc: cc.slice(0, 4) }} />)
    expect(ccLine().textContent).toBe('cc carl, dana, erin, fay')
  })

  it('shows the Cc names under the recipient, and no Cc line without them', () => {
    const { unmount } = wrap(<ShowMessageV2 message={{ ...message, cc: ['carl', 'dana', 'carl', 7, ''] }} />)
    expect(screen.getByText((_, el) => el?.textContent === 'cc carl, dana' && el.tagName === 'P')).toBeTruthy()
    unmount()
    wrap(<ShowMessageV2 message={message} />)
    expect(screen.queryByText(/^cc /)).toBeNull()
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

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 older messages' }))
    expect(await screen.findByText('This message was not sent to you, so it can\'t be opened.')).toBeTruthy()
    await screen.findByRole('article', { name: 'alice: Message m0' })
    expect(screen.queryByRole('button', { name: /older/ })).toBeNull()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(7)
  })

  it('walks back through the earlier messages\' own links to the start of the conversation', async () => {
    // The open reply links m5..m9 (a 1.0.1 reply links its newest ten); m5 linked m0..m4.
    const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `m${from + i}`)
    const refOf = (id: string) => ({ reference: { identifier: id, name: 'alice', service: 'MAIL_PRIVATE' } })
    mockQortalAction('FETCH_QDN_RESOURCE', (request: any) => `ENC:${request.identifier}`)
    mockQortalAction('DECRYPT_DATA', (request: any) => {
      const id = String(request.encryptedData).slice(4)
      const n = Number(id.slice(1))
      return btoa(JSON.stringify({
        subject: `Message ${id}`,
        createdAt: 1000 + n,
        version: 1,
        attachments: [],
        textContentV2: `<p>Message ${id} body</p>`,
        generalData: { thread: [], threadV2: id === 'm5' ? ids(0, 4).map(refOf) : [] },
      }))
    })
    const message = { ...reply(0), generalData: { thread: [], threadV2: ids(5, 9).map(refOf) } }
    wrap(<ShowMessageV2 message={message} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 5 messages' }))
    expect(await screen.findByText('Message m9 body')).toBeTruthy()
    // m5 arrives and leads further back.
    fireEvent.click(await screen.findByRole('button', { name: 'Show 5 older messages' }))
    await screen.findByRole('article', { name: 'alice: Message m0' })
    const order = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label')).filter((label) => /^alice: Message m\d$/.test(label || ''))
    expect(order).toEqual(ids(0, 9).map((id) => `alice: Message ${id}`))
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(10)
    expect(screen.queryByRole('button', { name: /older message/ })).toBeNull()
  })

  it('closes Show earlier for the next message without fetching its history', async () => {
    const refOf = (id: string) => ({ reference: { identifier: id, name: 'alice', service: 'MAIL_PRIVATE' } })
    const withRefs = (id: string, refs: string[]) => ({ ...reply(0), id, generalData: { thread: [], threadV2: refs.map(refOf) } })
    const { rerender } = wrap(<ShowMessageV2 message={withRefs('A', ['m3', 'm4'])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 2 messages' }))
    expect(await screen.findByText('Message m4 body')).toBeTruthy()
    await screen.findByRole('article', { name: 'alice: Message m3' })
    // The reader is reused for the next message (Mail.tsx gives it no key).
    rerender(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <ShowMessageV2 message={withRefs('B', ['m5', 'm6', 'm0'])} />
        </HubThemeProvider>
      </Provider>
    )
    expect(screen.getByRole('button', { name: 'Show earlier · 3 messages' }).getAttribute('aria-expanded')).toBe('false')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(qortalCalls('FETCH_QDN_RESOURCE').map((request) => request.identifier).sort()).toEqual(['m3', 'm4'])
  })

  it('names who quoted a copy found by walking back: the earlier message\'s sender, not the open one\'s', async () => {
    // carol's open reply links erin's m2; erin's m2 (fetched) embedded dave's m1.
    mockQortalAction('FETCH_QDN_RESOURCE', (request: any) => `ENC:${request.identifier}`)
    mockQortalAction('DECRYPT_DATA', () =>
      btoa(JSON.stringify({
        subject: 'Message m2',
        createdAt: 2000,
        version: 1,
        attachments: [],
        textContentV2: '<p>Message m2 body</p>',
        generalData: { thread: [], threadV2: [{ reference: { identifier: 'm1', name: 'dave', service: 'MAIL_PRIVATE' }, data: { id: 'm1', user: 'dave', subject: 'Message m1', createdAt: 1000, textContentV2: '<p>first</p>' } }] },
      }))
    )
    const open = { ...reply(0), user: 'carol', generalData: { thread: [], threadV2: [{ reference: { identifier: 'm2', name: 'erin', service: 'MAIL_PRIVATE' } }] } }
    wrap(<ShowMessageV2 message={open} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 1 message' }))
    expect(await screen.findByText('Message m2 body')).toBeTruthy()
    const m1 = await screen.findByRole('article', { name: 'dave: Message m1' })
    expect(m1.getAttribute('aria-description')).toBe('Quoted by erin, not verified')
    expect(screen.queryByText(/Quoted by carol/)).toBeNull()
  })

  it('on the way back to a message, a failed earlier message can load again', async () => {
    let up = false
    mockQortalAction('FETCH_QDN_RESOURCE', (request: any) => {
      if (request.identifier === 'm0' && !up) throw new Error('Unable to decrypt: some other failure')
      return `ENC:${request.identifier}`
    })
    const refOf = (id: string) => ({ reference: { identifier: id, name: 'alice', service: 'MAIL_PRIVATE' } })
    const withRefs = (id: string, refs: string[]) => ({ ...reply(0), id, generalData: { thread: [], threadV2: refs.map(refOf) } })
    const reader = (message: any) => (
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <ShowMessageV2 message={message} />
        </HubThemeProvider>
      </Provider>
    )
    const a = withRefs('A', ['m0', 'm3'])
    const { rerender } = render(reader(a))
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 2 messages' }))
    expect(await screen.findByText('This message could not be loaded.')).toBeTruthy()
    rerender(reader(withRefs('B', ['m4'])))
    up = true
    rerender(reader(a))
    // Closed again on the way back, and opening it fetches the failed one anew.
    const show = screen.getByRole('button', { name: 'Show earlier · 2 messages' })
    expect(show.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(show)
    expect(await screen.findByRole('article', { name: 'alice: Message m0' })).toBeTruthy()
    expect(screen.queryByText('Loading message')).toBeNull()
  })

  it('words the Show older button by what is left', () => {
    expect(olderLabel(1)).toBe('Show 1 older message')
    expect(olderLabel(5)).toBe('Show 5 older messages')
    expect(olderLabel(12)).toBe('Show 5 older messages (12 left)')
  })

  it('does not re-render the reader when other messages are decrypted', async () => {
    let commits = 0
    const message = reply(1)
    wrap(
      <Profiler id="reader" onRender={() => { commits += 1 }}>
        <ShowMessageV2 message={message} />
      </Profiler>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 1 message' }))
    await screen.findByText('Message m0 body')
    const before = commits
    act(() => {
      store.dispatch(addToHashMapMail({ id: 'unrelated', user: 'carol', isValid: true, subject: 'x', createdAt: 1 }))
    })
    expect(commits).toBe(before)
  })

  it('uses a message already decrypted this session without asking Qortal', async () => {
    store.dispatch(addToHashMapMail({ id: 'm0', user: 'alice', isValid: true, subject: 'Opened before', createdAt: 5, textContentV2: '<p>cached</p>', attachments: [] }))
    wrap(<ShowMessageV2 message={reply(1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 1 message' }))
    expect(await screen.findByText('cached')).toBeTruthy()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
  })

  it('shows a crafted earlier message (object subject, impossible date) without taking the reader down', async () => {
    mockQortalAction('DECRYPT_DATA', () =>
      btoa(JSON.stringify({ subject: { a: 1 }, createdAt: 1e16, version: 1, attachments: [], textContentV2: '<p>odd body</p>', generalData: { thread: [], threadV2: [] } }))
    )
    wrap(<ShowMessageV2 message={reply(1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 1 message' }))
    expect(await screen.findByText('odd body')).toBeTruthy()
    expect(screen.getByRole('article', { name: 'alice: (no subject)' })).toBeTruthy()
    expect(screen.getByText('latest')).toBeTruthy()
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
    // Focus stayed with the message's place while Retry went away.
    const focused = document.activeElement as HTMLElement
    expect(focused.hasAttribute('data-earlier-item')).toBe(true)
    expect(focused.textContent).toContain('Message m0 body')
  })

  it('moves focus to the oldest message when Show older goes away', async () => {
    wrap(<ShowMessageV2 message={reply(7)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 7 messages' }))
    const older = await screen.findByRole('button', { name: 'Show 2 older messages' })
    older.focus()
    fireEvent.click(older)
    await screen.findByRole('article', { name: 'alice: Message m0' })
    expect(screen.queryByRole('button', { name: /older message/ })).toBeNull()
    const focused = document.activeElement as HTMLElement
    expect(focused.hasAttribute('data-earlier-item')).toBe(true)
    expect(focused.querySelector('[role="article"], article')?.getAttribute('aria-label')).toBe('alice: Message m0')
  })
})
