import { useState } from 'react';
import { Dropdown, DropdownItem } from 'flowbite-react';
import {
  CalendarIcon,
  EyeIcon,
  HomeIcon,
  MessageSquareIcon,
} from 'lucide-react';
import { CompanySelector, COMPANY_SELECTOR_OPTIONS } from '../../components/dashboard/CompanySelector';
import { DashboardChartCard } from '../../components/dashboard/DashboardChartCard';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import { DashboardStatCard } from '../../components/dashboard/DashboardStatCard';
import { PropertyStats } from '../../components/dashboard/PropertyStats';
import { AdminActivityTable } from '../../components/dashboard/AdminActivityTable';
import { AdminTopMetricsTables } from '../../components/admin/dashboard/AdminTopMetricsTables';
import { useEnsureReceiptsAndBlock } from '../../hooks/useEnsureReceiptsAndBlock';
import { useManagerOverviewData } from '../../hooks/useManagerOverviewData';


export function DashboardOverview() {
    const [period, setPeriod] = useState('last30days');
    const [company, setCompany] = useState<string>(COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES);
    useEnsureReceiptsAndBlock();

    const getCompanyFilter = () => {
      if (company === COMPANY_SELECTOR_OPTIONS.ALL_PROPERTIES) return { companyId: 'all' };
      if (company === COMPANY_SELECTOR_OPTIONS.ALL_COMPANIES) return { companyId: 'all-companies' };
      if (company === COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES) return {};
      return { companyId: company };
    };

    const { summary, topProperties, topTrafficSources, activity } = useManagerOverviewData(period);

    const TIME_RANGES = [
        { id: 'last7days', label: 'Últimos 7 días' },
        { id: 'last30days', label: 'Últimos 30 días' },
        { id: 'last90days', label: 'Últimos 90 días' },
        { id: 'thisyear', label: 'Este año' },
    ];

    const formatMetric = (value?: number) =>
      (typeof value === 'number' ? value.toLocaleString('es-ES') : '0');

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardStatCard
                    title="Visitas a propiedades"
                    icon={EyeIcon}
                    value={formatMetric(summary?.visits?.currentPeriod)}
                />
                <DashboardStatCard
                    title="Mensajes recibidos por consulta"
                    icon={MessageSquareIcon}
                    value={formatMetric(summary?.messages?.currentPeriod)}
                />
                <DashboardStatCard
                    title="Propiedades publicadas"
                    icon={HomeIcon}
                    value={formatMetric(summary?.totalProperties?.currentPeriod)}
                />
                <DashboardStatCard
                    title="Propiedades monitoreadas"
                    icon={HomeIcon}
                    value={formatMetric(topProperties.length)}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="xl:col-span-1">
                    <DashboardChartCard title="Análisis de Rendimiento">
                        <PropertyStats period={period} companyId={getCompanyFilter().companyId} />
                    </DashboardChartCard>
                </div>
                <div className="xl:col-span-1">
                    <AdminActivityTable data={activity} loading={false} />
                </div>
            </div>

            <AdminTopMetricsTables
                topViewed={topProperties.slice(0, 3).map((row, index) => ({
                    rank: index + 1,
                    name: row.propertyTitle,
                    visits: row.visitCount ?? 0,
                }))}
                topBooked={topProperties.slice(0, 3).map((row, index) => ({
                    rank: index + 1,
                    name: row.propertyTitle,
                    bookings: row.messages ?? 0,
                }))}
                topConversion={topProperties.slice(0, 3).map((row, index) => ({
                    rank: index + 1,
                    name: row.propertyTitle,
                    rate: row.conversion ?? '0%',
                }))}
                topTraffic={topTrafficSources.slice(0, 3).map((row, index) => ({
                    rank: index + 1,
                    source: row.source,
                    sessions: row.visits,
                }))}
            />
        </div>
    );
}