import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../theme/qplus-theme'
import { store } from '../state/store'
import { setUserAvatarHash } from '../state/features/globalSlice'
import { mockQortalAction, qortalCalls } from '../test/setup'
import { AvatarWrapper } from '../pages/Mail/MailTable'
import { AVATAR_MISS_SENTINEL, avatarCacheStats, getAvatarUrl, isAvatarUrl, peekAvatarUrl, primeAvatarUrl, resetAvatarCache } from './avatarCache'

const flush = () => act(async () => {})

describe('avatarCache', () => {
  beforeEach(() => resetAvatarCache())

  it('asks once per name, case-insensitively, and merges concurrent asks', async () => {
    mockQortalAction('GET_QDN_RESOURCE_URL', (req: Record<string, any>) => `/arbitrary/THUMBNAIL/${req.name}/qortal_avatar`)
    const [a, b, c] = await Promise.all([getAvatarUrl('Alice'), getAvatarUrl('alice'), getAvatarUrl('ALICE')])
    expect(a).toBe('/arbitrary/THUMBNAIL/Alice/qortal_avatar')
    expect(b).toBe(a)
    expect(c).toBe(a)
    expect(await getAvatarUrl('alice')).toBe(a)
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toEqual([
      { action: 'GET_QDN_RESOURCE_URL', name: 'Alice', service: 'THUMBNAIL', identifier: 'qortal_avatar' },
    ])
    expect(avatarCacheStats()).toMatchObject({ requests: 4, merged: 2, hits: 1, known: 1 })
  })

  it('remembers misses so a name without an avatar is never asked again', async () => {
    mockQortalAction('GET_QDN_RESOURCE_URL', AVATAR_MISS_SENTINEL)
    expect(await getAvatarUrl('bob')).toBeNull()
    expect(await getAvatarUrl('bob')).toBeNull()
    mockQortalAction('GET_QDN_RESOURCE_URL', () => {
      throw new Error('declined')
    })
    expect(await getAvatarUrl('carol')).toBeNull()
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(2)
    expect(peekAvatarUrl('bob')).toBeNull()
    expect(peekAvatarUrl('nobody')).toBeUndefined()
    expect(isAvatarUrl(AVATAR_MISS_SENTINEL)).toBe(false)
    expect(isAvatarUrl('')).toBe(false)
    expect(isAvatarUrl('/x')).toBe(true)
  })

  it('primes URLs learnt elsewhere without a request', async () => {
    primeAvatarUrl('dave', '/dave.png')
    primeAvatarUrl('erin', AVATAR_MISS_SENTINEL)
    expect(await getAvatarUrl('dave')).toBe('/dave.png')
    expect(peekAvatarUrl('erin')).toBeUndefined()
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(0)
  })
})

describe('AvatarWrapper', () => {
  beforeEach(() => resetAvatarCache())

  const wrap = (ui: React.ReactElement) =>
    render(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          {ui}
        </HubThemeProvider>
      </Provider>
    )

  it('reads the Redux hash first and makes no request', async () => {
    store.dispatch(setUserAvatarHash({ name: 'frank', url: '/frank.png' }))
    wrap(<AvatarWrapper user="frank" height="40px" />)
    await flush()
    expect(screen.getByRole('img', { name: 'frank' }).getAttribute('src')).toBe('/frank.png')
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(0)
  })

  it('resolves lazily, once per name, and hands the URL back to the Redux hash', async () => {
    mockQortalAction('GET_QDN_RESOURCE_URL', '/grace.png')
    wrap(
      <>
        <AvatarWrapper user="grace" height="40px" />
        <AvatarWrapper user="grace" height="50px" />
      </>
    )
    await flush()
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1)
    const imgs = screen.getAllByRole('img', { name: 'grace' })
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['/grace.png', '/grace.png'])
    expect(store.getState().global.userAvatarHash.grace).toBe('/grace.png')
  })

  it('shows the initial for a name without an avatar and keeps the sentinel out of Redux', async () => {
    mockQortalAction('GET_QDN_RESOURCE_URL', AVATAR_MISS_SENTINEL)
    store.dispatch(setUserAvatarHash({ name: 'heidi', url: AVATAR_MISS_SENTINEL }))
    expect(store.getState().global.userAvatarHash.heidi).toBeUndefined()
    wrap(<AvatarWrapper user="heidi" height="40px" fallback="heidi" />)
    await flush()
    expect(screen.getByText('H')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'heidi' })).toBeNull()
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1)
  })
})
