import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { PDF_OPEN_MAX_BYTES, resetHubPdfReader } from '../../utils/pdf/hubPdfReader'
import { AttachmentList } from './AttachmentList'
import { PdfAttachmentCard, pdfDownloadStatusText } from './PdfAttachmentCard'

// The fallback viewer must not pull the real pdf.js engine into jsdom.
vi.mock('../../utils/pdf/pdfJsHub', () => ({
  loadPdfJs: () => new Promise(() => {}),
  prefetchPdfJsWorker: () => {},
  resetPdfjsMainThreadHandlerCache: () => {},
  copyPdfBytes: (buffer: ArrayBuffer) => new Uint8Array(buffer),
}))

const pdf = { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'pdf1', originalFilename: 'paper.pdf', type: 'application/pdf', size: 2048 }
const png = { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'img1', originalFilename: 'cat.png', type: 'image/png', size: 3 }

function wrap(ui: React.ReactElement) {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

const openButton = () => screen.getByRole('button', { name: 'Open PDF paper.pdf' })

describe('PdfAttachmentCard', () => {
  const urlAny = URL as any
  beforeEach(() => {
    resetAttachmentCache()
    resetHubPdfReader()
    urlAny.createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}`)
    urlAny.revokeObjectURL = vi.fn()
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa('%PDF-1.7 secret mail'))
    mockQortalAction('SAVE_FILE', true)
    mockQortalAction('SHOW_PDF_READER', true)
  })
  afterEach(() => {
    vi.useRealTimers()
    delete urlAny.createObjectURL
    delete urlAny.revokeObjectURL
  })

  it('shows the Q-Share+ file card: icon, name, "PDF · size", Download and Open PDF, with no Qortal calls', () => {
    wrap(<PdfAttachmentCard attachment={pdf} onOpenInApp={() => {}} />)
    expect(screen.getByText('paper.pdf')).toBeTruthy()
    expect(screen.getByText('PDF · 2.0 KB')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download paper.pdf' }).textContent).toBe('Download')
    expect(openButton().textContent).toBe('Open PDF')
    expect(within(openButton()).getByTestId('PictureAsPdfOutlinedIcon')).toBeTruthy()
    expect(qortalCalls()).toHaveLength(0)
  })

  it('opens the decrypted bytes in Hub\'s reader, and only decrypts once', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    const onOpenInApp = vi.fn()
    wrap(<PdfAttachmentCard attachment={pdf} onOpenInApp={onOpenInApp} />)
    fireEvent.click(openButton())
    await waitFor(() => expect(qortalCalls('SHOW_PDF_READER')).toHaveLength(1))
    const request = qortalCalls('SHOW_PDF_READER')[0]
    expect(Object.keys(request).sort()).toEqual(['action', 'blob'])
    expect((request.blob as Blob).type).toBe('application/pdf')
    expect(await (request.blob as Blob).text()).toBe('%PDF-1.7 secret mail')
    // Download became Save: the bytes are in the session cache.
    await screen.findByRole('button', { name: 'Save paper.pdf' })
    await waitFor(() => expect((openButton() as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(openButton())
    await waitFor(() => expect(qortalCalls('SHOW_PDF_READER')).toHaveLength(2))
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(1)
    expect(qortalCalls('PUBLISH_QDN_RESOURCE')).toHaveLength(0)
    expect(onOpenInApp).not.toHaveBeenCalled()
  })

  it('says "Opens when ready" with the progress while the file is on its way, then opens it', async () => {
    vi.useFakeTimers()
    let calls = 0
    mockQortalAction('GET_QDN_RESOURCE_STATUS', () => (++calls < 3 ? { status: 'DOWNLOADING', percentLoaded: 40 } : { status: 'READY' }))
    wrap(<PdfAttachmentCard attachment={pdf} onOpenInApp={() => {}} />)
    fireEvent.click(openButton())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(openButton().textContent).toBe('Opens when ready')
    expect((openButton() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Fetching from peers… 40%')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'paper.pdf download progress' })).toBeTruthy()
    expect(qortalCalls('SHOW_PDF_READER')).toHaveLength(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000)
    })
    vi.useRealTimers()
    await waitFor(() => expect(qortalCalls('SHOW_PDF_READER')).toHaveLength(1))
  })

  it('falls back to the bundled viewer when Hub has no reader', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('SHOW_PDF_READER', () => {
      throw new Error('Unknown action')
    })
    const onOpenInApp = vi.fn()
    wrap(<PdfAttachmentCard attachment={pdf} onOpenInApp={onOpenInApp} />)
    fireEvent.click(openButton())
    await waitFor(() => expect(onOpenInApp).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/Couldn't open/)).toBeNull()
  })

  it('refuses bytes that are not a PDF', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('DECRYPT_DATA', btoa('<html><script>alert(1)</script></html>'))
    const onOpenInApp = vi.fn()
    wrap(<PdfAttachmentCard attachment={pdf} onOpenInApp={onOpenInApp} />)
    fireEvent.click(openButton())
    expect(await screen.findByText("This file isn't a PDF. Download to view.")).toBeTruthy()
    expect(qortalCalls('SHOW_PDF_READER')).toHaveLength(0)
    expect(onOpenInApp).not.toHaveBeenCalled()
  })

  it('offers no reader for PDFs over the cap', () => {
    wrap(<PdfAttachmentCard attachment={{ ...pdf, size: PDF_OPEN_MAX_BYTES + 1 }} onOpenInApp={() => {}} />)
    expect(screen.queryByRole('button', { name: /Open PDF/ })).toBeNull()
    expect(screen.getByText('Too large to open here. Download to view.')).toBeTruthy()
  })

  it('saves through Hub\'s SAVE_FILE with the decrypted blob', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    wrap(<PdfAttachmentCard attachment={pdf} onOpenInApp={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download paper.pdf' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save paper.pdf' }))
    await waitFor(() => expect(qortalCalls('SAVE_FILE')).toHaveLength(1))
    expect(qortalCalls('SAVE_FILE')[0]).toMatchObject({ filename: 'paper.pdf', mimeType: 'application/pdf' })
  })

  it('uses Q-Share+\'s download wording', () => {
    expect(pdfDownloadStatusText('DOWNLOADING', 12.4, false)).toBe('Fetching from peers… 12%')
    expect(pdfDownloadStatusText('MISSING_DATA', 50, false)).toBe('Waiting for peers… 50%')
    expect(pdfDownloadStatusText('BUILDING', undefined, false)).toBe('Building file…')
    expect(pdfDownloadStatusText('READY', 100, true)).toBe('Decrypting…')
  })
})

describe('AttachmentList with a PDF', () => {
  const urlAny = URL as any
  beforeEach(() => {
    resetAttachmentCache()
    resetHubPdfReader()
    urlAny.createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}`)
    urlAny.revokeObjectURL = vi.fn()
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa('%PDF-1.4 x'))
  })
  afterEach(() => {
    delete urlAny.createObjectURL
    delete urlAny.revokeObjectURL
  })

  it('gives PDFs the PDF card and other files the usual card', () => {
    wrap(<AttachmentList attachments={[png, pdf]} />)
    expect(screen.getByRole('button', { name: 'Open cat.png' })).toBeTruthy()
    expect(openButton()).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open paper.pdf' })).toBeNull()
  })

  it('opens the in-app viewer on that PDF when Hub has no reader', async () => {
    mockQortalAction('SHOW_PDF_READER', () => {
      throw new Error('Unknown action')
    })
    wrap(<AttachmentList attachments={[png, pdf]} />)
    fireEvent.click(openButton())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('2 of 2 · 10 B')).toBeTruthy()
  })
})
