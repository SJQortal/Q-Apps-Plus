import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAvatarCache } from '../../utils/avatarCache'
import { NameAvatar, type NameAvatarProps } from './NameAvatar'

const PICTURE = '/arbitrary/THUMBNAIL/alice/qortal_avatar'

const wrap = (props: NameAvatarProps) =>
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <NameAvatar {...props} />
    </HubThemeProvider>
  )

beforeEach(() => {
  resetAvatarCache()
  mockQortalAction('GET_QDN_RESOURCE_URL', (request: any) =>
    request.name === 'alice' ? PICTURE : 'Resource does not exist'
  )
})

describe('NameAvatar', () => {
  it('shows the first letter for a name without a picture by default', async () => {
    const { container } = wrap({ name: 'bob', size: 32 })
    await waitFor(() => expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1))
    expect(container.querySelector('.MuiAvatar-root [data-letter="B"]')).toBeTruthy()
  })

  it('with fallback "none" takes no room until a picture arrives', async () => {
    const without = wrap({ name: 'bob', size: 22, fallback: 'none', gap: 8 })
    await waitFor(() => expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1))
    const empty = without.container.querySelector('[data-avatar="none"]') as HTMLElement
    expect(getComputedStyle(empty).width).toBe('0px')
    expect(getComputedStyle(empty).marginRight).not.toBe('8px')
    expect(without.container.querySelector('.MuiAvatar-root, img')).toBeNull()
    without.unmount()

    const { container } = wrap({ name: 'alice', size: 22, fallback: 'none', gap: 8 })
    const img = await waitFor(() => {
      const found = container.querySelector('img[data-avatar="picture"]') as HTMLImageElement
      expect(found).toBeTruthy()
      return found
    })
    expect(img.getAttribute('src')).toBe(PICTURE)
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('aria-hidden')).toBe('true')
    expect(getComputedStyle(img).width).toBe('22px')
    expect(getComputedStyle(img).marginRight).toBe('8px')
  })

  it('with fallback "space" keeps an empty square, so names in a list line up', async () => {
    const { container } = wrap({ name: 'bob', size: 24, fallback: 'space' })
    await waitFor(() => expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1))
    const empty = container.querySelector('[data-avatar="none"]') as HTMLElement
    expect(getComputedStyle(empty).width).toBe('24px')
    expect(container.querySelector('.MuiAvatar-root')).toBeNull()
  })

  it('drops a picture that fails to load', async () => {
    const { container } = wrap({ name: 'alice', size: 24, fallback: 'space' })
    const img = await waitFor(() => {
      const found = container.querySelector('img') as HTMLImageElement
      expect(found).toBeTruthy()
      return found
    })
    fireEvent.error(img)
    await waitFor(() => expect(container.querySelector('img')).toBeNull())
    expect(getComputedStyle(container.querySelector('[data-avatar="none"]') as HTMLElement).width).toBe('24px')
  })
})
