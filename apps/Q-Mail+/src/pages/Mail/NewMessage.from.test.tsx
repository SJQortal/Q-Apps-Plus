/**
 * Compose's From field: a small avatar before each name that has one (none,
 * and no gap, for a name without), loaded lazily through the shared avatar
 * cache.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { addUser } from '../../state/features/authSlice'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetNameCache } from '../../utils/nameCache'
import { resetAvatarCache } from '../../utils/avatarCache'
import { NewMessage } from './NewMessage'

const address = 'QmeAddress'
const WORK_AVATAR = '/arbitrary/THUMBNAIL/work/qortal_avatar'
const avatarCalls = () => qortalCalls('GET_QDN_RESOURCE_URL').map(request => request.name)

function renderComposer(ownedNames: string[]) {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <NewMessage
            inlineMode
            hideButton
            replyTo={null}
            setReplyTo={vi.fn()}
            setForwardInfo={vi.fn()}
            forwardInfo={null}
            ownedNames={ownedNames}
          />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  )
}

const fromField = () => screen.getByRole('combobox', { name: /From/ })

describe('Compose From: avatars', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNameCache()
    resetAvatarCache()
    store.dispatch(addUser({ name: 'me', address } as any))
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}owner` }))
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => ({ publicKey: `pk-${request.address}` }))
    mockQortalAction('SEARCH_NAMES', [])
    mockQortalAction('GET_QDN_RESOURCE_URL', (request: any) =>
      request.name === 'work' ? WORK_AVATAR : 'Resource does not exist'
    )
  })

  it('shows no picture and no gap for a name without an avatar, and asks for that one avatar only', async () => {
    renderComposer(['me', 'work'])
    await waitFor(() => expect(avatarCalls()).toEqual(['me']))
    const field = fromField()
    expect(field.textContent).toBe('me')
    expect(field.querySelector('img')).toBeNull()
    expect(field.querySelector('.MuiAvatar-root')).toBeNull()
    const slot = field.querySelector('[data-avatar="none"]') as HTMLElement
    expect(getComputedStyle(slot).width).toBe('0px')
  })

  it('shows the avatar of a name that has one, in the menu and in the closed field', async () => {
    renderComposer(['me', 'work'])
    fireEvent.mouseDown(fromField())
    const list = await screen.findByRole('listbox')
    const work = within(list).getByRole('option', { name: 'work' })
    await waitFor(() => expect(work.querySelector('img')?.getAttribute('src')).toBe(WORK_AVATAR))
    const workImg = work.querySelector('img') as HTMLImageElement
    expect(workImg.getAttribute('alt')).toBe('')
    expect(getComputedStyle(workImg).width).toBe('24px')

    // A name without one keeps an empty slot of the same width, so the names line up.
    const me = within(list).getByRole('option', { name: 'me' })
    expect(me.querySelector('img')).toBeNull()
    expect(me.querySelector('.MuiAvatar-root')).toBeNull()
    expect(getComputedStyle(me.querySelector('[data-avatar="none"]') as HTMLElement).width).toBe('24px')
    expect(me.textContent).toBe('me')

    fireEvent.click(work)
    await waitFor(() => expect(fromField().querySelector('img')?.getAttribute('src')).toBe(WORK_AVATAR))
    expect(fromField().textContent).toBe('work')
    // One request per name for the session: the closed field reused the cache.
    expect(avatarCalls().sort()).toEqual(['me', 'work'])
  })

  it('hides a picture that fails to load', async () => {
    renderComposer(['me', 'work'])
    fireEvent.mouseDown(fromField())
    fireEvent.click(await screen.findByRole('option', { name: 'work' }))
    const img = await waitFor(() => {
      const found = fromField().querySelector('img')
      expect(found).toBeTruthy()
      return found as HTMLImageElement
    })
    fireEvent.error(img)
    await waitFor(() => expect(fromField().querySelector('img')).toBeNull())
    expect(fromField().textContent).toBe('work')
  })
})

describe('Compose From: avatars load only for rows in view', () => {
  const observed: { element: Element; callback: (entries: { isIntersecting: boolean }[]) => void }[] = []
  const original = (globalThis as any).IntersectionObserver
  const intersect = async (element: Element) => {
    await act(async () => {
      observed.filter(entry => entry.element === element).forEach(entry => entry.callback([{ isIntersecting: true }]))
    })
  }

  beforeEach(() => {
    observed.length = 0
    resetNameCache()
    resetAvatarCache()
    store.dispatch(addUser({ name: 'me', address } as any))
    mockQortalAction('SEARCH_NAMES', [])
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
    ;(globalThis as any).IntersectionObserver = class {
      callback: (entries: { isIntersecting: boolean }[]) => void
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        this.callback = callback
      }
      observe(element: Element) {
        observed.push({ element, callback: this.callback })
      }
      disconnect() {}
    }
  })
  afterEach(() => {
    ;(globalThis as any).IntersectionObserver = original
  })

  it('asks for nothing until a row is on screen, then for that row only', async () => {
    renderComposer(['me', 'work', 'zed'])
    await act(async () => {})
    expect(avatarCalls()).toEqual([])
    await intersect(fromField().querySelector('[data-avatar]')!)
    expect(avatarCalls()).toEqual(['me'])

    fireEvent.mouseDown(fromField())
    const list = await screen.findByRole('listbox')
    await act(async () => {})
    expect(avatarCalls()).toEqual(['me'])
    await intersect(within(list).getByRole('option', { name: 'zed' }).querySelector('[data-avatar]')!)
    expect(avatarCalls()).toEqual(['me', 'zed'])
  })
})
