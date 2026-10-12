import { describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import mailReducer, { markRead } from '../state/features/mailSlice'
import { useMailLocalState } from './useMailLocalState'

function Harness({ address }: { address?: string }) {
  useMailLocalState(address)
  return null
}

describe('useMailLocalState', () => {
  const makeStore = () => configureStore({ reducer: { mail: mailReducer } })

  it('loads the saved state for the address and persists changes under the same key', () => {
    window.localStorage.setItem('qmail_read_state_QA', JSON.stringify({ saved: 3 }))
    const store = makeStore()
    render(
      <Provider store={store}>
        <Harness address="QA" />
      </Provider>
    )
    expect(store.getState().mail.readState).toEqual({ saved: 3 })
    act(() => {
      store.dispatch(markRead({ ids: ['new'], at: 9 }))
    })
    expect(JSON.parse(window.localStorage.getItem('qmail_read_state_QA') || '{}')).toEqual({ saved: 3, new: 9 })
  })

  it('switches stores when the address changes without leaking one account into another', () => {
    window.localStorage.setItem('qmail_read_state_QA', JSON.stringify({ a: 1 }))
    const store = makeStore()
    const { rerender } = render(
      <Provider store={store}>
        <Harness address="QA" />
      </Provider>
    )
    rerender(
      <Provider store={store}>
        <Harness address="QB" />
      </Provider>
    )
    expect(store.getState().mail.readState).toEqual({})
    expect(window.localStorage.getItem('qmail_read_state_QB')).toBe('{}')
    expect(JSON.parse(window.localStorage.getItem('qmail_read_state_QA') || '')).toEqual({ a: 1 })
    rerender(
      <Provider store={store}>
        <Harness address={undefined} />
      </Provider>
    )
    expect(store.getState().mail.readStateAddress).toBe('')
  })
})
