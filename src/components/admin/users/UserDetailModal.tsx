// src/components/admin/users/UserDetailModal.tsx
import React from 'react';
import { Modal, Button, Badge, Avatar, Tabs, Card } from 'flowbite-react';
import {
  CalendarIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  CreditCardIcon,
  UserIcon,
  ShieldIcon,
  ClockIcon
} from 'lucide-react';
import { UserDetail, SubscriptionTier } from '../../../services/UserAdminService';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface UserDetailModalProps {
  hook: UseAdminUsersReturn;
}

const getSubscriptionTierLabel = (tier: number | null): string => {
  switch (tier) {
    case SubscriptionTier.Free: return 'Free';
    case SubscriptionTier.Manager: return 'Manager';
    case SubscriptionTier.CompanySmall: return 'Company Small';
    case SubscriptionTier.CompanyUnlimited: return 'Company Unlimited';
    case SubscriptionTier.ManagerPro: return 'Manager Pro';
    default: return 'None';
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'active': return 'success';
    case 'suspended': return 'warning';
    case 'deleted': return 'failure';
    default: return 'gray';
  }
};

const getSubscriptionStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'active': return 'success';
    case 'expired': return 'warning';
    case 'none': return 'gray';
    default: return 'gray';
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getFullName = (user: UserDetail): string => {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  return `${firstName} ${lastName}`.trim() || 'Unknown User';
};

const getActionTypeLabel = (actionType: string): string => {
  switch (actionType) {
    case 'suspend': return 'Suspended';
    case 'reactivate': return 'Reactivated';
    case 'role_change': return 'Role Changed';
    case 'reset_onboarding': return 'Onboarding Reset';
    case 'force_logout': return 'Force Logout';
    case 'delete': return 'Deleted';
    default: return actionType;
  }
};

