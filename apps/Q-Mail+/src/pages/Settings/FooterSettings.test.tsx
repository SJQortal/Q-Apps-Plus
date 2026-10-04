import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { mockQortalAction } from '../../test/setup'
import { resetAvatarCache } from '../../utils/avatarCache'
import { FooterSettings, sortFooterNames } from './FooterSettings'

const address = 'QFooterPicker'
/** 20 names, unsorted as GET_ACCOUNT_NAMES returns them: more than the search threshold. */
const many = [
  'zed', 'Simon James', 'alice', 'Bob', 'ändi', 'carol', 'dave', 'erin', 'frank', 'grace',
  'heidi', 'ivan', 'judy', 'mallory', 'niaj', 'olivia', 'peggy', 'Qortal Seth', 'simple', 'trent',
]

const wrap = (names: string[]) =>
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <FooterSettings address={address} names={names} />
    </HubThemeProvider>
  )

beforeEach(() => {
  window.localStorage.clear()
  resetAvatarCache()
  mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
})

describe('FooterSettings name picker', () => {
  it('sorts names A to Z, ignoring case and accents', () => {
    expect(sortFooterNames(['zed', 'Bob', 'ändi', 'alice', 'Bob', ''])).toEqual(['alice', 'ändi', 'Bob', 'zed'])
  })

  it('lists a few names A to Z in a plain select', async () => {
    wrap(['zed', 'Bob', 'alice'])
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Footer for' }))
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent)
    expect(options).toEqual([
      'All names (default)',
      'alice (uses the default)',
      'Bob (uses the default)',
      'zed (uses the default)',
    ])
  })

  it('finds one of many names by search, marks names with their own footer, and edits that footer', () => {
    window.localStorage.setItem(
      `qmail_footer_${address}`,
      JSON.stringify({ default: 'Default text', byName: { peggy: 'Peggy footer' }, inReplies: true })
    )
    wrap(many)
    expect(screen.queryByRole('combobox', { name: 'Footer for' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Footer for: All names (default). Change' }))
    const rows = screen.getAllByRole('menuitemradio')
    expect(rows[0].getAttribute('aria-label')).toBe('All names (default)')
    expect(rows[0].getAttribute('aria-checked')).toBe('true')
    expect(rows.slice(1, 4).map((r) => r.getAttribute('aria-label'))).toEqual(['alice', 'ändi', 'Bob'])
    expect(screen.getByRole('menuitemradio', { name: 'peggy, Own footer' })).toBeTruthy()

    const search = screen.getByRole('textbox', { name: 'Find one of your names' })
    fireEvent.change(search, { target: { value: 'pEg' } })
    expect(screen.getAllByRole('menuitemradio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'peggy, Own footer',
    ])
    fireEvent.keyDown(search, { key: 'Enter' })
    const field = screen.getByRole('textbox', { name: 'Footer for peggy' }) as HTMLTextAreaElement
    expect(field.value).toBe('Peggy footer')
    expect(screen.getByRole('button', { name: 'Footer for: peggy. Change' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Footer for: peggy. Change' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'All names (default)' }))
    expect((screen.getByRole('textbox', { name: 'Default footer' }) as HTMLTextAreaElement).value).toBe('Default text')
  })
})
