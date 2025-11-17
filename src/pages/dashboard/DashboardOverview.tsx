import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PropertyStats } from '../../components/dashboard/PropertyStats';
import { RecentMessages } from '../../components/dashboard/RecentMessages';
import { PropertyMap } from '../../components/dashboard/PropertyMap';
import { PropertyCard } from '../../components/dashboard/PropertyCard';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import { CalendarIcon, TrendingUpIcon, TrendingDownIcon, AlertCircleIcon, EyeIcon, MessageSquareIcon, HomeIcon } from 'lucide-react';

// Import services
import reportService from './../../services/ReportService';
import propertyService from './../../services/PropertyService';
import { Button, Card, Dropdown, DropdownItem } from 'flowbite-react';
import { PropertyImage } from '../../models/properties';
import { useNavigate } from 'react-router-dom';

// Get the API base URL for files
const API_BASE_URL = import.meta.env.VITE_API_BASE_FILES_URL || '';

// Helper function to format numbers (optional)
const formatNumber = (num: number) => num?.toLocaleString('es-ES') || '0';

interface PropertyDisplayDashboard {
    id: string;
    title?: string;
    streetName?: string;
    houseNumber?: string;
    neighborhood?: string;
    city?: string;
    salePrice?: number;
    rentPrice?: number;
    areaUnit?: string;
    areaValue?: number;
    currency?: string;
    status?: string;
    propertyType?: string;
    squareMeters?: number;
    bedrooms?: number;
    bathrooms?: number;
    mainImageId?: string;
    propertyImages?: PropertyImage[];
    statistics?: {
        visits?: number;
        messages?: number;
    };
}

