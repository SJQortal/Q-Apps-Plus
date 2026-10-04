import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'
import { readTextPreview, TEXT_PREVIEW_LIMIT } from './TextViewer'

const attachments = [
  { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'img1', originalFilename: 'cat.png', type: 'image/png', size: 3 },
  { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'txt1', originalFilename: 'notes.txt', type: null },
  { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'zip1', originalFilename: 'bundle.zip', type: null },
]

const bodies: Record<string, string> = { img1: 'png', txt1: 'hello notes', zip1: 'zipzip' }

function wrap(ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

describe('AttachmentPreviewDialog', () => {
  const urlAny = URL as any
  beforeEach(() => {
    resetAttachmentCache()
    urlAny.createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}`)
    urlAny.revokeObjectURL = vi.fn()
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', (req: Record<string, any>) => `ENC-${req.identifier}`)
    mockQortalAction('DECRYPT_DATA', (req: Record<string, any>) => btoa(bodies[String(req.encryptedData).replace('ENC-', '')]))
    mockQortalAction('SAVE_FILE', true)
  })
  afterEach(() => {
    delete urlAny.createObjectURL
    delete urlAny.revokeObjectURL
  })

  it('shows an image from the decrypted blob and walks to the other attachments', async () => {
    const onIndexChange = vi.fn()
    wrap(<AttachmentPreviewDialog open attachments={attachments} index={0} onClose={() => {}} onIndexChange={onIndexChange} />)
    const img = await screen.findByAltText('cat.png')
    expect(img.getAttribute('src')).toBe('blob:3')
    expect(screen.getByText('1 of 3 · 3 B')).toBeTruthy()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)

    fireEvent.click(screen.getByLabelText('Next attachment'))
    expect(onIndexChange).toHaveBeenCalledWith(1)
    await waitFor(() => expect(screen.getByLabelText('notes.txt').textContent).toBe('hello notes'))
    expect(screen.getByText(/2 of 3/)).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Next attachment'))
    await screen.findByText('This kind of file opens outside Q-Mail.')
    expect(screen.getByLabelText('Next attachment').hasAttribute('disabled')).toBe(true)

    // Going back costs nothing: the bytes are cached.
    fireEvent.click(screen.getByLabelText('Previous attachment'))
    fireEvent.click(screen.getByLabelText('Previous attachment'))
    await screen.findByAltText('cat.png')
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(3)
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(3)
  })

  it('goes full screen with one compact bar in a landscape Hub frame', async () => {
    const original = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('max-height: 500px') && query.includes('min-width: 600px'),
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false
        },
      }),
    })
    try {
      wrap(<AttachmentPreviewDialog open attachments={attachments} index={0} onClose={() => {}} />)
      await screen.findByAltText('cat.png')
      const paper = document.querySelector('.MuiDialog-paper')!
      expect(paper.className).toContain('MuiDialog-paperFullScreen')
      expect(document.querySelector('.MuiDialogActions-root')).toBeNull()
      // Save and Close sit in the title bar instead.
      expect(screen.getByRole('button', { name: 'Close preview' })).toBeTruthy()
    } finally {
      Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: original })
    }
  })

  it('saves the current attachment with SAVE_FILE', async () => {
    wrap(<AttachmentPreviewDialog open attachments={attachments} index={2} onClose={() => {}} />)
    await screen.findByText('This kind of file opens outside Q-Mail.')
    const buttons = screen.getAllByRole('button', { name: 'Save' }).filter((b) => !b.hasAttribute('disabled'))
    expect(buttons.length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.click(buttons[0])
    })
    await waitFor(() => expect(qortalCalls('SAVE_FILE')).toHaveLength(1))
    expect(qortalCalls('SAVE_FILE')[0]).toMatchObject({ filename: 'bundle.zip', mimeType: 'application/zip' })
  })

  it('shows the fetching state with Retry when peers are missing', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'MISSING_DATA' })
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    wrap(<AttachmentPreviewDialog open attachments={attachments} index={0} onClose={() => {}} />)
    await screen.findByText(/Not enough peers/)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(0)
  })

  it('cuts long text previews at the limit', async () => {
    const big = new Blob(['x'.repeat(TEXT_PREVIEW_LIMIT + 10)], { type: 'text/plain' })
    const result = await readTextPreview(big)
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(TEXT_PREVIEW_LIMIT)
    const small = await readTextPreview(new Blob(['abc']))
    expect(small).toEqual({ text: 'abc', truncated: false })
  })
})
