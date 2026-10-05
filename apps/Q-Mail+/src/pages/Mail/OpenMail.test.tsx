import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { upsertMessages } from '../../state/features/mailSlice'
import { OpenMail } from './OpenMail'
import { openerInfoFor } from './openerInfo'
import { exactMailDate } from './readerTime'

const fileInfo = { identifier: '_mail_qortal_qmail_bob_abc123_mail_x1', name: 'alice', service: 'MAIL_PRIVATE', to: 'bob' }

const mailJson = { subject: 'Hi', createdAt: 1700000000000, version: 1, attachments: [], textContentV2: '<p>hello</p>', generalData: { thread: [], threadV2: [] }, recipient: 'bob' }

function wrap(ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('OpenMail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    resetAttachmentCache()
    mockQortalAction('GET_NAME_DATA', { owner: 'Qalice' })
    mockQortalAction('GET_ACCOUNT_DATA', { publicKey: 'PKalice' })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for the resource, then resolves the caller with the decrypted message', async () => {
    const answers = [{ status: 'DOWNLOADING', percentLoaded: 40 }, { status: 'READY' }]
    let i = 0
    mockQortalAction('GET_QDN_RESOURCE_STATUS', () => answers[Math.min(i++, answers.length - 1)])
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', (req: Record<string, any>) => (req.publicKey === 'PKalice' ? btoa(JSON.stringify(mailJson)) : null))
    const handleClose = vi.fn()
    wrap(<OpenMail open handleClose={handleClose} fileInfo={fileInfo} />)
    await tick(0)
    expect(screen.getByText(/Fetching from peers… 40%/)).toBeTruthy()
    expect(qortalCalls('GET_QDN_RESOURCE_PROPERTIES')).toHaveLength(1)
    await tick(5600)
    await tick(0)
    expect(handleClose).toHaveBeenCalledTimes(1)
    const res = handleClose.mock.calls[0][0]
    expect(res).toMatchObject({ isValid: true, subject: 'Hi', user: 'alice', id: fileInfo.identifier, recipient: 'bob' })
    expect(qortalCalls('DECRYPT_DATA')[0]).toEqual({ action: 'DECRYPT_DATA', encryptedData: 'ENC', publicKey: 'PKalice' })
    expect(store.getState().mail.hashMapMailMessages[fileInfo.identifier]?.subject).toBe('Hi')
  })

  it('opens a message already on the node in about half a second when Core first says DOWNLOADED', async () => {
    const answers = [{ status: 'DOWNLOADED' }, { status: 'READY' }]
    let i = 0
    mockQortalAction('GET_QDN_RESOURCE_STATUS', () => answers[Math.min(i++, answers.length - 1)])
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(mailJson)))
    const handleClose = vi.fn()
    wrap(<OpenMail open handleClose={handleClose} fileInfo={fileInfo} />)
    await tick(0)
    expect(handleClose).not.toHaveBeenCalled()
    await tick(500)
    await tick(0)
    expect(qortalCalls('GET_QDN_RESOURCE_STATUS')).toHaveLength(2)
    expect(handleClose).toHaveBeenCalledTimes(1)
    expect(handleClose.mock.calls[0][0]).toMatchObject({ isValid: true, subject: 'Hi' })
  })

  it('shows an error with Retry instead of spinning when the fetch throws (Bugs #3), and Cancel resolves with nothing', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    let fail = true
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      if (fail) throw new Error('node down')
      return 'ENC'
    })
    mockQortalAction('DECRYPT_DATA', btoa(JSON.stringify(mailJson)))
    const handleClose = vi.fn()
    wrap(<OpenMail open handleClose={handleClose} fileInfo={fileInfo} />)
    await tick(0)
    await tick(0)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText('The message could not be opened')).toBeTruthy()
    expect(handleClose).not.toHaveBeenCalled()
    fail = false
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    })
    await tick(0)
    await tick(0)
    expect(handleClose).toHaveBeenCalledTimes(1)
    expect(handleClose.mock.calls[0][0]).toMatchObject({ isValid: true })
  })

  it('says when the sender removed the message (a "D" body) and drops it from the inbox list', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', () => btoa('D'))
    store.dispatch(upsertMessages([{ id: fileInfo.identifier, user: 'alice', createdAt: 1 }, { id: 'other', user: 'carol', createdAt: 2 }]))
    const handleClose = vi.fn()
    wrap(<OpenMail open handleClose={handleClose} fileInfo={fileInfo} />)
    await tick(0)
    await tick(0)
    expect(screen.getByText('This message was removed by its sender')).toBeTruthy()
    expect(store.getState().mail.mailMessages.map((m: any) => m.id)).toEqual(['other'])
    expect(store.getState().mail.hashMapMailMessages[fileInfo.identifier]).toMatchObject({ deleted: true })
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(handleClose).toHaveBeenCalledWith()
  })

  it('starts over for the next message instead of keeping the last one\'s outcome', async () => {
    const other = { ...fileInfo, identifier: '_mail_qortal_qmail_bob_abc123_mail_x2' }
    mockQortalAction('GET_QDN_RESOURCE_STATUS', (req: Record<string, any>) =>
      req.identifier === fileInfo.identifier ? { status: 'READY' } : { status: 'MISSING_DATA' }
    )
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    mockQortalAction('FETCH_QDN_RESOURCE', () => btoa('D'))
    const view = wrap(<OpenMail open handleClose={vi.fn()} fileInfo={fileInfo} />)
    await tick(0)
    await tick(0)
    expect(screen.getByText('This message was removed by its sender')).toBeTruthy()
    view.rerender(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <OpenMail open handleClose={vi.fn()} fileInfo={other} />
        </HubThemeProvider>
      </Provider>
    )
    await tick(0)
    expect(screen.queryByText('This message was removed by its sender')).toBeNull()
    expect(screen.getByText(/Not enough peers/)).toBeTruthy()
    await tick(5600)
    await tick(11200)
    await tick(0)
    expect(screen.getByText('Not available on your node right now')).toBeTruthy()
  })

  it('retries the fetch at 2, 4, 8 and 16 s, then shows the row\'s sender and date as not available', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw { error: 1401, message: 'Data unavailable. Please try again later.' }
    })
    const handleClose = vi.fn()
    // Built the way Mail builds it from the clicked row.
    const row = { id: fileInfo.identifier, user: 'alice', createdAt: 1700000000000, title: 'Invoice' }
    const info = openerInfoFor(fileInfo.identifier, 'alice', 'bob', row)
    wrap(<OpenMail open handleClose={handleClose} fileInfo={info} />)
    await tick(0)
    await tick(0)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)
    expect(screen.queryByText('Not available on your node right now')).toBeNull()
    await tick(2000)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(2)
    await tick(4000)
    await tick(8000)
    await tick(16000)
    await tick(0)
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(5)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Not available on your node right now')).toBeTruthy()
    expect(screen.getByText(`From alice · ${exactMailDate(1700000000000)}`)).toBeTruthy()
    expect(screen.getByText('Invoice')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(handleClose).not.toHaveBeenCalled()
  })

  it('calls the message unavailable after three stalled status answers, not a bar that never ends', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'MISSING_DATA' })
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    wrap(<OpenMail open handleClose={vi.fn()} fileInfo={fileInfo} />)
    await tick(0)
    expect(screen.getByText(/Not enough peers/)).toBeTruthy()
    // The poll backs off on a stalled status: 5 s, then 10 s.
    await tick(5600)
    await tick(11200)
    await tick(0)
    expect(screen.getByText('Not available on your node right now')).toBeTruthy()
    expect(qortalCalls('GET_QDN_RESOURCE_STATUS').length).toBeGreaterThanOrEqual(3)
  })

  it('reports an undecryptable message and lets the user cancel', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', () => {
      throw new Error('not for you')
    })
    const handleClose = vi.fn()
    wrap(<OpenMail open handleClose={handleClose} fileInfo={fileInfo} />)
    await tick(0)
    await tick(0)
    expect(screen.getByText("This message can't be decrypted")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(handleClose).toHaveBeenCalledWith()
  })
})
