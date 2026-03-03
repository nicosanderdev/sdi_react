import { useNavigate } from 'react-router-dom';
import { BedIcon, BathIcon, SquareIcon, EyeIcon, MessageSquareIcon } from 'lucide-react';
import { Badge } from 'flowbite-react';
interface PropertyProps {
  property: {
    id: string;
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
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/dashboard/property/${property.id}`);
  };

  return <div 
    className="group bg-white dark:bg-primary-900 rounded-lg overflow-hidden shadow-sm border border-primary-800 dark:border-gray-700 hover:shadow-md transition-shadow relative cursor-pointer"
    onClick={handleCardClick}
  >
      <div className="relative h-48">
        <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
        <div className="absolute top-3 right-3">
            <Badge color='info'>
                {property.status}
            </Badge>
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
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-primary-700 bg-opacity-30 dark:bg-opacity-70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg z-10 pointer-events-none">
        <span className="text-white text-lg font-medium">Ver propiedad</span>
      </div>
    </div>;
}