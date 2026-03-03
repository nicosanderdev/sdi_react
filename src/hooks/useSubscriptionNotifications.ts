import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addNotification,
  removeNotification,
  clearNotifications,
  selectSubscriptionNotifications
} from '../store/slices/subscriptionSlice';
import { SubscriptionNotification } from '../store/slices/subscriptionSlice';

export function useSubscriptionNotifications() {
  const dispatch = useDispatch();
  const notifications = useSelector(selectSubscriptionNotifications);

  const showNotification = useCallback((
    type: SubscriptionNotification['type'],
    title: string,
    message: string,
    options?: {
      autoHide?: boolean;
      duration?: number;
    }
  ) => {
    dispatch(addNotification({
      type,
      title,
      message,
      autoHide: options?.autoHide ?? true,
      duration: options?.duration ?? 5000, // Default 5 seconds
    }));
  }, [dispatch]);

  const showSuccessNotification = useCallback((title: string, message: string) => {
    showNotification('success', title, message);
  }, [showNotification]);

  const showWarningNotification = useCallback((title: string, message: string) => {
    showNotification('warning', title, message);
  }, [showNotification]);

  const showErrorNotification = useCallback((title: string, message: string) => {
    showNotification('error', title, message, { autoHide: false }); // Errors don't auto-hide
  }, [showNotification]);

  const showInfoNotification = useCallback((title: string, message: string) => {
    showNotification('info', title, message);
  }, [showNotification]);

  const dismissNotification = useCallback((id: string) => {
    dispatch(removeNotification(id));
  }, [dispatch]);

  const clearAllNotifications = useCallback(() => {
    dispatch(clearNotifications());
  }, [dispatch]);

  // Predefined notification helpers for common subscription actions
  const showSubscriptionSuccess = useCallback((planName: string) => {
    showSuccessNotification(
      'Subscription Activated',
      `Your subscription to ${planName} has been successfully activated. You now have access to all premium features.`
    );
  }, [showSuccessNotification]);

  const showSubscriptionCancelled = useCallback((planName: string) => {
    showWarningNotification(
      'Subscription Cancelled',
      `Your subscription to ${planName} has been cancelled. You will retain access until the end of your billing period.`
    );
  }, [showWarningNotification]);

  const showSubscriptionChanged = useCallback((newPlanName: string) => {
    showSuccessNotification(
      'Subscription Updated',
      `Your subscription has been successfully changed to ${newPlanName}. The change will take effect immediately.`
    );
  }, [showSuccessNotification]);

  const showRoleChangeSuccess = useCallback((newRole: string) => {
    showSuccessNotification(
      'Role Updated',
      `Your role has been successfully changed to ${newRole}.`
    );
  }, [showSuccessNotification]);

  const showPaymentError = useCallback(() => {
    showErrorNotification(
      'Payment Failed',
      'There was an error processing your payment. Please check your payment information and try again.'
    );
  }, [showErrorNotification]);

  return {
    notifications,
    showNotification,
    showSuccessNotification,
    showWarningNotification,
    showErrorNotification,
    showInfoNotification,
    dismissNotification,
    clearAllNotifications,
    // Predefined helpers
    showSubscriptionSuccess,
    showSubscriptionCancelled,
    showSubscriptionChanged,
    showRoleChangeSuccess,
    showPaymentError,
  };
}

