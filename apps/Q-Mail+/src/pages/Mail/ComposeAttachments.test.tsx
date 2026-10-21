import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { ComposeAttachments, type ComposeAttachment } from './ComposeAttachments'

const file = (name: string, type: string, body = 'x') => new File([body], name, { type })

function wrap(attachments: ComposeAttachment[], onRemove = vi.fn()) {
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <ComposeAttachments attachments={attachments} onRemove={onRemove} />
    </HubThemeProvider>
  )
  return onRemove
}

describe('ComposeAttachments', () => {
  const created: string[] = []
  beforeEach(() => {
    // jsdom has no object URLs.
    ;(URL as any).createObjectURL = vi.fn(() => {
      const url = `blob:test/${created.length}`
      created.push(url)
      return url
    })
    ;(URL as any).revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    created.length = 0
  })

  it('lays the files out as tiles in one list: thumbnails for images, sizes, and a missing extension flagged', () => {
    wrap([
      { file: file('photo.jpg', 'image/jpeg'), extension: 'jpg' },
      { file: file('notes.txt', 'text/plain', 'hello'), extension: 'txt', forwardKey: 'f1' },
      { file: file('README', ''), extension: '' },
    ])
    const list = screen.getByRole('list', { name: 'Attachments' })
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(3)
    expect(list.querySelectorAll('img')).toHaveLength(1)
    expect(screen.getByText('5 B · forwarded')).toBeTruthy()
    expect(screen.getByText('No file extension')).toBeTruthy()
  })

  it('a tile is described by its size or its missing extension', () => {
    wrap([{ file: file('README', ''), extension: '' }])
    const preview = screen.getByRole('button', { name: 'Preview README' })
    expect(document.getElementById(preview.getAttribute('aria-describedby') || '')?.textContent).toBe('No file extension')
  })

  it('after a removal focus goes to the next file, and to "Attach files" after the last', async () => {
    let items: ComposeAttachment[] = [
      { file: file('a.txt', 'text/plain'), extension: 'txt' },
      { file: file('b.txt', 'text/plain'), extension: 'txt' },
    ]
    const ui = () => (
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <button type="button" data-attach-files="">Attach files</button>
        <ComposeAttachments
          attachments={items}
          onRemove={(index) => {
            items = items.filter((_, at) => at !== index)
            view.rerender(ui())
          }}
        />
      </HubThemeProvider>
    )
    const view = render(ui())
    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment a.txt' }))
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Preview b.txt' })))
    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment b.txt' }))
    await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Attach files' })))
  })

  it('removes one file', () => {
    const onRemove = wrap([
      { file: file('a.txt', 'text/plain'), extension: 'txt' },
      { file: file('b.txt', 'text/plain'), extension: 'txt' },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Remove attachment b.txt' }))
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('previews a file before it is sent, with Previous and Next', async () => {
    wrap([
      { file: file('photo.jpg', 'image/jpeg'), extension: 'jpg' },
      { file: file('notes.txt', 'text/plain', 'hello there'), extension: 'txt' },
      { file: file('bundle.zip', 'application/zip'), extension: 'zip' },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Preview photo.jpg' }))
    const dialog = await screen.findByRole('dialog', { name: /photo\.jpg/ })
    expect(dialog.textContent).toContain('1 of 3')
    expect(dialog.textContent).toContain('not sent yet')
    fireEvent.click(screen.getByRole('button', { name: 'Next attachment' }))
    expect(await screen.findByText('hello there')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next attachment' }))
    expect(await screen.findByText(/No preview for this kind of file/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Next attachment' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
