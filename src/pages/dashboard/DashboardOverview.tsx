import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PropertyStats } from '../../components/dashboard/PropertyStats';
import { PendingBookingsCard } from '../../components/dashboard/PendingBookingsCard';
import { DashboardStatCard } from '../../components/dashboard/DashboardStatCard';
import { DashboardChartCard } from '../../components/dashboard/DashboardChartCard';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import { GuestSiteFilter, type GuestSiteFilterValue } from '../../components/dashboard/GuestSiteFilter';
import { GuestVisitSummaryCards } from '../../components/dashboard/GuestVisitSummaryCards';
import { CalendarIcon, HomeIcon } from 'lucide-react';

import reportService from './../../services/ReportService';
import { Dropdown, DropdownItem } from 'flowbite-react';
import { COMPANY_SELECTOR_OPTIONS, CompanySelector } from '../../components/dashboard/CompanySelector';
import {
  GUEST_TRAFFIC_SOURCE_LABELS_ES,
  GUEST_TRAFFIC_SOURCES,
  type GuestTrafficSource,
} from '../../types/guestVisitContract';

const formatNumber = (num: number) => num?.toLocaleString('es-ES') || '0';

export function DashboardOverview() {
    const [period, setPeriod] = useState('last30days');
    const [company, setCompany] = useState<string>(COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES);
    const [listingType, setListingType] = useState<GuestSiteFilterValue>(null);

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
        queryKey: ['dashboardSummary', period, company, listingType],
        queryFn: () => reportService.getDashboardSummary({
            period,
            ...getCompanyFilter(),
            listingType,
        })
    });

    const { data: visitsBySource, isLoading: isLoadingTraffic } = useQuery({
        queryKey: ['dashboardTraffic', period, company, listingType],
        queryFn: () => reportService.getVisitsBySource({
            period,
            ...getCompanyFilter(),
            listingType,
        }),
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

    const trafficMap: Partial<Record<GuestTrafficSource, number>> = {};
    if (visitsBySource) {
        const labelToSource = Object.fromEntries(
            GUEST_TRAFFIC_SOURCES.map((s) => [GUEST_TRAFFIC_SOURCE_LABELS_ES[s], s])
        ) as Record<string, GuestTrafficSource>;
        for (const row of visitsBySource) {
            const source = labelToSource[row.source] ?? (row.source as GuestTrafficSource);
            if (GUEST_TRAFFIC_SOURCES.includes(source)) {
                trafficMap[source] = row.visits;
            }
        }
    }

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

            <div className="flex flex-wrap justify-end gap-2">
                <CompanySelector
                    mode="without-all"
                    value={company}
                    onChange={setCompany}
                />
                <GuestSiteFilter value={listingType} onChange={setListingType} />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DashboardStatCard
                    title="Propiedades publicadas"
                    icon={HomeIcon}
                    value={renderCardValue(summaryData?.totalProperties?.currentPeriod, isLoadingSummary, isErrorSummary)}
                />
            </div>

            <GuestVisitSummaryCards
                mode="owner"
                loading={isLoadingSummary || isLoadingTraffic}
                data={{
                    propertyViews: summaryData?.visits?.currentPeriod ?? null,
                    conversionRate: summaryData?.conversionRate ?? null,
                    traffic: trafficMap,
                }}
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <DashboardChartCard title="Análisis de Rendimiento">
                        <PropertyStats
                            period={period}
                            companyId={getCompanyFilter().companyId}
                            listingType={listingType}
                        />
                    </DashboardChartCard>
                </div>

                <div className="space-y-6">
                    <PendingBookingsCard />
                </div>
            </div>
        </div>
    );
}
