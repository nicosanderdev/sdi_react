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
  
  // --- Data Fetching for Cards ---
  /* const { data: summaryData, isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: async () => reportService.getDashboardSummary()
  }); */

  const [period, setPeriod] = useState('last30days');

  const { data: summaryData , isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary } = useQuery({ 
    queryKey: ['dashboardSummary'],
    queryFn: async () => reportService.getDashboardSummary()
  });

  // --- Data Fetching for Featured Properties ---
  const { data: propertiesData, isLoading: isLoadingProperties, isError: isErrorProperties, error: errorProperties } = useQuery({
    queryKey: ['featuredProperties'],
    queryFn: async () => propertyService.getProperties({ limit: 3, isFeatured: true })
  });
  const featuredProperties = propertiesData || [];

  // --- Loading and Error States for Cards (Simplified for brevity) ---
  const renderCardValue = (value: any, isLoading: boolean, isError: boolean, unit = '') => {
    if (typeof value === 'undefined') return <span className="text-gray-400">No disponible</span>;
    if (isLoading) return <span className="text-gray-400">Cargando...</span>;
    if (isError) return <span className="text-red-500">Error</span>;
    return <>{formatNumber(value)}{unit}</>;
  };

  const renderPercentageChange = (
    percentage: number | undefined,
    direction: 'increase' | 'decrease' | 'neutral' | undefined, // The signature is correct
    isLoading: boolean,
    isError: boolean
  ): JSX.Element | null => {
    const isPositive = direction === 'increase';
    if (isLoading) {
      <div className={`flex items-center mt-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUpIcon size={16} /> : <TrendingDownIcon size={16} />}
        <span className="ml-1">{Math.abs(percentage!).toFixed(1)}% {isPositive ? 'más' : 'menos'} que la semana pasada</span>
      </div>
    }

  // THE FIX IS HERE: We add `!direction` to the check.
  // This guard clause now handles all invalid states: error, missing data, or an undefined direction.
  if (isError || typeof percentage === 'undefined' || !direction) {
    return null; // Don't render anything if data is incomplete
  }

  // After the 'if' block above, TypeScript now knows that `direction` is NOT undefined.
  // It has been "narrowed" from ('increase' | ... | undefined) to just ('increase' | ...).
  // Therefore, the rest of the function is now type-safe.

    const color = direction === 'increase' ? 'text-green-600' : direction === 'decrease' ? 'text-red-600' : 'text-gray-500';
    const symbol = direction === 'increase' ? '▲' : direction === 'decrease' ? '▼' : '';

    return (
      <p className={`text-sm font-medium ${color}`}>
        {symbol} {Math.abs(percentage).toFixed(1)}% vs período anterior
      </p>
    );
  };
  
  /* const renderPercentageChange = (percentage: any, direction: string, isLoading: boolean, isError: boolean) => {
    if (isLoading || isError || typeof percentage !== 'number') return null;
    const isPositive = direction === 'increase'; // Or percentage > 0
    return (
      <div className={`flex items-center mt-2 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUpIcon size={16} /> : <TrendingDownIcon size={16} />}
        <span className="ml-1">{Math.abs(percentage).toFixed(1)}% {isPositive ? 'más' : 'menos'} que la semana pasada</span>
      </div>
    );
  };*/

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
          {/* UI to change the period */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="p-2 border rounded-md shadow-sm text-base font-light"
          >
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last90days">Last 90 Days</option>
          </select>
      </div>

      {/* --- Cards Section --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Visits Card */}
        {/* <div className="bg-[#FDFFFC] p-6 rounded-lg shadow-sm border border-gray-100">
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
           {isErrorSummary && <p className="text-xs text-red-500 mt-1">{errorSummary?.message}</p>}
        </div> */}

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
        </div>


        {/* Messages Card */}
        <div className="bg-[#FDFFFC] p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-[#1B4965]">Mensajes</h3>
            <div className="p-2 bg-[#BEE9E8] rounded-full">
              <MessageSquareIcon size={20} className="text-[#1B4965]" /> {/* Changed Icon */}
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
            <h3 className="text-lg font-medium text-[#1B4965]">Propiedades</h3>
            <div className="p-2 bg-[#BEE9E8] rounded-full">
              <HomeIcon size={20} className="text-[#1B4965]" /> {/* Changed Icon */}
            </div>
          </div>
          <div className="text-3xl font-bold">
            {renderCardValue(summaryData?.totalProperties?.currentPeriod, isLoadingSummary, isErrorSummary)}
          </div>
          <div className="flex items-center mt-2 text-sm text-blue-600">
            <AlertCircleIcon size={16} />
            <span className="ml-1">{summaryData?.totalProperties?.percentageChange} requieren actualización</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PropertyStats /> {/* This component will fetch its own data */}
        </div>
        <div>
          <RecentMessages /> {/* This component will fetch its own data */}
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
            {/*
              The PropertyCard component expects a 'property' prop with a specific structure.
              You'll need to ensure the data from propertyService.getProperties
              is transformed to match the PropertyProps interface if it's different.
              Example: property.price might be an object { amount, currency, formatted }
              but PropertyCard might expect a string.
            */}
            {featuredProperties.map((property: any) => {
              // --- Transformation Logic (Example) ---
              // This transformation depends on your API response and PropertyCard's needs
              const cardProperty = {
                id: property.id,
                title: property.title,
                address: property.address,
                // Assuming API returns price as an object, but card needs a string
                price: property.price?.formatted || (typeof property.price === 'number' ? `€${property.price.toLocaleString('es-ES')}` : String(property.price)),
                // Assuming API returns listingType as 'FOR_SALE'/'FOR_RENT' and propertyType as 'Apartamento' etc.
                status: property.listingType === 'FOR_SALE' ? 'En venta' : (property.listingType === 'FOR_RENT' ? 'En alquiler' : property.listingType),
                type: property.propertyType,
                area: `${property.squareMeters}m²`,
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms,
                image: property.mainImageUrl,
                visits: property.statistics?.visits || 0,
                messages: property.statistics?.messages || 0,
              };
              return <PropertyCard key={property.id} property={cardProperty} />;
            })}
          </div>
        )}
      </div>

      <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-[#1B4965] mb-6">
          Ubicación de Propiedades
        </h2>
        <div className="h-80">
          <PropertyMap /> {/* This component will fetch its own data */}
        </div>
      </div>
    </div>
  );
}