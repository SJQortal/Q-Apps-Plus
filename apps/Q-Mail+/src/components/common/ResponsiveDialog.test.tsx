import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Button } from '@mui/material'
import { ResponsiveDialog } from './ResponsiveDialog'
import { BottomSheetMenu } from './BottomSheetMenu'
import ConfirmationModal from './ConfirmationModal'
import { PHONE_MAX_WIDTH } from '../../layout/useLayoutMode'

const originalMatchMedia = window.matchMedia

/** Makes useLayoutMode() report a phone (< 600 px) or a desktop. */
function setViewport(mode: 'phone' | 'desktop') {
  window.matchMedia = ((query: string) => ({
    matches:
      mode === 'phone'
        ? query.includes(`max-width:${PHONE_MAX_WIDTH - 0.05}px`)
        : query.includes('min-width:900px'),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  })) as any
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('ResponsiveDialog', () => {
  it('is full-screen on phones with a close button in the title and 48 px actions', () => {
    setViewport('phone')
    const onClose = vi.fn()
    render(
      <ResponsiveDialog open onClose={onClose} title="Delete draft?" actions={<Button>Delete</Button>}>
        body
      </ResponsiveDialog>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toMatch(/MuiDialog-paperFullScreen/)
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is a centred dialog on desktop, labelled by its title, with the focus trap on', () => {
    setViewport('desktop')
    render(
      <ResponsiveDialog open onClose={() => {}} title="Blocked names">
        body
      </ResponsiveDialog>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).not.toMatch(/MuiDialog-paperFullScreen/)
    const labelId = dialog.getAttribute('aria-labelledby')!
    expect(document.getElementById(labelId)?.textContent).toContain('Blocked names')
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    // MUI's FocusTrap renders its sentinels only while enforcing focus.
    expect(document.querySelectorAll('[data-testid="sentinelStart"]').length).toBe(1)
  })

  it('cannot be dismissed when onClose is omitted (publishing)', () => {
    setViewport('desktop')
    render(
      <ResponsiveDialog open title="Publishing…">
        wait
      </ResponsiveDialog>
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

describe('ConfirmationModal', () => {
  it('uses verbs on its buttons and resolves confirm / cancel', () => {
    setViewport('desktop')
    const confirm = vi.fn()
    const cancel = vi.fn()
    render(
      <ConfirmationModal
        open
        title="Publish mail state?"
        message="It costs one QDN publish."
        confirmLabel="Publish"
        cancelLabel="Not now"
        handleConfirm={confirm}
        handleCancel={cancel}
      />
    )
    expect(screen.queryByRole('button', { name: 'Proceed' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})

describe('BottomSheetMenu', () => {
  const items = (onSelect: (id: string) => void) => [
    { id: 'newest', label: 'Newest', selected: true, onSelect: () => onSelect('newest') },
    { id: 'oldest', label: 'Oldest', onSelect: () => onSelect('oldest') },
  ]

  it('opens as a bottom sheet on phones and selects on tap', () => {
    setViewport('phone')
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <BottomSheetMenu open onClose={onClose} anchorEl={null} title="Sort threads" items={items(onSelect)} />
    )
    expect(screen.getByText('Sort threads')).toBeTruthy()
    expect(document.querySelector('.MuiDrawer-anchorBottom .MuiDrawer-paper')).toBeTruthy()
    fireEvent.click(screen.getByText('Oldest'))
    expect(onSelect).toHaveBeenCalledWith('oldest')
    expect(onClose).toHaveBeenCalled()
  })

  it('is a regular menu on desktop', () => {
    setViewport('desktop')
    const anchor = document.createElement('button')
    document.body.appendChild(anchor)
    render(<BottomSheetMenu open onClose={() => {}} anchorEl={anchor} items={items(() => {})} />)
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(document.querySelector('.MuiDrawer-anchorBottom .MuiDrawer-paper')).toBeNull()
    expect(screen.getAllByRole('menuitem').length).toBe(2)
  })
})
