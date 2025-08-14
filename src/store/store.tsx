import { configureStore } from '@reduxjs/toolkit';
import notificationsReducer from './slices/notificationsSlice';
import userReducer from './slices/userSlice';

export const store = configureStore({
  reducer: {
    notifications: notificationsReducer,
    user: userReducer
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;