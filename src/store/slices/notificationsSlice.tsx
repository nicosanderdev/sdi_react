import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import messageService, { TabCounts } from '../../services/MessageService';

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

// Async thunk to fetch message counts
export const fetchMessageCounts = createAsyncThunk<TabCounts>(
  'notifications/fetchMessageCounts',
  async () => {
    const counts = await messageService.getMessageCounts();
    return counts;
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessageCounts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchMessageCounts.fulfilled, (state, action: PayloadAction<TabCounts>) => {
        state.status = 'succeeded';
        state.counts = action.payload;
      })
      .addCase(fetchMessageCounts.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch message counts';
      });
  },
});

export default notificationsSlice.reducer;

