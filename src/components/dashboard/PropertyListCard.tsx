import React from 'react';
import { Badge } from 'flowbite-react';
import { MapPin, Eye, MessageSquare } from 'lucide-react';

interface Property {
  id: string;
  title: string;
  address: string;
  price: string;
  status: 'available' | 'rented' | 'sold' | 'pending';
  visits: number;
  messages: number;
}

interface PropertyListCardProps {
  title?: string;
  properties: Property[];
  className?: string;
}

const getStatusColor = (status: Property['status']) => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'rented':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'sold':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
};

const getStatusLabel = (status: Property['status']) => {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'rented':
      return 'Alquilado';
    case 'sold':
      return 'Vendido';
    case 'pending':
      return 'Pendiente';
    default:
      return 'Desconocido';
  }
};

export function PropertyListCard({
  title = "Propiedades",
  properties,
  className = ''
}: PropertyListCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">{title}</h3>

      <div className="space-y-4">
        {properties.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No hay propiedades para mostrar
          </p>
        ) : (
          properties.map((property) => (
            <div key={property.id} className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {property.title}
                  </h4>
                  <Badge className={`text-xs ${getStatusColor(property.status)} ml-2 shrink-0`}>
                    {getStatusLabel(property.status)}
                  </Badge>
                </div>

                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <MapPin className="w-3 h-3 mr-1" />
                  <span className="truncate">{property.address}</span>
                </div>

                <div className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                  {property.price}
                </div>

                <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <Eye className="w-3 h-3 mr-1" />
                    <span>{property.visits} visitas</span>
                  </div>
                  <div className="flex items-center">
                    <MessageSquare className="w-3 h-3 mr-1" />
                    <span>{property.messages} mensajes</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {properties.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <button className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium">
            Ver todas las propiedades →
          </button>
        </div>
      )}
    </div>
  );
}
