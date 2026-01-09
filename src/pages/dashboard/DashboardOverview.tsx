import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PropertyStats } from '../../components/dashboard/PropertyStats';
import { RecentMessages } from '../../components/dashboard/RecentMessages';
import { DashboardStatCard } from '../../components/dashboard/DashboardStatCard';
import { DashboardChartCard } from '../../components/dashboard/DashboardChartCard';
import { ProgressCircle } from '../../components/dashboard/ProgressCircle';
import { PropertyListCard } from '../../components/dashboard/PropertyListCard';
import { ActivityTrackerCard } from '../../components/dashboard/ActivityTrackerCard';
import { ReminderCard } from '../../components/dashboard/ReminderCard';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import { CalendarIcon, EyeIcon, MessageSquareIcon, HomeIcon, CheckCircleIcon } from 'lucide-react';

// Import services
import reportService from './../../services/ReportService';
import propertyService from './../../services/PropertyService';
import { Dropdown, DropdownItem } from 'flowbite-react';
import { useNavigate } from 'react-router-dom';
import { COMPANY_SELECTOR_OPTIONS, CompanySelector } from '../../components/dashboard/CompanySelector';
import { PropertyImage } from '../../models/properties';

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
    const [company, setCompany] = useState<string>(COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES);

    // Helper function to get company filter for API calls
    const getCompanyFilter = () => {
        if (company === COMPANY_SELECTOR_OPTIONS.ALL_PROPERTIES) {
            return { companyId: 'all' };
        }
        if (company === COMPANY_SELECTOR_OPTIONS.ALL_COMPANIES) {
            return { companyId: 'all-companies' };
        }
        if (company === COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES) {
            return {};
        }
        return { companyId: company };
    };

    const { data: summaryData, isLoading: isLoadingSummary, isError: isErrorSummary } = useQuery({
        queryKey: ['dashboardSummary', period, company],
        queryFn: () => reportService.getDashboardSummary({ period, ...getCompanyFilter() })
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
        queryKey: ['featuredProperties', company],
        queryFn: () => propertyService.getOwnersProperties({ ...params, ...getCompanyFilter() }),
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

    // Mock data for new components
    const mockProperties = [
        {
            id: '1',
            title: 'Casa Moderna en Zona Norte',
            address: 'Av. Libertador 1234, Palermo',
            price: '$450.000',
            status: 'available' as const,
            visits: 45,
            messages: 12
        },
        {
            id: '2',
            title: 'Departamento Centro',
            address: 'Florida 567, Microcentro',
            price: '$2.500/mes',
            status: 'rented' as const,
            visits: 32,
            messages: 8
        },
        {
            id: '3',
            title: 'PH 3 ambientes',
            address: 'Corrientes 890, Almagro',
            price: '$380.000',
            status: 'pending' as const,
            visits: 28,
            messages: 5
        }
    ];

    const mockActivities = [
        {
            id: '1',
            title: 'Revisión de propiedades',
            project: 'Portfolio Q1',
            duration: 120,
            status: 'active' as const,
            startTime: new Date()
        },
        {
            id: '2',
            title: 'Respuesta a consultas',
            duration: 45,
            status: 'paused' as const
        }
    ];

    const mockReminders = [
        {
            id: '1',
            title: 'Llamar cliente - Propiedad Av. Libertador',
            description: 'Cliente interesado en casa de 3 dormitorios',
            priority: 'high' as const,
            completed: false,
            type: 'followup' as const,
            dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '2',
            title: 'Actualizar fotos propiedad ID-456',
            priority: 'medium' as const,
            completed: false,
            type: 'task' as const,
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '3',
            title: 'Reunión con agente inmobiliario',
            priority: 'high' as const,
            completed: true,
            type: 'meeting' as const
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <DashboardPageTitle title="Panel de Control" />
                <div className="flex items-center space-x-2 text-sm">
                    <CalendarIcon size={16} className="text-green-600 dark:text-green-400" />
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
                <CompanySelector
                    mode="without-all"
                    value={company}
                    onChange={setCompany}
                    className="mr-4"
                />
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

            {/* --- Stats Cards Row --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <DashboardStatCard
                    title="Visitas"
                    icon={EyeIcon}
                    value={renderCardValue(summaryData?.visits?.currentPeriod, isLoadingSummary, isErrorSummary)}
                    trend={{
                        value: summaryData?.visits?.percentageChange || 0,
                        direction: summaryData?.visits?.changeDirection || 'neutral'
                    }}
                />

                <DashboardStatCard
                    title="Mensajes"
                    icon={MessageSquareIcon}
                    value={renderCardValue(summaryData?.messages?.currentPeriod, isLoadingSummary, isErrorSummary)}
                    trend={{
                        value: summaryData?.messages?.percentageChange || 0,
                        direction: summaryData?.messages?.changeDirection || 'neutral'
                    }}
                />

                <DashboardStatCard
                    title="Propiedades"
                    icon={HomeIcon}
                    value={renderCardValue(summaryData?.totalProperties?.currentPeriod, isLoadingSummary, isErrorSummary)}
                    trend={{
                        value: summaryData?.totalProperties?.percentageChange || 0,
                        direction: summaryData?.totalProperties?.changeDirection || 'neutral'
                    }}
                />

            </div>

            {/* --- Main Dashboard Grid --- */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column - Charts and Progress */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Analytics Chart */}
                    <DashboardChartCard title="Análisis de Rendimiento">
                        <PropertyStats />
                    </DashboardChartCard>

                    {/* Progress Circle 
                    <DashboardChartCard title="Progreso del Mes">
                        <div className="flex items-center justify-center py-8">
                            <ProgressCircle
                                progress={78}
                                size={140}
                                label="Objetivos"
                                subtitle="Meta mensual: 85%"
                            />
                        </div>
                    </DashboardChartCard>*/}

                    {/* Recent Messages */}
                    <RecentMessages />
                </div>

                {/* Right Column - Property List and Activity */}
                <div className="space-y-6">
                    {/* Property List */}
                    <PropertyListCard
                        properties={mockProperties}
                    />

                    {/* Activity Tracker
                    <ActivityTrackerCard
                        activities={mockActivities}
                        totalToday={165}
                    /> */}

                    {/* Reminders 
                    <ReminderCard
                        reminders={mockReminders}
                    />*/}
                </div>
            </div>

        </div>
    );
}