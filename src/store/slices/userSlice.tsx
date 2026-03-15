// src/store/slices/userSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import profileService, { ProfileData, UserCompany, ChangeRoleRequest, ChangeRoleResponse } from '../../services/ProfileService';
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
  async (user?: any) => {
    // Use the migrated Supabase-based profile service
    return await profileService.getCurrentUserProfile(user);
  }
);

// Create an async thunk to change user role
export const changeUserRole = createAsyncThunk<
  ChangeRoleResponse,
  ChangeRoleRequest,
  { rejectValue: string }
>(
  'user/changeRole',
  async (request, { rejectWithValue }) => {
    try {
      const response = await profileService.changeRole(request);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to change role');
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    updateUserCompanies: (state, action: PayloadAction<UserCompany[]>) => {
      state.companies = action.payload;
    },
    updateUserRole: (state, action: PayloadAction<string>) => {
      if (state.profile) {
        state.profile.role = action.payload;
      }
    },
    clearUserState: () => initialState,
  },
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
      })
      .addCase(changeUserRole.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(changeUserRole.fulfilled, (state, action: PayloadAction<ChangeRoleResponse>) => {
        state.status = 'succeeded';
        // Update user role and companies based on role change response
        if (state.profile) {
          state.profile.role = action.payload.newRole;
          state.companies = action.payload.affectedCompanies;
        }
      })
      .addCase(changeUserRole.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to change role';
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

export const { clearUserState, updateUserRole } = userSlice.actions;

export default userSlice.reducer;