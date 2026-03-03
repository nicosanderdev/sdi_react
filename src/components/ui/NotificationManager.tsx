import React from 'react';
import { useSelector } from 'react-redux';
import { selectSubscriptionNotifications } from '../../store/slices/subscriptionSlice';
import { SubscriptionNotificationModal, SubscriptionNotificationToast } from './SubscriptionNotificationModal';
import { useSubscriptionNotifications } from '../../hooks/useSubscriptionNotifications';

export function NotificationManager() {
  const notifications = useSelector(selectSubscriptionNotifications);
  const { dismissNotification } = useSubscriptionNotifications();

  // Get the most recent notification
  const currentNotification = notifications.length > 0 ? notifications[notifications.length - 1] : null;

  if (!currentNotification) return null;

  return (
    <>
      {/* Modal notification for important messages */}
      {currentNotification.type === 'error' || currentNotification.type === 'warning' ? (
        <SubscriptionNotificationModal
          notification={currentNotification}
          isOpen={true}
          onClose={() => dismissNotification(currentNotification.id)}
        />
      ) : (
        /* Toast notification for success and info messages */
        <SubscriptionNotificationToast
          notification={currentNotification}
          onClose={() => dismissNotification(currentNotification.id)}
        />
      )}
    </>
  );
}

