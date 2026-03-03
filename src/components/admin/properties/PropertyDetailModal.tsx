// src/components/admin/properties/PropertyDetailModal.tsx
import React from 'react';
import { Modal, ModalBody, ModalHeader, ModalFooter, Button, Badge, Tabs, TabItem, Card } from 'flowbite-react';
import {
  CalendarIcon,
  MapPinIcon,
  HomeIcon,
  DollarSignIcon,
  EyeIcon,
  EyeOffIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon
} from 'lucide-react';
import { UseAdminPropertiesReturn } from '../../../hooks/useAdminProperties';

interface PropertyDetailModalProps {
  hook: UseAdminPropertiesReturn;
}

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'sale': return 'success';
    case 'rent': return 'info';
    case 'reserved': return 'warning';
    case 'sold': return 'gray';
    case 'unavailable': return 'failure';
    default: return 'gray';
  }
};

const getVisibilityBadgeColor = (isVisible: boolean) => {
  return isVisible ? 'success' : 'failure';
};

const getActivityBadgeColor = (isActive: boolean) => {
  return isActive ? 'success' : 'warning';
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

const formatCurrency = (amount: number | null, currency: number): string => {
  if (amount === null) return 'Not set';

  const currencySymbols: { [key: number]: string } = {
    0: '$', // USD
    1: '$', // UYU
    2: 'R$', // BRL
    3: '€', // EUR
    4: '£', // GBP
  };

  const symbol = currencySymbols[currency] || '$';
  return `${symbol}${amount.toLocaleString()}`;
};

const getPropertyTypeLabel = (type: number): string => {
  const types = ['House', 'Apartment', 'Commercial', 'Land', 'Other'];
  return types[type] || 'Unknown';
};

const getAreaUnitLabel = (unit: number): string => {
  const units = ['m²', 'ft²', 'yd²', 'acres', 'hectares', 'sq_km', 'sq_mi'];
  return units[unit] || 'm²';
};

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({ hook }) => {
  const {
    selectedProperty,
    detailModalOpen,
    closeDetailModal,
    propertyDetailLoading,
    hideProperty,
    markPropertyInvalid,
    openDeleteConfirmModal,
  } = hook;

  if (!selectedProperty) return null;

  const handleQuickAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleHide = () => handleQuickAction(() => hideProperty(selectedProperty.id, 'Hidden by admin'));
  const handleMarkInvalid = () => handleQuickAction(() => markPropertyInvalid(selectedProperty.id, 'Marked as invalid by admin'));
  const handleDelete = () => openDeleteConfirmModal(selectedProperty);

  return (
    <Modal
      show={detailModalOpen}
      onClose={closeDetailModal}
      size="4xl"
      className="h-full"
    >
      <ModalHeader>
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <HomeIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedProperty.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedProperty.city}, {selectedProperty.state}
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody>
        {propertyDetailLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        ) : (
          <Tabs aria-label="Property details tabs" style="underline">
            {/* Overview Tab */}
            <TabItem active title="Overview" icon={HomeIcon}>
              <div className="space-y-6">
                {/* Quick Actions */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Quick Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedProperty.isPropertyVisible ? (
                      <Button
                        size="sm"
                        color="gray"
                        onClick={handleHide}
                        className="flex items-center space-x-2"
                      >
                        <EyeOffIcon className="w-4 h-4" />
                        <span>Hide Property</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        color="gray"
                        disabled
                        className="flex items-center space-x-2 opacity-50 cursor-not-allowed"
                      >
                        <EyeOffIcon className="w-4 h-4" />
                        <span>Already Hidden</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      color="yellow"
                      onClick={handleMarkInvalid}
                      className="flex items-center space-x-2"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      <span>Mark Invalid</span>
                    </Button>

                    <Button
                      size="sm"
                      color="failure"
                      onClick={handleDelete}
                      className="flex items-center space-x-2"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      <span>Delete Property</span>
                    </Button>
                  </div>
                </Card>

                {/* Property Status */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Property Status</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                      <Badge color={getStatusBadgeColor(selectedProperty.status.toString())} className="mt-1">
                        {selectedProperty.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Visibility</p>
                      <Badge color={getVisibilityBadgeColor(selectedProperty.isPropertyVisible)} className="mt-1">
                        {selectedProperty.isPropertyVisible ? 'Visible' : 'Hidden'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Activity</p>
                      <Badge color={getActivityBadgeColor(selectedProperty.isActive)} className="mt-1">
                        {selectedProperty.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Featured</p>
                      <Badge color={selectedProperty.isFeatured ? 'success' : 'gray'} className="mt-1">
                        {selectedProperty.isFeatured ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </Card>

                {/* Basic Information */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <HomeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Type: {getPropertyTypeLabel(selectedProperty.type)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Location: {selectedProperty.streetName} {selectedProperty.houseNumber}, {selectedProperty.city}, {selectedProperty.state}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <HomeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Size: {selectedProperty.areaValue} {getAreaUnitLabel(selectedProperty.areaUnit)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <HomeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Bedrooms: {selectedProperty.bedrooms}, Bathrooms: {selectedProperty.bathrooms}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <HomeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Garage: {selectedProperty.hasGarage ? `${selectedProperty.garageSpaces} spaces` : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <UserIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          Capacity: {selectedProperty.capacity} people
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Pricing */}
                {(selectedProperty.salePrice || selectedProperty.rentPrice) && (
                  <Card>
                    <h4 className="text-md font-semibold mb-4">Pricing</h4>
                    <div className="space-y-2">
                      {selectedProperty.salePrice && (
                        <div className="flex items-center space-x-2">
                          <DollarSignIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            Sale Price: {formatCurrency(selectedProperty.salePrice, selectedProperty.currency)}
                          </span>
                        </div>
                      )}
                      {selectedProperty.rentPrice && (
                        <div className="flex items-center space-x-2">
                          <DollarSignIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            Rent Price: {formatCurrency(selectedProperty.rentPrice, selectedProperty.currency)}
                          </span>
                        </div>
                      )}
                      {selectedProperty.hasCommonExpenses && selectedProperty.commonExpensesValue && (
                        <div className="flex items-center space-x-2">
                          <DollarSignIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            Common Expenses: {formatCurrency(selectedProperty.commonExpensesValue, selectedProperty.currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Dates */}
                <Card>
                  <h4 className="text-md font-semibold mb-4">Important Dates</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Available From: {formatDate(selectedProperty.availableFrom)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Created: {formatDate(selectedProperty.created)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Last Modified: {formatDate(selectedProperty.lastModified)}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </TabItem>

            {/* Owner Tab */}
            <TabItem title="Owner" icon={UserIcon}>
              <Card>
                <h4 className="text-md font-semibold mb-4">Owner Information</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedProperty.ownerName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedProperty.ownerEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Owner ID</p>
                    <p className="text-sm font-mono text-gray-600 dark:text-gray-300">{selectedProperty.ownerId}</p>
                  </div>
                </div>
              </Card>
            </TabItem>

            {/* Description Tab */}
            {selectedProperty.description && (
              <TabItem title="Description" icon={HomeIcon}>
                <Card>
                  <h4 className="text-md font-semibold mb-4">Property Description</h4>
                  <div className="prose dark:prose-invert max-w-none">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedProperty.description}
                    </p>
                  </div>
                </Card>
              </TabItem>
            )}
          </Tabs>
        )}
      </ModalBody>

      <ModalFooter>
        <Button color="gray" onClick={closeDetailModal}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};