export const UserDetailModal: React.FC<UserDetailModalProps> = ({ hook }) => {
  const {
    selectedUser,
    detailModalOpen,
    closeDetailModal,
    userDetailLoading,
    suspendUser,
    reactivateUser,
    resetOnboarding,
    forceLogout,
    updateUserRole,
    openDeleteConfirmModal,
  } = hook;

  if (!selectedUser) return null;

  const handleQuickAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleSuspend = () => handleQuickAction(() => suspendUser(selectedUser.id, 'Suspended by admin'));
  const handleReactivate = () => handleQuickAction(() => reactivateUser(selectedUser.id));
  const handleResetOnboarding = () => handleQuickAction(() => resetOnboarding(selectedUser.id));
  const handleForceLogout = () => handleQuickAction(() => forceLogout(selectedUser.id, 'Forced logout by admin'));
  const handleDelete = () => openDeleteConfirmModal(selectedUser);

  return (
    <Modal
      show={detailModalOpen}
      onClose={closeDetailModal}
      size="4xl"
      className="h-full"
    >
      <Modal.Header>
        <div className="flex items-center space-x-3">
          <Avatar
            img={selectedUser.avatarUrl || undefined}
            placeholderInitials={getFullName(selectedUser).split(' ').map(n => n[0]).join('').toUpperCase()}
            rounded
            size="lg"
          />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {getFullName(selectedUser)}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedUser.email}
            </p>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        {userDetailLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        ) : (
          <Tabs.Group aria-label="User details tabs" style="underline">
            {/* Profile Tab */}
            <Tabs.Item active title="Profile" icon={UserIcon}>
              <div className="space-y-6">
                {/* Quick Actions */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Quick Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.accountStatus === 'active' ? (
                      <Button color="warning" size="sm" onClick={handleSuspend}>
                        Suspend User
                      </Button>
                    ) : (
                      <Button color="success" size="sm" onClick={handleReactivate}>
                        Reactivate User
                      </Button>
                    )}
                    <Button color="light" size="sm" onClick={handleResetOnboarding}>
                      Reset Onboarding
                    </Button>
                    <Button color="light" size="sm" onClick={handleForceLogout}>
                      Force Logout
                    </Button>
                    <Button
                      color="failure"
                      size="sm"
                      onClick={handleDelete}
                      className="ml-auto"
                    >
                      Delete User
                    </Button>
                  </div>
                </Card>

                {/* Basic Information */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Full Name:</span>
                        <span>{getFullName(selectedUser)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MailIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Email:</span>
                        <span>{selectedUser.email}</span>
                      </div>
                      {selectedUser.phone && (
                        <div className="flex items-center space-x-2">
                          <PhoneIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium">Phone:</span>
                          <span>{selectedUser.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <ShieldIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Role:</span>
                        <Badge color={selectedUser.roles.includes('admin') ? 'purple' : 'gray'}>
                          {selectedUser.roles.includes('admin') ? 'Admin' : 'User'}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Status:</span>
                        <Badge color={getStatusBadgeColor(selectedUser.accountStatus)}>
                          {selectedUser.accountStatus.charAt(0).toUpperCase() + selectedUser.accountStatus.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium">Registered:</span>
                        <span>{formatDate(selectedUser.registrationDate)}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Address Information */}
                {(selectedUser.street || selectedUser.city || selectedUser.country) && (
                  <Card>
                    <h4 className="text-md font-semibold mb-4">Address</h4>
                    <div className="space-y-2">
                      {selectedUser.street && (
                        <div className="flex items-center space-x-2">
                          <MapPinIcon className="w-4 h-4 text-gray-400" />
                          <span>{selectedUser.street}</span>
                        </div>
                      )}
                      {selectedUser.street2 && (
                        <div className="flex items-center space-x-2">
                          <span className="ml-6">{selectedUser.street2}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <span className="ml-6">
                          {[selectedUser.city, selectedUser.state, selectedUser.postalCode].filter(Boolean).join(', ')}
                        </span>
                      </div>
                      {selectedUser.country && (
                        <div className="flex items-center space-x-2">
                          <span className="ml-6">{selectedUser.country}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </Tabs.Item>

            {/* Subscription Tab */}
            <Tabs.Item title="Subscription" icon={CreditCardIcon}>
              <Card>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold">Current Subscription</h4>
                    <Badge color={getSubscriptionStatusBadgeColor(selectedUser.subscriptionStatus)} size="lg">
                      {selectedUser.subscriptionStatus.charAt(0).toUpperCase() + selectedUser.subscriptionStatus.slice(1)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Plan:</span>
                        <p className="text-lg font-semibold">{getSubscriptionTierLabel(selectedUser.subscriptionTier)}</p>
                      </div>
                      {selectedUser.subscriptionExpiresAt && (
                        <div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Expires:</span>
                          <p>{formatDate(selectedUser.subscriptionExpiresAt)}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Properties:</span>
                        <p className="text-lg font-semibold">{selectedUser.propertiesCount}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Status:</span>
                        <Badge color={getSubscriptionStatusBadgeColor(selectedUser.paymentStatus)}>
                          {selectedUser.paymentStatus.charAt(0).toUpperCase() + selectedUser.paymentStatus.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Tabs.Item>

            {/* Activity Tab */}
            <Tabs.Item title="Activity History" icon={ClockIcon}>
              <Card>
                <h4 className="text-md font-semibold mb-4">Recent Actions</h4>
                {selectedUser.actionHistory && selectedUser.actionHistory.length > 0 ? (
                  <div className="space-y-3">
                    {selectedUser.actionHistory.map((action, index) => (
                      <div key={action.id || index} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{getActionTypeLabel(action.actionType)}</span>
                            <Badge color="gray" size="sm">
                              {action.performedBy.name}
                            </Badge>
                          </div>
                          {action.actionDetails && Object.keys(action.actionDetails).length > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {action.actionDetails.reason || JSON.stringify(action.actionDetails)}
                            </p>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(action.performedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No action history available.</p>
                )}
              </Card>
            </Tabs.Item>
          </Tabs.Group>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button color="gray" onClick={closeDetailModal}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
