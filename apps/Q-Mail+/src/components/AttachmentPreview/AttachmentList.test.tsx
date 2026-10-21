import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { AttachmentList, usableAttachments } from './AttachmentList'
import { downloadAllSequential, waitForResource } from './useDownloadAll'

const attachments = [
  { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'a1', originalFilename: 'cat.png', filename: 'x.png', type: 'image/png', size: 2048 },
  { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'a2', originalFilename: 'notes.txt', filename: 'y.txt', type: null },
]

function wrap(ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

describe('usableAttachments', () => {
  it('keeps only references with identifier, name and service', () => {
    expect(usableAttachments(null)).toEqual([])
    expect(usableAttachments([{ identifier: 'x' }, null, 'junk', attachments[0]])).toEqual([attachments[0]])
  })
})

describe('AttachmentList', () => {
  const urlAny = URL as any
  beforeEach(() => {
    resetAttachmentCache()
    urlAny.createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}`)
    urlAny.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    delete urlAny.createObjectURL
    delete urlAny.revokeObjectURL
  })

  it('renders a card per attachment with name and size, and no Qortal calls until a tap', () => {
    wrap(<AttachmentList attachments={attachments} />)
    expect(screen.getByText('cat.png')).toBeTruthy()
    expect(screen.getByText('2.0 KB')).toBeTruthy()
    expect(screen.getByText('notes.txt')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download all (2)' })).toBeTruthy()
    expect(qortalCalls()).toHaveLength(0)
  })

  it('offers Open and Save from the kebab menu', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa('bytes'))
    mockQortalAction('SAVE_FILE', true)
    wrap(<AttachmentList attachments={[attachments[0]]} />)
    fireEvent.click(screen.getByLabelText('More options for cat.png'))
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Save' }))
    })
    await waitFor(() => expect(qortalCalls('SAVE_FILE')).toHaveLength(1))
    expect(qortalCalls('SAVE_FILE')[0]).toMatchObject({ filename: 'cat.png', mimeType: 'image/png' })
  })

  it('a tap opens the preview dialog', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa('png'))
    wrap(<AttachmentList attachments={[attachments[0]]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open cat.png' }))
    await screen.findByRole('dialog')
    await screen.findByAltText('cat.png')
  })
})

describe('downloadAllSequential', () => {
  beforeEach(() => resetAttachmentCache())

  it('waits for each resource, then fetches, decrypts and saves them in order', async () => {
    const statusCalls: string[] = []
    mockQortalAction('GET_QDN_RESOURCE_STATUS', (req: Record<string, any>) => {
      statusCalls.push(req.identifier)
      // a1 needs one wait; a2 is ready at once
      return { status: req.identifier === 'a1' && statusCalls.filter((i) => i === 'a1').length < 2 ? 'DOWNLOADING' : 'READY' }
    })
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    mockQortalAction('FETCH_QDN_RESOURCE', (req: Record<string, any>) => `ENC-${req.identifier}`)
    mockQortalAction('DECRYPT_DATA', () => btoa('data'))
    mockQortalAction('SAVE_FILE', true)
    const sleeps: number[] = []
    const result = await downloadAllSequential(attachments, { sleep: async (ms) => void sleeps.push(ms) })
    expect(result).toMatchObject({ active: false, saved: 2, failed: [], total: 2 })
    expect(qortalCalls('SAVE_FILE').map((c) => c.filename)).toEqual(['cat.png', 'notes.txt'])
    expect(qortalCalls('GET_QDN_RESOURCE_PROPERTIES')).toHaveLength(1)
    expect(sleeps).toEqual([5000])
  })

  it('records a failure and carries on, and gives up on NOT_PUBLISHED', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', (req: Record<string, any>) => ({ status: req.identifier === 'a1' ? 'NOT_PUBLISHED' : 'READY' }))
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', () => btoa('data'))
    mockQortalAction('SAVE_FILE', true)
    const result = await downloadAllSequential(attachments, { sleep: async () => {} })
    expect(result.failed).toEqual(['cat.png'])
    expect(result.saved).toBe(1)
    await expect(waitForResource(attachments[0], { sleep: async () => {} })).rejects.toThrow(/not published/)
  })

  it('stops when cancelled', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'DOWNLOADING' })
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    const controller = new AbortController()
    const result = await downloadAllSequential(attachments, {
      signal: controller.signal,
      sleep: async () => controller.abort(),
    })
    expect(result.saved).toBe(0)
    expect(qortalCalls('SAVE_FILE')).toHaveLength(0)
  })
})
