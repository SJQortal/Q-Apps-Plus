import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useContext } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import notificationsReducer from '../state/features/notificationsSlice'
import authReducer from '../state/features/authSlice'
import globalReducer from '../state/features/globalSlice'
import blogReducer from '../state/features/blogSlice'
import mailReducer from '../state/features/mailSlice'
import { mockFetchRoute, mockQortalAction, qortalCalls } from '../test/setup'
import { HUB_DIALOG_GRACE_MS } from '../utils/hubErrors'
import { getAvatarUrl, resetAvatarCache } from '../utils/avatarCache'
import { AppShellContext } from '../app-shell/AppShellContext'
import GlobalWrapper from './GlobalWrapper'

function makeStore() {
  return configureStore({
    reducer: { notifications: notificationsReducer, auth: authReducer, global: globalReducer, blog: blogReducer, mail: mailReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
}

const HUB_TIMEOUT = {
  error: 'Request timed out after 30000 ms (action: GET_USER_ACCOUNT)',
  message: 'Request timed out after 30000 ms (action: GET_USER_ACCOUNT)',
}
const HUB_REFUSAL = { error: 'Unable to get user account', message: 'Unable to get user account' }

const flush = () => act(async () => {})

describe('GlobalWrapper: GET_USER_ACCOUNT', () => {
  let errors: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    vi.useFakeTimers()
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('qmail-general-consent', 'true')
    mockQortalAction('NOTIFICATION_MARK_SEEN', true)
    mockQortalAction('GET_ACCOUNT_NAMES', [{ name: 'alice', owner: 'Q1' }])
    mockQortalAction('GET_PRIMARY_NAME', 'alice')
    mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
    mockFetchRoute('/groups/member/', [])
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("asks once more after Hub's 30 s timeout, when the dialog is gone, and signs in on a late Accept", async () => {
    let calls = 0
    mockQortalAction('GET_USER_ACCOUNT', () => {
      calls += 1
      if (calls === 1) throw HUB_TIMEOUT
      return { address: 'Q1', publicKey: 'pk' }
    })
    const store = makeStore()
    render(
      <Provider store={store}>
        <GlobalWrapper>
          <div />
        </GlobalWrapper>
      </Provider>
    )
    await flush()
    expect(qortalCalls('GET_USER_ACCOUNT')).toHaveLength(1)
    expect(store.getState().auth.user).toBeNull()

    // Not yet: Hub's dialog may still be up.
    await act(async () => {
      vi.advanceTimersByTime(HUB_DIALOG_GRACE_MS - 1000)
    })
    expect(qortalCalls('GET_USER_ACCOUNT')).toHaveLength(1)

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    await flush()
    expect(qortalCalls('GET_USER_ACCOUNT')).toHaveLength(2)
    expect(store.getState().auth.user).toMatchObject({ address: 'Q1', name: 'alice' })
    expect(errors).not.toHaveBeenCalled()
  })

  it("treats a decline (Hub's one 'Unable to get user account' answer) as a cancel: one request, nothing logged", async () => {
    mockQortalAction('GET_USER_ACCOUNT', () => {
      throw HUB_REFUSAL
    })
    const store = makeStore()
    render(
      <Provider store={store}>
        <GlobalWrapper>
          <div />
        </GlobalWrapper>
      </Provider>
    )
    await flush()
    await act(async () => {
      vi.advanceTimersByTime(HUB_DIALOG_GRACE_MS + 1000)
    })
    expect(qortalCalls('GET_USER_ACCOUNT')).toHaveLength(1)
    expect(store.getState().auth.user).toBeNull()
    expect(errors).not.toHaveBeenCalled()
  })

  it('logs a real failure once and does not retry it', async () => {
    mockQortalAction('GET_USER_ACCOUNT', () => {
      throw new Error('qortalRequest is only available inside Qortal Hub or GO')
    })
    render(
      <Provider store={makeStore()}>
        <GlobalWrapper>
          <div />
        </GlobalWrapper>
      </Provider>
    )
    await flush()
    await act(async () => {
      vi.advanceTimersByTime(HUB_DIALOG_GRACE_MS + 1000)
    })
    expect(qortalCalls('GET_USER_ACCOUNT')).toHaveLength(1)
    expect(errors).toHaveBeenCalledTimes(1)
  })
})

describe('GlobalWrapper: own avatar', () => {
  beforeEach(() => {
    resetAvatarCache()
    localStorage.setItem('qmail-general-consent', 'true')
    mockQortalAction('NOTIFICATION_MARK_SEEN', true)
    mockQortalAction('GET_ACCOUNT_NAMES', [{ name: 'alice', owner: 'Q1' }])
    mockQortalAction('GET_PRIMARY_NAME', 'alice')
    mockQortalAction('GET_USER_ACCOUNT', { address: 'Q1', publicKey: 'pk' })
    mockQortalAction('GET_QDN_RESOURCE_URL', '/arbitrary/THUMBNAIL/alice/qortal_avatar')
    mockFetchRoute('/groups/member/', [])
  })
  afterEach(() => {
    resetAvatarCache()
  })

  function AvatarProbe() {
    const { userAvatar } = useContext(AppShellContext)!
    return <span data-testid="own-avatar">{userAvatar}</span>
  }

  it('resolves through the session avatar cache, so the owned-name loop asks no second time', async () => {
    render(
      <Provider store={makeStore()}>
        <GlobalWrapper>
          <AvatarProbe />
        </GlobalWrapper>
      </Provider>
    )
    await waitFor(() =>
      expect(screen.getByTestId('own-avatar').textContent).toBe('/arbitrary/THUMBNAIL/alice/qortal_avatar')
    )
    // Mail.tsx's owned-name loop asks for the same name: answered from the cache.
    await expect(getAvatarUrl('alice')).resolves.toBe('/arbitrary/THUMBNAIL/alice/qortal_avatar')
    expect(qortalCalls('GET_QDN_RESOURCE_URL')).toHaveLength(1)
  })
})
