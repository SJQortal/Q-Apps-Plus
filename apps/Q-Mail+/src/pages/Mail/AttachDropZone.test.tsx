import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { DropzoneState } from 'react-dropzone'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { AttachDropZone } from './AttachDropZone'

const dropzone = (overrides: Partial<DropzoneState> = {}) =>
  ({
    getRootProps: () => ({ 'data-testid': 'zone' }),
    getInputProps: () => ({ type: 'file', 'aria-hidden': true }),
    isDragActive: false,
    open: vi.fn(),
    ...overrides,
  }) as unknown as DropzoneState

const wrap = (ui: React.ReactElement) => render(<HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>{ui}</HubThemeProvider>)

describe('AttachDropZone', () => {
  it('is a labelled button that opens the file picker, "Attach more" once files are attached', () => {
    const zone = dropzone()
    const view = wrap(<AttachDropZone dropzone={zone} count={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }))
    expect(zone.open).toHaveBeenCalledTimes(1)
    view.unmount()
    wrap(<AttachDropZone dropzone={dropzone()} count={2} />)
    expect(screen.getByRole('button', { name: 'Attach more' })).toBeTruthy()
  })

  it('says where to drop while files are dragged over it', () => {
    wrap(<AttachDropZone dropzone={dropzone({ isDragActive: true })} count={0} />)
    expect(screen.getByText('Drop to attach')).toBeTruthy()
  })
})
