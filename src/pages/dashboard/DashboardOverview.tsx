import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PropertyStats } from '../../components/dashboard/PropertyStats';
import { RecentMessages } from '../../components/dashboard/RecentMessages';
import { DashboardStatCard } from '../../components/dashboard/DashboardStatCard';
import { DashboardChartCard } from '../../components/dashboard/DashboardChartCard';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import { CalendarIcon, EyeIcon, MessageSquareIcon, HomeIcon } from 'lucide-react';

// Import services
import reportService from './../../services/ReportService';
import { Dropdown, DropdownItem } from 'flowbite-react';
import { COMPANY_SELECTOR_OPTIONS, CompanySelector } from '../../components/dashboard/CompanySelector';

// Helper function to format numbers (optional)
const formatNumber = (num: number) => num?.toLocaleString('es-ES') || '0';


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


                </div>

                {/* Right Column - Messages */}
                <div className="space-y-6">
                    {/* Recent Messages */}
                    <RecentMessages />


                </div>
            </div>

        </div>
    );
}