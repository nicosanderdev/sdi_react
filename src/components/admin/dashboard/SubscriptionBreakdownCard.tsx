import React from 'react';
import { CreditCard, CheckCircle, XCircle, UserX } from 'lucide-react';

interface SubscriptionBreakdownCardProps {
  subscriptionStats: {
    withoutSubscription: number;
    active: number;
    expired: number;
  };
  className?: string;
}

export const SubscriptionBreakdownCard: React.FC<SubscriptionBreakdownCardProps> = ({
  subscriptionStats,
  className = ''
}) => {
  const total = subscriptionStats.withoutSubscription + subscriptionStats.active + subscriptionStats.expired;

  const getPercentage = (value: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const items = [
    {
      label: 'Without Subscription',
      value: subscriptionStats.withoutSubscription,
      percentage: getPercentage(subscriptionStats.withoutSubscription),
      color: 'bg-gray-500',
      icon: UserX,
      textColor: 'text-gray-600 dark:text-gray-400'
    },
    {
      label: 'Active Subscriptions',
      value: subscriptionStats.active,
      percentage: getPercentage(subscriptionStats.active),
      color: 'bg-green-500',
      icon: CheckCircle,
      textColor: 'text-green-600 dark:text-green-400'
    },
    {
      label: 'Expired Subscriptions',
      value: subscriptionStats.expired,
      percentage: getPercentage(subscriptionStats.expired),
      color: 'bg-red-500',
      icon: XCircle,
      textColor: 'text-red-600 dark:text-red-400'
    }
  ];

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Subscription Status
        </h3>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                  <Icon className={`w-4 h-4 ${item.textColor} flex-shrink-0`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <span className={`text-sm font-semibold ${item.textColor}`}>
                    {item.value}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({item.percentage}%)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual bar chart */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
          {items.map((item, index) => (
            <div
              key={index}
              className={`${item.color}`}
              style={{ width: `${item.percentage}%` }}
              title={`${item.label}: ${item.percentage}%`}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
        Total: {total} users
      </div>
    </div>
  );
};
