import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { OpenMail } from './OpenMail'

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
