import React, { useEffect, useState } from 'react';
import { Modal, Button } from 'flowbite-react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Info,
  X
} from 'lucide-react';
import { SubscriptionNotification } from '../../store/slices/subscriptionSlice';

interface SubscriptionNotificationModalProps {
  notification: SubscriptionNotification | null;
  isOpen: boolean;
  onClose: () => void;
  onDismiss?: () => void;
}

const getIcon = (type: SubscriptionNotification['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-8 h-8 text-green-600" />;
    case 'warning':
      return <AlertTriangle className="w-8 h-8 text-yellow-600" />;
    case 'error':
      return <XCircle className="w-8 h-8 text-red-600" />;
    case 'info':
    default:
      return <Info className="w-8 h-8 text-blue-600" />;
  }
};

const getBackgroundColor = (type: SubscriptionNotification['type']) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-200';
    case 'warning':
      return 'bg-yellow-50 border-yellow-200';
    case 'error':
      return 'bg-red-50 border-red-200';
    case 'info':
    default:
      return 'bg-blue-50 border-blue-200';
  }
};

const getTitleColor = (type: SubscriptionNotification['type']) => {
  switch (type) {
    case 'success':
      return 'text-green-900';
    case 'warning':
      return 'text-yellow-900';
    case 'error':
      return 'text-red-900';
    case 'info':
    default:
      return 'text-blue-900';
  }
};

const getMessageColor = (type: SubscriptionNotification['type']) => {
  switch (type) {
    case 'success':
      return 'text-green-800';
    case 'warning':
      return 'text-yellow-800';
    case 'error':
      return 'text-red-800';
    case 'info':
    default:
      return 'text-blue-800';
  }
};

export function SubscriptionNotificationModal({
  notification,
  isOpen,
  onClose,
  onDismiss
}: SubscriptionNotificationModalProps) {
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && notification?.autoHide && notification.duration) {
      const timer = setTimeout(() => {
        onClose();
        if (onDismiss) onDismiss();
      }, notification.duration);
      setAutoHideTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [isOpen, notification, onClose, onDismiss]);

  const handleClose = () => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      setAutoHideTimer(null);
    }
    onClose();
  };

  if (!notification) return null;

  return (
    <Modal
      show={isOpen}
      size="md"
      onClose={handleClose}
      className="subscription-notification-modal"
    >
      <div className={`p-6 rounded-lg border-2 ${getBackgroundColor(notification.type)}`}>
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {getIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold ${getTitleColor(notification.type)} mb-2`}>
              {notification.title}
            </h3>
            <p className={`text-sm ${getMessageColor(notification.type)}`}>
              {notification.message}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Close notification"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex justify-end mt-6 space-x-3">
          {onDismiss && (
            <Button
              color="gray"
              size="sm"
              onClick={() => {
                handleClose();
                onDismiss();
              }}
            >
              Dismiss
            </Button>
          )}
          <Button
            color="primary"
            size="sm"
            onClick={handleClose}
          >
            OK
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Toast version for less intrusive notifications
interface SubscriptionNotificationToastProps {
  notification: SubscriptionNotification;
  onClose: () => void;
  onDismiss?: () => void;
}

export function SubscriptionNotificationToast({
  notification,
  onClose,
  onDismiss
}: SubscriptionNotificationToastProps) {
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (notification?.autoHide && notification.duration) {
      const timer = setTimeout(() => {
        onClose();
        if (onDismiss) onDismiss();
      }, notification.duration);
      setAutoHideTimer(timer);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [notification, onClose, onDismiss]);

  const handleClose = () => {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      setAutoHideTimer(null);
    }
    onClose();
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full p-4 rounded-lg border-2 shadow-lg ${getBackgroundColor(notification.type)}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon(notification.type)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-semibold ${getTitleColor(notification.type)}`}>
            {notification.title}
          </h4>
          <p className={`text-sm ${getMessageColor(notification.type)} mt-1`}>
            {notification.message}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    </div>
  );
}

