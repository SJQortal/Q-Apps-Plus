import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { readHiddenInboxNames, readHideEmptyInboxNames, resetInboxNamesSession, setInboxNameHidden } from '../../utils/inboxNamesPreference'
import { InboxNamesSettings } from './InboxNamesSettings'

const wrap = () =>
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <InboxNamesSettings address="QA" names={['Simon James', 'POS+']} />
    </HubThemeProvider>
  )

describe('InboxNamesSettings', () => {
  it('hides a name chosen here, for keyboards without a menu key', async () => {
    localStorage.clear()
    resetInboxNamesSession()
    wrap()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Name' }))
    fireEvent.click(await screen.findByRole('option', { name: 'POS+' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(readHiddenInboxNames('QA')).toEqual(['pos+'])
    expect(screen.getByRole('button', { name: 'Show POS+ again' })).toBeTruthy()
  })

  beforeEach(() => {
    localStorage.clear()
    resetInboxNamesSession()
  })

  it('turns "hide empty names" on, lists hidden names as written, and shows one again', () => {
    setInboxNameHidden('QA', 'POS+', true)
    wrap()
    fireEvent.click(screen.getByRole('switch', { name: 'Hide names with nothing in the inbox' }))
    expect(readHideEmptyInboxNames('QA')).toBe(true)
    expect(screen.getByText('POS+')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show POS+ again' }))
    expect(readHiddenInboxNames('QA')).toEqual([])
    expect(screen.queryByText('Hidden from the list')).toBeNull()
  })
})
