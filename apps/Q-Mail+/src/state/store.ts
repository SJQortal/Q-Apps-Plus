import { configureStore } from "@reduxjs/toolkit";
// import imagesReducer from "./features/imagesSlice";
import notificationsReducer from "./features/notificationsSlice";
import authReducer from "./features/authSlice";
import globalReducer from "./features/globalSlice";
import blogReducer from "./features/blogSlice";
import mailReducer from './features/mailSlice'

export const store = configureStore({
  reducer: {
    // images: imagesReducer,
    notifications: notificationsReducer,
    auth: authReducer,
    global: globalReducer,
    blog: blogReducer,
    mail: mailReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }),
  preloadedState: undefined // optional, can be any valid state object
})

// Define the RootState type, which is the type of the entire Redux state tree.
// This is useful when you need to access the state in a component or elsewhere.
export type RootState = ReturnType<typeof store.getState>;

// Define the AppDispatch type, which is the type of the Redux store's dispatch function.
// This is useful when you need to dispatch an action in a component or elsewhere.
export type AppDispatch = typeof store.dispatch;
