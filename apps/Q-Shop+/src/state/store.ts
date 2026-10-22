import { configureStore } from '@reduxjs/toolkit'
import notificationsReducer from './features/notificationsSlice'
import authReducer from './features/authSlice'
import globalReducer from './features/globalSlice'
import storeReducer from './features/storeSlice'
import cartReducer from './features/cartSlice'
import orderReducer from './features/orderSlice'
import { writeStoredSettings } from '../utils/settingsStorage'
import { saveCarts } from './features/cartSlice'

const reducer = {
  notifications: notificationsReducer,
  auth: authReducer,
  global: globalReducer,
  store: storeReducer,
  cart: cartReducer,
  order: orderReducer
}

/** A fresh store; the app uses the one below, tests make their own. */
export function createAppStore() {
  return configureStore({
    reducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false
      })
  })
}

export const store = createAppStore()

// Remember the preferred coin between visits (Settings -> Shop).
let lastPreferredCoin = store.getState().store.preferredCoin
store.subscribe(() => {
  const next = store.getState().store.preferredCoin
  if (next !== lastPreferredCoin) {
    lastPreferredCoin = next
    writeStoredSettings({ preferredCoin: next })
  }
})

// Keep the carts between visits (the original kept them in memory only).
let lastCarts = store.getState().cart.carts
store.subscribe(() => {
  const next = store.getState().cart.carts
  if (next !== lastCarts) {
    lastCarts = next
    saveCarts(next)
  }
})

// Define the RootState type, which is the type of the entire Redux state tree.
// This is useful when you need to access the state in a component or elsewhere.
export type RootState = ReturnType<typeof store.getState>

// Define the AppDispatch type, which is the type of the Redux store's dispatch function.
// This is useful when you need to dispatch an action in a component or elsewhere.
export type AppDispatch = typeof store.dispatch
