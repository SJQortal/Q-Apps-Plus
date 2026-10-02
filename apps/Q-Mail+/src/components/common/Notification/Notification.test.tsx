import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import notificationsReducer, { setNotification } from '../../../state/features/notificationsSlice'
import Notification from './Notification'

function makeStore() {
  return configureStore({ reducer: { notifications: notificationsReducer } })
}

describe('Notification', () => {
  it('shows a redux notification as an Alert and clears it from the store in an effect', async () => {
    const store = makeStore()
    render(
      <Provider store={store}>
        <Notification />
      </Provider>
    )
    act(() => {
      store.dispatch(setNotification({ alertType: 'success', msg: 'Mail sent' }))
    })
    expect(await screen.findByText('Mail sent')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
    // Consumed: the slice is empty again, so the same toast cannot repeat.
    expect(store.getState().notifications.alertTypes.alertSuccess).toBe('')
  })

  it('uses role=alert for errors and queues a second message behind the first', async () => {
    const store = makeStore()
    render(
      <Provider store={store}>
        <Notification />
      </Provider>
    )
    act(() => {
      store.dispatch(setNotification({ alertType: 'error', msg: 'Could not publish' }))
    })
    expect(await screen.findByRole('alert')).toBeTruthy()
    act(() => {
      store.dispatch(setNotification({ alertType: 'info', msg: 'Copied' }))
    })
    // Still the first toast; the second waits its turn.
    expect(screen.getByText('Could not publish')).toBeTruthy()
    expect(screen.queryByText('Copied')).toBeNull()
    expect(store.getState().notifications.alertTypes.alertInfo).toBe('')
  })
})
