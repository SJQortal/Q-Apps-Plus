import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { Provider, useSelector } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import authReducer from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer, { addToHashMapMail } from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetSubjectCache } from '../../utils/subjectCache'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { useModal } from '../../components/common/useModal'
import { GroupedMailboxList } from './GroupedMailboxList'
import { OpenMail } from './OpenMail'
import { createOpenMessage, isPendingSelection, pendingSelectionFor, readingViewFor } from './messageOpener'

const idA = '_mail_qortal_qmail_alice_abc123_mail_a1'
const idB = '_mail_qortal_qmail_alice_abc123_mail_b1'
const idC = '_mail_qortal_qmail_alice_abc123_mail_c1'
const rows = [
  { id: idA, user: 'mugician', createdAt: 3_000 },
  { id: idB, user: 'muratt', createdAt: 2_000 },
  { id: idC, user: 'joe', createdAt: 1_000 },
]

const mailJson = (subject: string) => ({
  subject,
  createdAt: 1700000000000,
  version: 1,
  attachments: [],
  textContentV2: '<p>hello</p>',
  generalData: { thread: [], threadV2: [] },
  recipient: 'alice',
})

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  // No signed-in name: the reader then skips saving an encrypted subject copy.
  return store
}

/** Mail.tsx's open flow in miniature: the same modal hook, opener, list and pane choice. */
function MiniMail({ markRead }: { markRead: (rows: any[]) => void }) {
  const { isShow, onOk, show } = useModal()
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState<any>(null)
  const [mailInfo, setMailInfo] = useState<any>(null)
  const hash = useSelector((state: any) => state.mail.hashMapMailMessages)
  const requestRef = useRef(0)
  const cancelRef = useRef<() => void>(() => undefined)
  cancelRef.current = () => {
    requestRef.current += 1
    if (isShow) onOk(undefined)
    setMailInfo(null)
  }
  const openMessage = createOpenMessage({
    cached: (id) => hash[id],
    cancelPending: () => cancelRef.current(),
    requestRef,
    setMessage,
    setIsOpen,
    setMailInfo,
    show,
    markRead,
    autoMarkReadByDefault: true,
  })
  const view = readingViewFor({ isOpeningMessage: Boolean(mailInfo) && isShow, isReadingOpen: Boolean(isOpen && message) })
  return (
    <>
      <GroupedMailboxList
        messages={rows}
        mailboxType="inbox"
        openMessage={openMessage}
        openedMessageId={message?.id || message?.identifier}
      />
      <section aria-label="Reading pane">
        {view === 'opening' ? (
          <OpenMail open={isShow} handleClose={onOk} fileInfo={mailInfo} />
        ) : view === 'message' ? (
          <h2>{message.subject}</h2>
        ) : null}
      </section>
    </>
  )
}