export function DashboardOverview() {

  const [period, setPeriod] = useState('last30days');

  const { data: summaryData, isLoading: isLoadingSummary, isError: isErrorSummary, error: errorSummary } = useQuery({
    queryKey: ['dashboardSummary', period],
    queryFn: () => reportService.getDashboardSummary({ period })
  });

  const TIME_RANGES = [
    { id: 'last7days', label: 'Últimos 7 días' },
    { id: 'last30days', label: 'Últimos 30 días' },
    { id: 'last90days', label: 'Últimos 90 días' },
    { id: 'thisyear', label: 'Este año' },
  ];

  const params = {
    pageSize: 3,
    filter: {
      includeImages: true
    }
  };
  //  --- Data Fetching for Featured Properties ---
  const { data: propertiesData, isLoading: isLoadingProperties, isError: isErrorProperties, error: errorProperties } = useQuery({
    queryKey: ['featuredProperties'],
    queryFn: () => propertyService.getOwnersProperties( params ),
    select: (data) => data.items
  });
  const featuredProperties = propertiesData || [];


  const areaMap = (areaUnit: number) => {
    if (areaUnit === 0) return `m²`;
    if (areaUnit === 1) return `ft²`;
    if (areaUnit === 2) return `yd²`;
    if (areaUnit === 3) return `acres`;
    if (areaUnit === 4) return `hectares`;
    if (areaUnit === 5) return `sq_km`;
    if (areaUnit === 6) return `sq_mi`;
    return '-';
  };

  const renderCardValue = (value: any, isLoading: boolean, isError: boolean, unit = '') => {
    if (isLoading) return <span className="text-gray-400">Cargando...</span>;
    if (isError || typeof value === 'undefined' || value === null) return <span className="text-gray-400">No disponible</span>;
    return <>{formatNumber(value)}{unit}</>;
  };
  
  const navigate = useNavigate();

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
        <DashboardPageTitle title="Panel de Control" />
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
        <Dropdown
          value={period}
          dismissOnClick={true}
          label={TIME_RANGES.find(range => range.id === period)?.label}>
          {TIME_RANGES.map(range => (
            <DropdownItem onClick={() => setPeriod(range.id)} key={range.id} value={range.id}>
              {range.label}
            </DropdownItem>
          ))}
        </Dropdown>
      </div>

      {/* --- Cards Section --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Visits Card */}
        <DashboardCard
          title="Visitas"
          icon={EyeIcon}
          value={renderCardValue(summaryData?.visits?.currentPeriod, isLoadingSummary, isErrorSummary)}
          subtitle={renderPercentageChange(summaryData?.visits?.percentageChange, summaryData?.visits?.changeDirection, isLoadingSummary, isErrorSummary)}
        />

        {/* Messages Card */}
        <DashboardCard
          title="Mensajes sin leer"
          icon={MessageSquareIcon}
          value={renderCardValue(summaryData?.messages?.currentPeriod, isLoadingSummary, isErrorSummary)}
          subtitle={renderPercentageChange(summaryData?.messages?.percentageChange, summaryData?.messages?.changeDirection, isLoadingSummary, isErrorSummary)}
        />

        {/* Properties Card */}
        <DashboardCard
          title="Propiedades Activas"
          icon={HomeIcon}
          value={renderCardValue(summaryData?.totalProperties?.currentPeriod, isLoadingSummary, isErrorSummary)}
          subtitle={
            summaryData && typeof summaryData.totalProperties?.percentageChange === 'number' && summaryData.propertiesNeedingAttention > 0 ? (
              <div className="flex items-center text-sm text-orange-600">
                <AlertCircleIcon size={16} />
                <span className="ml-1">{summaryData.totalProperties?.percentageChange} requieren atención</span>
              </div>
            ) : undefined
          }
        />
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
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            Propiedades Destacadas
          </h2>
          <Button onClick={() => navigate('/dashboard/properties')}>
            Ver todas
          </Button>
        </div>
        {isLoadingProperties && <p>Cargando propiedades...</p>}
        {isErrorProperties && <p className="text-red-500">Error al cargar propiedades: {errorProperties?.message}</p>}
        {!isLoadingProperties && !isErrorProperties && Array.isArray(featuredProperties) && featuredProperties.length === 0 && <p>No hay propiedades destacadas.</p>}
        {!isLoadingProperties && !isErrorProperties && Array.isArray(featuredProperties) && featuredProperties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(featuredProperties as Array<PropertyDisplayDashboard>)
              .filter(property => !!property && !!property.id)
              .map((property) => {
                const cardProperty = {
                  id: property.id,
                  title: property?.title ?? 'Propiedad sin título',
                  address: `${property?.streetName || ''} ${property?.houseNumber || ''}, ${property?.neighborhood || ''}, ${property?.city || ''}`.trim() || 'Dirección no disponible',
                  price: (property?.currency ? property.currency + ' ' : '') + ((property?.status !== undefined && property?.status === 'Sale')
                    ? (property?.salePrice !== undefined && property?.salePrice !== null ? formatNumber(property.salePrice) : '-')
                    : (property?.rentPrice !== undefined && property?.rentPrice !== null ? formatNumber(property.rentPrice) : '-')),

                  status: property?.status === 'Sale' ? 'En venta'
                    : (property?.status === 'Rent' ? 'En alquiler' : 'No especificado'),

                  type: property?.propertyType ?? 'No especificado',
                  area: (property?.areaValue ?? 0) + ' ' + areaMap(Number(property?.areaUnit ?? 0)),
                  bedrooms: property?.bedrooms ?? 0,
                  bathrooms: property?.bathrooms ?? 0,
                  image: (() => {
                    const imageUrl = property?.propertyImages?.find((i: PropertyImage) => 
                        String(i.id) === String(property.mainImageId))?.url;
                        return imageUrl ? `${API_BASE_URL}${imageUrl?.startsWith('/') ? '' : '/'}${imageUrl}` : "https://placehold.co/600x400";
                  })(),
                  visits: property?.statistics?.visits ?? 0,
                  messages: property?.statistics?.messages ?? 0,
                };
                return <PropertyCard key={property.id} property={cardProperty} />;
              })}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-xl font-bold mb-6">
          Ubicación de Propiedades
        </h2>
        <div className="h-80">
          <PropertyMap />
        </div>
      </Card>

    </div>
  );
}