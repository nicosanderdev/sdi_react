import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store/store';
import { fetchFavoriteProperties, selectFavoritePropertyIds, selectFavoritesStatus, selectFavoritesError } from '../../store/slices/favoritesSlice';
import { Card, Badge, Button } from 'flowbite-react';
import { Heart, Bed, Bath, Car, Square, MapPin, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IconWrapper } from '../ui/IconWrapper';
import propertyService from '../../services/PropertyService';
import { PublicProperty } from '../../models/properties';

export const FavoritesPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const favoritePropertyIds = useSelector(selectFavoritePropertyIds);
  const status = useSelector(selectFavoritesStatus);
  const error = useSelector(selectFavoritesError);
  
  const [favoriteProperties, setFavoriteProperties] = useState<PublicProperty[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchFavoriteProperties());
    }
  }, [dispatch, status]);

  // Fetch property details when favorite IDs change
  useEffect(() => {
    const fetchPropertyDetails = async () => {
      if (favoritePropertyIds.size === 0) {
        setFavoriteProperties([]);
        return;
      }

      setLoadingProperties(true);
      try {
        const propertyPromises = Array.from(favoritePropertyIds).map(async (propertyId) => {
          try {
            return await propertyService.getPropertyById(propertyId, {
              filter: {
                includeImages: true,
                includeVideos: false,
                includeAmenities: false,
              }
            });
          } catch (error) {
            console.error(`Failed to fetch property ${propertyId}:`, error);
            return null;
          }
        });

        const properties = await Promise.all(propertyPromises);
        setFavoriteProperties(properties.filter((prop): prop is PublicProperty => prop !== null));
      } catch (error) {
        console.error('Error fetching property details:', error);
      } finally {
        setLoadingProperties(false);
      }
    };

    fetchPropertyDetails();
  }, [favoritePropertyIds]);

  const formatPrice = (price?: number, currency: string = 'USD') => {
    if (!price) return 'Price not available';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatAreaValue = (value?: number, unit?: string) => {
    if (!value || !unit) return 'N/A';
    return `${value} ${unit}`;
  };

  const handleViewProperty = (propertyId: string) => {
    navigate(`/properties/view/${propertyId}`);
  };

  if (status === 'loading' || loadingProperties) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading your favorite properties...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error loading favorites: {error}</div>
      </div>
    );
  }

  if (favoriteProperties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Heart className="w-16 h-16 text-gray-400" />
        <h3 className="text-xl font-semibold text-gray-600">No favorite properties yet</h3>
        <p className="text-gray-500 text-center">
          Start exploring properties and add them to your favorites to see them here.
        </p>
        <Button 
          color="blue" 
          onClick={() => navigate('/properties')}
          className="mt-4"
        >
          Browse Properties
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Favorites</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {favoritePropertyIds.size} {favoritePropertyIds.size === 1 ? 'property' : 'properties'} saved
          </p>
        </div>
        <Badge color="red" icon={Heart} size="lg">
          {favoritePropertyIds.size} Favorites
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {favoriteProperties.map((property) => (
          <Card key={property.id} className="max-w-sm hover:shadow-lg transition-shadow duration-200">
            {/* Property Image */}
            <div className="relative">
              {property.propertyImages && property.propertyImages.length > 0 ? (
                <img
                  src={property.propertyImages[0].url}
                  alt={property.title}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
              ) : (
                <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-t-lg flex items-center justify-center">
                  <span className="text-gray-500">No image available</span>
                </div>
              )}
              <div className="absolute top-2 right-2">
                <Heart className="w-6 h-6 text-red-500 fill-current" />
              </div>
            </div>

            {/* Property Details */}
            <div className="p-4 space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                  {property.title}
                </h3>
                <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mt-1">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span className="line-clamp-1">
                    {property.streetName} {property.houseNumber}, {property.city}, {property.state}
                  </span>
                </div>
              </div>

              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {property.salePrice ? formatPrice(property.salePrice, property.currency) : formatPrice(property.rentPrice, property.currency)}
              </div>

              {/* Property Features */}
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center">
                  <IconWrapper icon={Bed} size={16} />
                  <span className="ml-1">{property.bedrooms} beds</span>
                </div>
                <div className="flex items-center">
                  <IconWrapper icon={Bath} size={16} />
                  <span className="ml-1">{property.bathrooms} baths</span>
                </div>
                <div className="flex items-center">
                  <IconWrapper icon={Square} size={16} />
                  <span className="ml-1">{formatAreaValue(property.areaValue, property.areaUnit)}</span>
                </div>
                <div className="flex items-center">
                  <IconWrapper icon={Car} size={16} />
                  <span className="ml-1">{property.garageSpaces} garage</span>
                </div>
              </div>

              {/* Property Type Badge */}
              <div className="flex justify-between items-center">
                <Badge color="green" size="sm">
                  {property.type}
                </Badge>
                <Button
                  size="sm"
                  color="blue"
                  onClick={() => handleViewProperty(property.id)}
                  className="flex items-center"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FavoritesPage;