const tick = async (ms: number) => {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const rowButton = (id: string) =>
  document.querySelector(`[data-message-row="${id}"] button`) as HTMLButtonElement
const currentRow = () =>
  document.querySelector('[aria-current="true"]')?.closest('[data-message-row]')?.getAttribute('data-message-row') ?? null
const pane = () => screen.getByRole('region', { name: 'Reading pane' })

describe('messageOpener', () => {
  let store: ReturnType<typeof makeStore>
  // Per message: what Core says about its resource.
  let statusOf: Record<string, string>

  beforeEach(() => {
    vi.useFakeTimers()
    resetSubjectCache()
    resetAttachmentCache()
    store = makeStore()
    store.dispatch(addToHashMapMail({ ...mailJson('Hello from A'), id: idA, user: 'mugician', isValid: true }))
    statusOf = { [idB]: 'READY', [idC]: 'READY' }
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
    mockQortalAction('GET_NAME_DATA', (req: any) => ({ name: req.name, owner: `Q${req.name}` }))
    mockQortalAction('GET_ACCOUNT_DATA', { publicKey: 'PKsender' })
    mockQortalAction('GET_QDN_RESOURCE_STATUS', (req: any) => ({ status: statusOf[req.identifier] || 'MISSING_DATA' }))
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    mockQortalAction('FETCH_QDN_RESOURCE', (req: any) => `ENC:${req.identifier}`)
    mockQortalAction('DECRYPT_DATA', (req: any) =>
      btoa(JSON.stringify(mailJson(req.encryptedData === `ENC:${idB}` ? 'Hello from B' : 'Hello from C')))
    )
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function renderMail(markRead = vi.fn()) {
    render(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <MiniMail markRead={markRead} />
        </HubThemeProvider>
      </Provider>
    )
    return markRead
  }

  it('the opener takes the pane over a shown message', () => {
    expect(readingViewFor({ isOpeningMessage: true, isReadingOpen: true })).toBe('opening')
    expect(readingViewFor({ isOpeningMessage: false, isReadingOpen: true })).toBe('message')
    expect(readingViewFor({ isOpeningMessage: false, isReadingOpen: false })).toBeNull()
    expect(isPendingSelection(pendingSelectionFor(idB, 'muratt'))).toBe(true)
    expect(isPendingSelection({ id: idB, isValid: true })).toBe(false)
  })

  it('opens A, then a click on B (not decrypted yet) switches to B', async () => {
    const markRead = renderMail()
    await act(async () => {
      fireEvent.click(rowButton(idA))
    })
    expect(pane().textContent).toContain('Hello from A')
    expect(currentRow()).toBe(idA)

    // Synchronously: the opener replaces A and the highlight moves to B.
    fireEvent.click(rowButton(idB))
    expect(pane().textContent).not.toContain('Hello from A')
    expect(screen.getByRole('region', { name: 'Opening message' })).toBeTruthy()
    expect(currentRow()).toBe(idB)
    await tick(0)
    await tick(0)
    expect(qortalCalls('GET_QDN_RESOURCE_STATUS').some((r) => r.identifier === idB)).toBe(true)
    expect(pane().textContent).toContain('Hello from B')
    expect(currentRow()).toBe(idB)
    expect(markRead).toHaveBeenLastCalledWith([{ id: idB, identifier: idB, user: 'muratt' }])

    // And back to A (cached), then on to C (not decrypted).
    await act(async () => {
      fireEvent.click(rowButton(idA))
    })
    expect(pane().textContent).toContain('Hello from A')
    await act(async () => {
      fireEvent.click(rowButton(idC))
    })
    await tick(0)
    await tick(0)
    expect(pane().textContent).toContain('Hello from C')
    expect(currentRow()).toBe(idC)
  })

  it('a click on B while A is still opening shows B, and A never comes back', async () => {
    statusOf = { [idB]: 'DOWNLOADING', [idC]: 'READY' }
    renderMail()
    await act(async () => {
      fireEvent.click(rowButton(idB))
    })
    await tick(0)
    expect(screen.getByRole('region', { name: 'Opening message' })).toBeTruthy()
    expect(currentRow()).toBe(idB)

    await act(async () => {
      fireEvent.click(rowButton(idC))
    })
    expect(currentRow()).toBe(idC)
    await tick(0)
    await tick(0)
    expect(pane().textContent).toContain('Hello from C')
    // B finishing later changes nothing.
    statusOf[idB] = 'READY'
    await tick(6000)
    await tick(0)
    expect(pane().textContent).toContain('Hello from C')
    expect(currentRow()).toBe(idC)
    expect(qortalCalls('FETCH_QDN_RESOURCE').some((r) => r.identifier === idB)).toBe(false)
  })

  it('Cancel on the opener leaves nothing selected and the pane empty', async () => {
    statusOf = { [idB]: 'DOWNLOADING' }
    renderMail()
    await act(async () => {
      fireEvent.click(rowButton(idA))
    })
    await act(async () => {
      fireEvent.click(rowButton(idB))
    })
    await tick(0)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    expect(pane().textContent).toBe('')
    expect(currentRow()).toBeNull()
  })
})
