// src/components/admin/users/UserFilters.tsx
import React, { useState } from 'react';
import { Button, Select, TextInput } from 'flowbite-react';
import { SearchIcon, XIcon } from 'lucide-react';
import { SubscriptionStatus, AccountStatus, SubscriptionTier } from '../../../services/UserAdminService';
import { UseAdminUsersReturn } from '../../../hooks/useAdminUsers';

interface UserFiltersProps {
  hook: UseAdminUsersReturn;
}

export const UserFilters: React.FC<UserFiltersProps> = ({ hook }) => {
  const { filters, updateFilters, clearFilters } = hook;

  // Local state for date inputs
  const [registrationDateFrom, setRegistrationDateFrom] = useState<string>(
    filters.registrationDateFrom || ''
  );
  const [registrationDateTo, setRegistrationDateTo] = useState<string>(
    filters.registrationDateTo || ''
  );

  const handleSearchChange = (value: string) => {
    updateFilters({ search: value || undefined });
  };

  const handleSubscriptionStatusChange = (value: string) => {
    updateFilters({
      subscriptionStatus: value === 'all' ? undefined : (value as SubscriptionStatus)
    });
  };

  const handleSubscriptionTierChange = (value: string) => {
    const tier = value === 'all' ? undefined : parseInt(value);
    updateFilters({ subscriptionTier: tier });
  };

  const handleAccountStatusChange = (value: string) => {
    updateFilters({
      accountStatus: value === 'all' ? undefined : (value as AccountStatus)
    });
  };

  const handleDateChange = () => {
    updateFilters({
      registrationDateFrom: registrationDateFrom || undefined,
      registrationDateTo: registrationDateTo || undefined,
    });
  };

  const clearDateFilters = () => {
    setRegistrationDateFrom('');
    setRegistrationDateTo('');
    updateFilters({
      registrationDateFrom: undefined,
      registrationDateTo: undefined,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.subscriptionStatus ||
    filters.subscriptionTier !== undefined ||
    filters.accountStatus ||
    filters.registrationDateFrom ||
    filters.registrationDateTo;

  const subscriptionTierOptions = [
    { value: 'all', label: 'All Plans' },
    { value: SubscriptionTier.Free.toString(), label: 'Free' },
    { value: SubscriptionTier.Manager.toString(), label: 'Manager' },
    { value: SubscriptionTier.CompanySmall.toString(), label: 'Company Small' },
    { value: SubscriptionTier.CompanyUnlimited.toString(), label: 'Company Unlimited' },
    { value: SubscriptionTier.ManagerPro.toString(), label: 'Manager Pro' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex flex-col space-y-4">
        {/* Search */}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <TextInput
              type="text"
              placeholder="Search by name or email..."
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              icon={SearchIcon}
              className="w-full"
            />
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Subscription Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subscription Status
            </label>
            <Select
              value={filters.subscriptionStatus || 'all'}
              onChange={(e) => handleSubscriptionStatusChange(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="none">No Subscription</option>
            </Select>
          </div>

          {/* Subscription Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subscription Plan
            </label>
            <Select
              value={filters.subscriptionTier?.toString() || 'all'}
              onChange={(e) => handleSubscriptionTierChange(e.target.value)}
            >
              {subscriptionTierOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Account Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Status
            </label>
            <Select
              value={filters.accountStatus || 'all'}
              onChange={(e) => handleAccountStatusChange(e.target.value)}
            >
              <option value="all">All Accounts</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>

          {/* Registration Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Registration Date
            </label>
            <div className="flex space-x-2">
              <TextInput
                type="date"
                placeholder="From"
                value={registrationDateFrom}
                onChange={(e) => setRegistrationDateFrom(e.target.value)}
                onBlur={handleDateChange}
                className="flex-1"
              />
              <TextInput
                type="date"
                placeholder="To"
                value={registrationDateTo}
                onChange={(e) => setRegistrationDateTo(e.target.value)}
                onBlur={handleDateChange}
                className="flex-1"
              />
              {(registrationDateFrom || registrationDateTo) && (
                <Button
                  size="sm"
                  color="gray"
                  onClick={clearDateFilters}
                  className="p-2"
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button
              color="light"
              size="sm"
              onClick={clearFilters}
              className="text-gray-600 hover:text-gray-800"
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
