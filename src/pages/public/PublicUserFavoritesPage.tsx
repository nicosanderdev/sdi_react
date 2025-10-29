import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store/store';
import { fetchFavoriteProperties, selectFavoriteProperties } from '../../store/slices/favoritesSlice';
import { 
  ArrowLeft, 
  Heart, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  Euro,
  Eye,
  MessageSquare,
} from 'lucide-react';

export function PublicUserFavoritesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.user.profile);
  const favoriteProperties = useSelector(selectFavoriteProperties);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchFavoriteProperties()).finally(() => {
        setIsLoading(false);
      });
    }
  }, [dispatch, user]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };


  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#1B4965] mx-auto mb-4"></div>
            <p className="text-lg text-[#1B4965] font-semibold">Cargando propiedades favoritas...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC]">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center space-x-4">
              <Link
                to="/welcome"
                className="flex items-center space-x-2 text-[#1B4965] hover:text-[#153a52] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Volver</span>
              </Link>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[#1B4965]">Mis Propiedades Favoritas</h1>
                <p className="text-gray-600 mt-1">Tus propiedades guardadas para revisar más tarde</p>
              </div>
              <div className="flex items-center space-x-2 text-[#1B4965]">
                <Heart className="w-6 h-6" />
                <span className="text-lg font-semibold">{favoriteProperties.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {favoriteProperties.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <Heart className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-2xl font-bold text-[#1B4965] mb-4">
                No tienes propiedades favoritas aún
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Cuando encuentres propiedades que te gusten, puedes guardarlas aquí para revisarlas más tarde.
              </p>
              <Link
                to="/properties"
                className="bg-[#1B4965] text-white px-6 py-3 rounded-lg hover:bg-[#153a52] transition-colors inline-flex items-center space-x-2"
              >
                <Eye className="w-5 h-5" />
                <span>Explorar Propiedades</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoriteProperties.map((property) => (
                <div key={property.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  {/* Property Image */}
                  <div className="relative h-48 bg-gray-200">
                    {property.propertyImages && property.propertyImages.length > 0 ? (
                      <img
                        src={property.propertyImages[0].url}
                        alt={property.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-400">Sin imagen</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <div className="bg-white bg-opacity-90 rounded-full p-2">
                        <Heart className="w-5 h-5 text-red-500 fill-current" />
                      </div>
                    </div>
                  </div>

                  {/* Property Details */}
                  <div className="p-6">
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-[#1B4965] line-clamp-2 mb-2">
                        {property.title}
                      </h3>
                      <div className="flex items-center text-gray-600 text-sm">
                        <MapPin className="w-4 h-4 mr-1" />
                        <span className="line-clamp-1">
                          {property.city}, {property.state}
                        </span>
                      </div>
                    </div>

                    {/* Property Features */}
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                      {property.bedrooms && (
                        <div className="flex items-center">
                          <Bed className="w-4 h-4 mr-1" />
                          <span>{property.bedrooms}</span>
                        </div>
                      )}
                      {property.bathrooms && (
                        <div className="flex items-center">
                          <Bath className="w-4 h-4 mr-1" />
                          <span>{property.bathrooms}</span>
                        </div>
                      )}
                      {property.areaValue && (
                        <div className="flex items-center">
                          <Square className="w-4 h-4 mr-1" />
                          <span>{property.areaValue}m²</span>
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <div className="flex items-center space-x-2">
                        <Euro className="w-5 h-5 text-[#1B4965]" />
                        <span className="text-xl font-bold text-[#1B4965]">
                          {formatPrice(property.salePrice || property.rentPrice || 0)}
                        </span>
                      </div>
                      {property.areaValue && (property.salePrice || property.rentPrice) && (
                        <p className="text-sm text-gray-600">
                          {formatPrice((property.salePrice || property.rentPrice || 0) / property.areaValue)}/m²
                        </p>
                      )}
                    </div>

                    {/* Property Type */}
                    <div className="mb-4">
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {property.type}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Link
                        to={`/properties/view/${property.id}`}
                        className="flex-1 bg-[#1B4965] text-white py-2 px-4 rounded-lg hover:bg-[#153a52] transition-colors text-center text-sm font-medium flex items-center justify-center space-x-1"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Ver Detalles</span>
                      </Link>
                      <button className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Added Date */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        Propiedad favorita
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Actions */}
          {favoriteProperties.length > 0 && (
            <div className="mt-12 text-center">
              <Link
                to="/properties"
                className="bg-white text-[#1B4965] px-6 py-3 rounded-lg border border-[#1B4965] hover:bg-[#1B4965] hover:text-white transition-colors inline-flex items-center space-x-2"
              >
                <Eye className="w-5 h-5" />
                <span>Ver Más Propiedades</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
