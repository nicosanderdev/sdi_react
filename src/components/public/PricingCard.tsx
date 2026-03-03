import React from 'react';
import { Check } from 'lucide-react';

interface PricingCardProps {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  onSelect: () => void;
  selected?: boolean;
}

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  popular = false,
  onSelect,
  selected = false
}: PricingCardProps) {
  return (
    <div
      className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 cursor-pointer transition-all border-2 ${
        selected
          ? 'ring-2 ring-green-600 border-green-600 shadow-lg'
          : popular
          ? 'border-green-600'
          : 'border-gray-100 dark:border-gray-700 hover:shadow-md'
      } ${popular ? 'scale-105' : ''}`}
      onClick={onSelect}
    >
      {popular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-green-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
            <span>Más Popular</span>
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {name}
        </h4>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>
        <div className="mb-4">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">€{price}</span>
          <span className="text-gray-600 dark:text-gray-400">/{period}</span>
        </div>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-gray-700 dark:text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>

      <button
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
          selected
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        onClick={onSelect}
      >
        {selected ? 'Seleccionado' : 'Seleccionar Plan'}
      </button>
    </div>
  );
}
