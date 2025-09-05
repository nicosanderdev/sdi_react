import React from 'react';
import { BuildingIcon, BedIcon, BathIcon, SquareIcon, EyeIcon, MessageSquareIcon } from 'lucide-react';
interface PropertyProps {
  property: {
    id: number;
    title: string;
    address: string;
    price: string;
    status: string;
    type: string;
    area: string;
    bedrooms: number;
    bathrooms: number;
    image: string;
    visits: number;
    messages: number;
  };
}
export function PropertyCard({
  property
}: PropertyProps) {
  return <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="relative h-48">
        <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${property.status === 'En venta' ? 'bg-[#62B6CB] text-white' : 'bg-[#62B6CB] text-white'}`}>
            {property.status}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-medium text-lg text-gray-900 dark:text-white mb-1">
          {property.title}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">{property.address}</p>
        <div className="font-bold text-lg text-gray-900 dark:text-white mb-3">
          {property.price}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-4">
          <div className="flex items-center">
            <BedIcon size={16} className="mr-1" />
            <span>{property.bedrooms}</span>
          </div>
          <div className="flex items-center">
            <BathIcon size={16} className="mr-1" />
            <span>{property.bathrooms}</span>
          </div>
          <div className="flex items-center">
            <SquareIcon size={16} className="mr-1" />
            <span>{property.area}</span>
          </div>
        </div>
        <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-600 dark:text-gray-300">
            <EyeIcon size={16} className="mr-1" />
            <span>{property.visits} visitas</span>
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-300">
            <MessageSquareIcon size={16} className="mr-1" />
            <span>{property.messages} mensajes</span>
          </div>
        </div>
      </div>
    </div>;
}