import { configureStore } from '@reduxjs/toolkit';
import roomReducer from './slices/roomSlice';

export const store = configureStore({
  reducer: {
    room: roomReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['room/setLocalStream', 'room/addConsumer'],
        ignoredPaths: ['room.localStream', 'room.consumers'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
