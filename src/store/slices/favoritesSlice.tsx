import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import propertyService from '../../services/PropertyService';
import { RootState } from '../store';
import { PublicProperty } from '../../models/properties';

interface FavoritesState {
  favoritePropertyIds: Set<string>;
  favoriteProperties: PublicProperty[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: FavoritesState = {
  favoritePropertyIds: new Set(),
  favoriteProperties: [],
  status: 'idle',
  error: null,
};

// Async thunk to fetch favorite properties as full objects
export const fetchFavoriteProperties = createAsyncThunk(
  'favorites/fetchFavoriteProperties',
  async () => {
    console.log('Fetching favorite properties...');
    const properties = await propertyService.getFavoriteProperties();
    console.log('Fetched favorite properties:', properties);
    return properties;
  }
);

// Async thunk to update favorite status
export const updatePropertyFavorite = createAsyncThunk(
  'favorites/updatePropertyFavorite',
  async ({ propertyId, isFavorite }: { propertyId: string; isFavorite: boolean }) => {
    console.log(`Updating favorite status for property ${propertyId} to ${isFavorite}`);
    await propertyService.updatePropertyFavorite(propertyId, isFavorite);
    console.log(`Successfully updated favorite status for property ${propertyId}`);
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
      // Fetch favorite property IDs
      .addCase(fetchFavoriteProperties.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchFavoriteProperties.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.favoriteProperties = action.payload;
        state.favoritePropertyIds = new Set(action.payload.map(prop => prop.id));
      })
      .addCase(fetchFavoriteProperties.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch favorite properties';
      })
      // Update favorite status
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
export const selectFavoriteProperties = (state: RootState) => state.favorites.favoriteProperties;
export const selectIsPropertyFavorite = (propertyId: string) => (state: RootState) => 
  state.favorites.favoritePropertyIds.has(propertyId);
export const selectFavoritesStatus = (state: RootState) => state.favorites.status;
export const selectFavoritesError = (state: RootState) => state.favorites.error;

// Actions
export const { initializeFavorites, clearFavorites } = favoritesSlice.actions;

export default favoritesSlice.reducer;
