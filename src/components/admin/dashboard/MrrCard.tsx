import React from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';

interface MrrCardProps {
  mrr: number;
  currency?: string; // e.g., 'USD', 'EUR', 'GBP'
  className?: string;
}

export const MrrCard: React.FC<MrrCardProps> = ({
  mrr,
  currency = 'USD',
  className = ''
}) => {
  // Format currency based on locale and currency code
  const formatCurrency = (amount: number, currencyCode: string) => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch (error) {
      // Fallback to simple formatting if Intl.NumberFormat fails
      const symbol = currencyCode === 'USD' ? '$' :
                   currencyCode === 'EUR' ? '€' :
                   currencyCode === 'GBP' ? '£' : '$';
      return `${symbol}${amount.toLocaleString()}`;
    }
  };

  // Format large numbers with K/M suffixes for display
  const formatDisplayValue = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toString();
  };

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Monthly Recurring Revenue
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Active subscriptions
          </p>
        </div>
        <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-3xl font-bold text-gray-900 dark:text-white">
          {formatDisplayValue(mrr)}
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          {formatCurrency(mrr, currency)} / month
        </div>

        {/* Optional trend indicator - could be enhanced later with comparison data */}
        <div className="flex items-center space-x-1 mt-3">
          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            Current period
          </span>
        </div>
      </div>
    </div>
  );
};
