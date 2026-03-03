import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SubscriptionData } from '../../models/subscriptions/SubscriptionData';
import subscriptionService from '../../services/SubscriptionService';

export interface SubscriptionNotification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  autoHide?: boolean;
  duration?: number;
}

export interface RoleChangeWarning {
  isVisible: boolean;
  newRole: string;
  affectedCompanies: string[];
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface SubscriptionState {
  currentSubscription: SubscriptionData | null;
  notifications: SubscriptionNotification[];
  roleChangeWarning: RoleChangeWarning;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: SubscriptionState = {
  currentSubscription: null,
  notifications: [],
  roleChangeWarning: {
    isVisible: false,
    newRole: '',
    affectedCompanies: [],
  },
  status: 'idle',
  error: null,
};

// Async thunks
export const fetchCurrentSubscription = createAsyncThunk<SubscriptionData>(
  'subscription/fetchCurrent',
  async () => {
    return await subscriptionService.getCurrentSubscription();
  }
);

export const fetchSubscriptionStatus = createAsyncThunk<SubscriptionData>(
  'subscription/fetchStatus',
  async () => {
    return await subscriptionService.getSubscriptionStatus();
  }
);

const subscriptionSlice = createSlice({
  name: 'subscription',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Omit<SubscriptionNotification, 'id' | 'timestamp'>>) => {
      const notification: SubscriptionNotification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    showRoleChangeWarning: (state, action: PayloadAction<Omit<RoleChangeWarning, 'isVisible'>>) => {
      state.roleChangeWarning = {
        ...action.payload,
        isVisible: true,
      };
    },
    hideRoleChangeWarning: (state) => {
      state.roleChangeWarning = {
        isVisible: false,
        newRole: '',
        affectedCompanies: [],
        onConfirm: undefined,
        onCancel: undefined,
      };
    },
    setCurrentSubscription: (state, action: PayloadAction<SubscriptionData | null>) => {
      state.currentSubscription = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentSubscription.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchCurrentSubscription.fulfilled, (state, action: PayloadAction<SubscriptionData>) => {
        state.status = 'succeeded';
        state.currentSubscription = action.payload;
      })
      .addCase(fetchCurrentSubscription.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch subscription';
      })
      .addCase(fetchSubscriptionStatus.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchSubscriptionStatus.fulfilled, (state, action: PayloadAction<SubscriptionData>) => {
        state.status = 'succeeded';
        state.currentSubscription = action.payload;
      })
      .addCase(fetchSubscriptionStatus.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch subscription status';
      });
  },
});

export const {
  addNotification,
  removeNotification,
  clearNotifications,
  showRoleChangeWarning,
  hideRoleChangeWarning,
  setCurrentSubscription,
} = subscriptionSlice.actions;

// Selectors
export const selectCurrentSubscription = (state: any) => state.subscription.currentSubscription;
export const selectSubscriptionNotifications = (state: any) => state.subscription.notifications;
export const selectRoleChangeWarning = (state: any) => state.subscription.roleChangeWarning;
export const selectSubscriptionStatus = (state: any) => state.subscription.status;

export default subscriptionSlice.reducer;

