import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PropertyStats } from './PropertyStats';
import { RecentMessages } from './RecentMessages';
import { PropertyMap } from './PropertyMap';
import { PropertyCard } from './PropertyCard';
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, AlertCircleIcon, EyeIcon, MessageSquareIcon, HomeIcon } from 'lucide-react';

// Import services
import reportService from './../../services/ReportService';
import propertyService from './../../services/PropertyService';

// Helper function to format numbers (optional)
const formatNumber = (num: number) => num?.toLocaleString('es-ES') || '0';

export function DashboardOverview() {
  
  const [period, setPeriod] = useState('last30days');

  const { data: summaryData, isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary } = useQuery({ 
    queryKey: ['dashboardSummary', period], // Added period to refetch on change
    queryFn: () => reportService.getDashboardSummary({ period }) // Pass period to service
  });

  // --- Data Fetching for Featured Properties ---
  const { data: propertiesData, isLoading: isLoadingProperties, isError: isErrorProperties, error: errorProperties } = useQuery({
    queryKey: ['featuredProperties'],
    queryFn: () => propertyService.getProperties({ limit: 3, isFeatured: true }) // Assuming service takes an object
  });
  const featuredProperties = propertiesData || [];

  const renderCardValue = (value: any, isLoading: boolean, isError: boolean, unit = '') => {
    if (isLoading) return <span className="text-gray-400">Cargando...</span>;
    if (isError || typeof value === 'undefined' || value === null) return <span className="text-gray-400">No disponible</span>;
    return <>{formatNumber(value)}{unit}</>;
  };

  const renderPercentageChange = (
    percentage: number | undefined,
    direction: 'increase' | 'decrease' | 'neutral' | undefined,
    isLoading: boolean,
    isError: boolean
  ): JSX.Element | null => {
    if (isLoading) return <p className="text-sm text-gray-400 mt-1">Calculando...</p>;
    if (isError || typeof percentage === 'undefined' || !direction || direction === 'neutral') {
      return null;
    }

    const color = direction === 'increase' ? 'text-green-600' : 'text-red-600';
    const Icon = direction === 'increase' ? TrendingUpIcon : TrendingDownIcon;

    return (
      <p className={`flex items-center text-sm font-medium ${color} mt-1`}>
        <Icon className="mr-1 h-4 w-4" />
        {Math.abs(percentage).toFixed(1)}% vs período anterior
      </p>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1B4965]">Panel de Control</h1>
        <div className="flex items-center space-x-2 text-sm">
          <CalendarIcon size={16} className="text-[#62B6CB]" />
          <span>
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="p-2 border rounded-md shadow-sm text-base font-light"
          >
            <option value="last7days">Últimos 7 días</option>
            <option value="last30days">Últimos 30 días</option>
            <option value="last90days">Últimos 90 días</option>
          </select>
      </div>

      {/* --- Cards Section --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Visits Card */}
        <div className="bg-[#FDFFFC] p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-[#1B4965]">Visitas</h3>
            <div className="p-2 bg-[#BEE9E8] rounded-full">
              <EyeIcon size={20} className="text-[#1B4965]" />
            </div>
          </div>
          <div className="text-3xl font-bold">
            {renderCardValue(summaryData?.visits?.currentPeriod, isLoadingSummary, isErrorSummary)}
          </div>
          {renderPercentageChange(summaryData?.visits?.percentageChange, summaryData?.visits?.changeDirection, isLoadingSummary, isErrorSummary)}
        </div>

        {/* Messages Card */}
        <div className="bg-[#FDFFFC] p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-[#1B4965]">Mensajes</h3>
            <div className="p-2 bg-[#BEE9E8] rounded-full">
              <MessageSquareIcon size={20} className="text-[#1B4965]" />
            </div>
          </div>
          <div className="text-3xl font-bold">
            {renderCardValue(summaryData?.messages?.currentPeriod, isLoadingSummary, isErrorSummary)}
          </div>
          {renderPercentageChange(summaryData?.messages?.percentageChange, summaryData?.messages?.changeDirection, isLoadingSummary, isErrorSummary)}
        </div>

        {/* Properties Card */}
        <div className="bg-[#FDFFFC] p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-[#1B4965]">Propiedades Activas</h3>
            <div className="p-2 bg-[#BEE9E8] rounded-full">
              <HomeIcon size={20} className="text-[#1B4965]" />
            </div>
          </div>
          <div className="text-3xl font-bold">
            {renderCardValue(summaryData?.totalProperties, isLoadingSummary, isErrorSummary)}
          </div>
          {summaryData?.propertiesNeedingAttention > 0 && (
            <div className="flex items-center mt-2 text-sm text-orange-600">
              <AlertCircleIcon size={16} />
              <span className="ml-1">{summaryData.propertiesNeedingAttention} requieren atención</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PropertyStats />
        </div>
        <div>
          <RecentMessages />
        </div>
      </div>

      {/* --- Featured Properties Section --- */}
      <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#1B4965]">
            Propiedades Destacadas
          </h2>
          <button className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:bg-[#539BAF] transition-colors">
            Ver todas
          </button>
        </div>
        {isLoadingProperties && <p>Cargando propiedades...</p>}
        {isErrorProperties && <p className="text-red-500">Error al cargar propiedades: {errorProperties?.message}</p>}
        {!isLoadingProperties && !isErrorProperties && featuredProperties.length === 0 && <p>No hay propiedades destacadas.</p>}
        {!isLoadingProperties && !isErrorProperties && featuredProperties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/****************************************************/}
            {/*                   START OF FIX                     */}
            {/****************************************************/}
            {featuredProperties
              .filter(property => !!property && !!property.id) // Filter out any null/undefined entries
              .map((property: any) => {
              
              // --- Defensive Transformation Logic ---
              // This logic safely handles missing data by providing default fallbacks.
              const cardProperty = {
                id: property.id, // We already filtered for this, so it's safe.
                title: property?.title ?? 'Propiedad sin título',
                address: property?.address ?? 'Dirección no disponible',
                
                // Safely format the price
                price: property?.price?.formatted 
                       ?? (typeof property?.price === 'number' ? `€${property.price.toLocaleString('es-ES')}` : 'Consultar precio'),
                
                // Safely determine the status
                status: property?.listingType === 'FOR_SALE' ? 'En venta' 
                        : (property?.listingType === 'FOR_RENT' ? 'En alquiler' : 'No especificado'),

                type: property?.propertyType ?? 'No especificado',
                area: property?.squareMeters ? `${property.squareMeters}m²` : '-',
                bedrooms: property?.bedrooms ?? 0,
                bathrooms: property?.bathrooms ?? 0,
                image: property?.mainImageUrl ?? 'https://via.placeholder.com/400x300.png?text=Sin+Imagen', // Placeholder image
                
                // Safely access nested statistics
                visits: property?.statistics?.visits ?? 0,
                messages: property?.statistics?.messages ?? 0,
              };

              return <PropertyCard key={property.id} property={cardProperty} />;
            })}
            {/****************************************************/}
            {/*                     END OF FIX                     */}
            {/****************************************************/}
          </div>
        )}
      </div>

      <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-[#1B4965] mb-6">
          Ubicación de Propiedades
        </h2>
        <div className="h-80">
          <PropertyMap />
        </div>
      </div>
    </div>
  );
}