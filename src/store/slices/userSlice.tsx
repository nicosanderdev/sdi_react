// src/store/slices/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import profileService, { ProfileData } from '../../services/ProfileService'; // Adjust path as needed
import { RootState } from '../store'; // We'll create this or you have it

interface UserState {
  profile: ProfileData | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: UserState = {
  profile: null,
  status: 'idle',
  error: null,
};

// Create an async thunk to fetch the user profile
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async () => {
    const response = await profileService.getCurrentUserProfile();
    return response;
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUserProfile.fulfilled, (state, action: PayloadAction<ProfileData>) => {
        state.status = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch profile';
      });
  },
});

// Selector to get the user profile from the state
export const selectUserProfile = (state: RootState) => state.user.profile;
export const selectUserStatus = (state: RootState) => state.user.status;

export default userSlice.reducer;