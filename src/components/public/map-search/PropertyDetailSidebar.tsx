import { PublicProperty } from '../../../models/properties';
import { X, MapPin, Home, Bed, Bath, Car, DollarSign, Droplet, Zap, PawPrint } from 'lucide-react';

interface PropertyDetailSidebarProps {
  property: PublicProperty | null;
  onClose: () => void;
}

const PropertyDetailSidebar = ({ property, onClose }: PropertyDetailSidebarProps) => {
  if (!property) return null;

  const mainImage = property.images.find(img => img.id === property.mainImageId) || property.images[0];
  const price = property.rentPrice || property.salePrice || 0;
  const priceType = property.rentPrice ? 'Rent' : 'Sale';

  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 h-screen overflow-y-auto">
      {/* Header with close button */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center z-10">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Property Details</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Property Image */}
      {mainImage && (
        <div className="w-full h-64 overflow-hidden">
          <img 
            src={mainImage.url} 
            alt={property.title} 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Property Information */}
      <div className="p-4 space-y-4">
        {/* Title and Price */}
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {property.title}
          </h3>
          <div className="flex items-center gap-2 text-2xl font-semibold text-blue-600 dark:text-blue-400">
            <DollarSign className="w-6 h-6" />
            <span>{price.toLocaleString()} {property.currency}</span>
            <span className="text-sm font-normal text-gray-600 dark:text-gray-400">/ {priceType}</span>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
          <MapPin className="w-5 h-5 mt-1 flex-shrink-0" />
          <div>
            <p>{property.streetName} {property.houseNumber}</p>
            {property.neighborhood && <p>{property.neighborhood}</p>}
            <p>{property.city}, {property.state} {property.zipCode}</p>
            <p>{property.country}</p>
          </div>
        </div>

        {/* Property Type and Area */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Home className="w-5 h-5" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
              <p className="font-medium">{property.type}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Area</p>
              <p className="font-medium">{property.areaValue} {property.areaUnit}</p>
            </div>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Bed className="w-5 h-5" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bedrooms</p>
              <p className="font-medium">{property.bedrooms}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <Bath className="w-5 h-5" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bathrooms</p>
              <p className="font-medium">{property.bathrooms}</p>
            </div>
          </div>
          {property.hasGarage && (
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Car className="w-5 h-5" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Garage Spaces</p>
                <p className="font-medium">{property.garageSpaces}</p>
              </div>
            </div>
          )}
        </div>

        {/* Amenities */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Amenities</h4>
          <div className="space-y-2">
            {property.arePetsAllowed && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <PawPrint className="w-5 h-5 text-green-600" />
                <span>Pets Allowed</span>
              </div>
            )}
            {property.isElectricityIncluded && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Zap className="w-5 h-5 text-yellow-600" />
                <span>Electricity Included</span>
              </div>
            )}
            {property.isWaterIncluded && (
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Droplet className="w-5 h-5 text-blue-600" />
                <span>Water Included</span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {property.description && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h4>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
              {property.description}
            </p>
          </div>
        )}

        {/* Additional Images */}
        {property.images.length > 1 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Gallery</h4>
            <div className="grid grid-cols-2 gap-2">
              {property.images.map((image) => (
                <img
                  key={image.id}
                  src={image.url}
                  alt={`${property.title} - ${image.id}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyDetailSidebar;

