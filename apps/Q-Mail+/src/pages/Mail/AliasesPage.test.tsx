import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { AliasesPage } from './AliasesPage'

const baseScanState = {
  isRunning: false,
  phase: 'idle' as const,
  scannedCount: 10,
  totalCount: 10,
  discoveredCount: 1,
  statusMessage: 'Read 500 resources (the limit for one run): found 1 new alias. Scan more to continue with older mail.',
  paging: { resourcesWalked: 500, candidatesChecked: 42, maxPages: 10, complete: false, stoppedAtCap: true },
}

function renderPage(overrides: Partial<typeof baseScanState> = {}, hasScanCheckpoint = true) {
  const onRunAliasScan = vi.fn()
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <AliasesPage
        aliases={[]}
        aliasesWithMessages={[]}
        replyAliasLinks={{}}
        onOpenAlias={vi.fn()}
        onAddAlias={vi.fn()}
        onRemoveAlias={vi.fn()}
        onSetReplyAlias={vi.fn()}
        onClearReplyAlias={vi.fn()}
        onRunAliasScan={onRunAliasScan}
        onCancelAliasScan={vi.fn()}
        hasScanCheckpoint={hasScanCheckpoint}
        scanCheckpointTimestamp={0}
        scanState={{ ...baseScanState, ...overrides }}
      />
    </HubThemeProvider>
  )
  return onRunAliasScan
}

describe('AliasesPage alias scan (N9)', () => {
  it('shows the per-run cap, the progress and a "Scan more" button after a capped run', () => {
    const onRun = renderPage()
    expect(screen.getByText(/up to 500 per run/)).toBeTruthy()
    expect(screen.getByTestId('alias-scan-progress').textContent).toBe(
      'Page 10 of 10 • 500 resources read • 42 checked • 1 discovered'
    )
    expect(screen.getByTestId('alias-scan-coverage').textContent).toMatch(/Older mail has not been scanned yet/)
    fireEvent.click(screen.getByRole('button', { name: 'Scan more' }))
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it('says when the whole index has been scanned', () => {
    renderPage({ paging: { ...baseScanState.paging, complete: true, stoppedAtCap: false } })
    expect(screen.getByRole('button', { name: 'Check new mail' })).toBeTruthy()
    expect(screen.getByTestId('alias-scan-coverage').textContent).toMatch(/All Q-Mail resources have been scanned/)
  })

  it('names the progress bar and fills it when a run reached the end of the index', () => {
    renderPage({ scannedCount: 2, paging: { ...baseScanState.paging, resourcesWalked: 51, complete: true, stoppedAtCap: false } })
    const bar = screen.getByRole('progressbar', { name: 'Alias scan progress' })
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
    expect(bar.getAttribute('aria-describedby')).toBe('qmail-alias-scan-progress')
  })

  it('shows pages read out of the cap while a run is going', () => {
    renderPage({ isRunning: true, scannedCount: 3, paging: { ...baseScanState.paging, complete: true } })
    expect(screen.getByRole('progressbar', { name: 'Alias scan progress' }).getAttribute('aria-valuenow')).toBe('30')
  })

  it('offers a first scan when there is no checkpoint', () => {
    renderPage({ scannedCount: 0, totalCount: 0, statusMessage: '' }, false)
    expect(screen.getByRole('button', { name: 'Start alias scan' })).toBeTruthy()
    expect(screen.queryByTestId('alias-scan-progress')).toBeNull()
  })
})
