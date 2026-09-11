import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TabCounts } from '../../services/MessageService';
import BookingService from '../../services/BookingService';
import { BookingStatus } from '../../models/calendar/CalendarSync';

interface NotificationsState {
  counts: TabCounts;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: NotificationsState = {
  counts: {},
  status: 'idle',
  error: null,
};

// Async thunk to fetch pending bookings count
// Messaging counts are out of scope for this version (messageService.getMessageCounts kept for later)
export const fetchNotificationCounts = createAsyncThunk<TabCounts>(
  'notifications/fetchNotificationCounts',
  async () => {
    const ownerBookingsRes = await BookingService.getOwnerBookings();
    const pendingBookings =
      ownerBookingsRes.succeeded && ownerBookingsRes.data
        ? ownerBookingsRes.data.filter((b) => b.Status === BookingStatus.Pending).length
        : 0;
    return { pendingBookings };
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotificationCounts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchNotificationCounts.fulfilled, (state, action: PayloadAction<TabCounts>) => {
        state.status = 'succeeded';
        state.counts = action.payload;
      })
      .addCase(fetchNotificationCounts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch notification counts';
      });
  },
});

export default notificationsSlice.reducer;
