// src/store/slices/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import profileService, { ProfileData, UserCompany } from '../../services/ProfileService';
import { RootState } from '../store';

interface UserState {
  profile: ProfileData | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  companies: UserCompany[];
}

const initialState: UserState = {
  profile: null,
  status: 'idle',
  error: null,
  companies: [],
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
        state.companies = action.payload.companies || [];
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch profile';
      });
  },
});

// Selectors
export const selectUserProfile = (state: RootState) => state.user.profile;
export const selectUserStatus = (state: RootState) => state.user.status;

// Company selectors
export const selectUserCompanies = (state: RootState) => state.user.companies;
export const selectHasCompanies = (state: RootState) => state.user.companies.length > 0;
export const selectDefaultCompany = (state: RootState) => 
  state.user.companies.length > 0 ? state.user.companies[0] : null;
export default userSlice.reducer;