import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import propertyService from '../../services/PropertyService';
import { RootState } from '../store';

interface FavoritesState {
  favoritePropertyIds: Set<string>;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: FavoritesState = {
  favoritePropertyIds: new Set(),
  status: 'idle',
  error: null,
};

// Async thunk to update favorite status
export const updatePropertyFavorite = createAsyncThunk(
  'favorites/updatePropertyFavorite',
  async ({ propertyId, isFavorite }: { propertyId: string; isFavorite: boolean }) => {
    await propertyService.updatePropertyFavorite(propertyId, isFavorite);
    return { propertyId, isFavorite };
  }
);

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    // Initialize favorites from localStorage or API
    initializeFavorites: (state, action: PayloadAction<string[]>) => {
      state.favoritePropertyIds = new Set(action.payload);
    },
    // Clear all favorites
    clearFavorites: (state) => {
      state.favoritePropertyIds.clear();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updatePropertyFavorite.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updatePropertyFavorite.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const { propertyId, isFavorite } = action.payload;
        if (isFavorite) {
          state.favoritePropertyIds.add(propertyId);
        } else {
          state.favoritePropertyIds.delete(propertyId);
        }
      })
      .addCase(updatePropertyFavorite.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to update favorite status';
      });
  },
});

// Selectors
export const selectFavoritePropertyIds = (state: RootState) => state.favorites.favoritePropertyIds;
export const selectIsPropertyFavorite = (propertyId: string) => (state: RootState) => 
  state.favorites.favoritePropertyIds.has(propertyId);
export const selectFavoritesStatus = (state: RootState) => state.favorites.status;
export const selectFavoritesError = (state: RootState) => state.favorites.error;

// Actions
export const { initializeFavorites, clearFavorites } = favoritesSlice.actions;

export default favoritesSlice.reducer;
