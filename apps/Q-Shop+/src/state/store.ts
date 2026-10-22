import { configureStore } from '@reduxjs/toolkit'
import notificationsReducer from './features/notificationsSlice'
import authReducer from './features/authSlice'
import globalReducer from './features/globalSlice'
import storeReducer from './features/storeSlice'
import cartReducer from './features/cartSlice'
import orderReducer from './features/orderSlice'
import { writeStoredSettings } from '../utils/settingsStorage'
import { loadStoredCarts, replaceCarts, saveCarts } from './features/cartSlice'
import { CART_STORAGE_KEY } from '../constants/plus'

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

/**
 * Keeps the carts between visits (the original kept them in memory only),
 * and in step with the app's other tabs: Hub's tabs share one origin, so
 * they share the stored carts. Every change here is saved; a save by another
 * tab replaces this tab's carts. Without that, a tab still holding a cart
 * another tab had just paid for wrote those lines back on its next change,
 * and offered to check them out again. Returns the unsubscribe.
 */
export function persistCarts(target: ReturnType<typeof createAppStore>): () => void {
  let lastCarts = target.getState().cart.carts
  let fromOtherTab = false
  const unsubscribe = target.subscribe(() => {
    const next = target.getState().cart.carts
    if (next !== lastCarts) {
      lastCarts = next
      // What another tab saved is in storage already: don't write it back.
      if (!fromOtherTab) saveCarts(next)
    }
  })
  if (typeof window === 'undefined') return unsubscribe
  const onStorage = (event: StorageEvent) => {
    // A null key: the other tab cleared this origin's storage.
    if (event.key !== CART_STORAGE_KEY && event.key !== null) return
    fromOtherTab = true
    try {
      target.dispatch(replaceCarts(loadStoredCarts()))
    } finally {
      fromOtherTab = false
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    unsubscribe()
    window.removeEventListener('storage', onStorage)
  }
}

persistCarts(store)

// Define the RootState type, which is the type of the entire Redux state tree.
// This is useful when you need to access the state in a component or elsewhere.
export type RootState = ReturnType<typeof store.getState>

// Define the AppDispatch type, which is the type of the Redux store's dispatch function.
// This is useful when you need to dispatch an action in a component or elsewhere.
export type AppDispatch = typeof store.dispatch
