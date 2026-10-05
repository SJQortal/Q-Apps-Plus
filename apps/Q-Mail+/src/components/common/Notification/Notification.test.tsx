import { describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import notificationsReducer, { setNotification } from '../../../state/features/notificationsSlice'
import Notification from './Notification'
import { IMPOSTOR, REAL, isStruck, nameElement, struckNames } from '../../../test/hiddenNames'

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

  it('strikes the impostor names a toast quotes, and nothing else', async () => {
    const store = makeStore()
    render(
      <Provider store={store}>
        <Notification />
      </Provider>
    )
    act(() => {
      store.dispatch(
        setNotification({ alertType: 'error', msg: `Could not add: ${IMPOSTOR}, ${REAL}`, names: [IMPOSTOR, REAL] })
      )
    })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(`Could not add: ${IMPOSTOR}`)
    expect(struckNames(alert)).toEqual([IMPOSTOR])
    expect(isStruck(nameElement(alert, IMPOSTOR))).toBe(true)
    // Consumed with its names: redux keeps strings only, and clears both.
    expect(store.getState().notifications.alertNames.alertError).toEqual([])
  })

  it('shows a toast without names exactly as before', async () => {
    const store = makeStore()
    render(
      <Provider store={store}>
        <Notification />
      </Provider>
    )
    act(() => {
      store.dispatch(setNotification({ alertType: 'info', msg: `Alias saved: ${IMPOSTOR}` }))
    })
    const status = await screen.findByRole('status')
    expect(struckNames(status)).toEqual([])
  })
})
