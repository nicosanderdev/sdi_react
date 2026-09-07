import React, { useState, useEffect, useCallback } from 'react';
import { DownloadIcon, BarChartIcon, LineChartIcon, Loader2Icon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react';
import { VisitsBySourceChart } from '../../components/reports/VisitsBySourceChart';
import { VisitsByDateChart } from '../../components/reports/VisitsByDateChart';
import { PropertiesPerformanceTable } from '../../components/reports/PropertiesPerformanceTable';
import reportService, {
  DashboardSummaryData,
  DailyVisit,
  VisitSource,
  PropertyVisitStat,
  ReportPropertyOption,
} from '../../services/ReportService';
import { Button, Card, Dropdown, DropdownItem } from 'flowbite-react';
import { CompanySelector, COMPANY_SELECTOR_OPTIONS } from '../../components/dashboard/CompanySelector';
import { useSelector } from 'react-redux';
import { selectUserCompanies } from '../../store/slices/userSlice';
import {
  buildVisitsReportCsv,
  downloadVisitsReportCsv,
  formatVisitsReportFilename,
} from '../../utils/exportVisitsReportCsv';

const TIME_RANGES = [
  { id: 'last7days', label: 'Últimos 7 días' },
  { id: 'last30days', label: 'Últimos 30 días' },
  { id: 'last90days', label: 'Últimos 90 días' },
  { id: 'thisyear', label: 'Este año' },
];

const ALL_PROPERTIES_FILTER = 'all';

const mapTimeRangeToPeriod = (timeRangeValue: string): string => {
  const selectedRange = TIME_RANGES.find(r => r.id === timeRangeValue);
  return selectedRange ? selectedRange.id : 'last30days';
};

export function ReportsAndMetrics() {
  const companies = useSelector(selectUserCompanies);
  const [timeRange, setTimeRange] = useState<string>('last30days');
  const [company, setCompany] = useState<string>('my');
  const [propertyId, setPropertyId] = useState<string>(ALL_PROPERTIES_FILTER);
  const [propertyOptions, setPropertyOptions] = useState<ReportPropertyOption[]>([]);

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummaryData | null>(null);
  const [dailyVisits, setDailyVisits] = useState<DailyVisit[]>([]);
  const [visitsBySource, setVisitsBySource] = useState<VisitSource[]>([]);
  const [propertiesPerformance, setPropertiesPerformance] = useState<PropertyVisitStat[]>([]);

  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [isLoadingDailyVisits, setIsLoadingDailyVisits] = useState<boolean>(true);
  const [isLoadingVisitsBySource, setIsLoadingVisitsBySource] = useState<boolean>(true);
  const [isLoadingPropertiesPerf, setIsLoadingPropertiesPerf] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);

  const getCompanyFilter = useCallback(() => {
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
  }, [company]);

  const getPropertyFilter = useCallback(() => {
    if (propertyId === ALL_PROPERTIES_FILTER) {
      return {};
    }
    return { propertyId };
  }, [propertyId]);

  const fetchData = useCallback(async () => {
    const currentPeriod = mapTimeRangeToPeriod(timeRange);
    setError(null);

    const companyFilter = getCompanyFilter();
    const propertyFilter = getPropertyFilter();
    const requestParams = { period: currentPeriod, ...companyFilter, ...propertyFilter };

    setIsLoadingSummary(true);
    try {
      const summary = await reportService.getDashboardSummary(requestParams);
      setDashboardSummary(summary);
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
      setError(prev => (prev ? `${prev}\nFallo al cargar resumen.` : 'Fallo al cargar resumen.'));
      setDashboardSummary(null);
    } finally {
      setIsLoadingSummary(false);
    }

    setIsLoadingDailyVisits(true);
    try {
      const visits = await reportService.getDailyVisits(requestParams);
      setDailyVisits(visits);
    } catch (err) {
      console.error('Error fetching daily visits:', err);
      setError(prev => (prev ? `${prev}\nFallo al cargar visitas diarias.` : 'Fallo al cargar visitas diarias.'));
    } finally {
      setIsLoadingDailyVisits(false);
    }

    setIsLoadingVisitsBySource(true);
    try {
      const sources = await reportService.getVisitsBySource(requestParams);
      setVisitsBySource(sources);
    } catch (err) {
      console.error('Error fetching visits by source:', err);
      setError(prev => (prev ? `${prev}\nFallo al cargar visitas por fuente.` : 'Fallo al cargar visitas por fuente.'));
    } finally {
      setIsLoadingVisitsBySource(false);
    }

    setIsLoadingPropertiesPerf(true);
    try {
      const performance = await reportService.getVisitsByProperty({
        ...requestParams,
        limit: 100,
        page: 1,
      });
      setPropertiesPerformance(performance.data || []);
    } catch (err) {
      console.error('Error fetching property performance:', err);
      setError(prev => (
        prev ? `${prev}\nFallo al cargar rendimiento de propiedades.` : 'Fallo al cargar rendimiento de propiedades.'
      ));
      setPropertiesPerformance([]);
    } finally {
      setIsLoadingPropertiesPerf(false);
    }
  }, [timeRange, getCompanyFilter, getPropertyFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let cancelled = false;
    const loadPropertyOptions = async () => {
      try {
        const options = await reportService.getReportPropertyOptions(getCompanyFilter());
        if (cancelled) return;
        setPropertyOptions(options);
        setPropertyId(current => (
          current !== ALL_PROPERTIES_FILTER && !options.some(option => option.id === current)
            ? ALL_PROPERTIES_FILTER
            : current
        ));
      } catch (err) {
        console.error('Error fetching report property options:', err);
      }
    };
    void loadPropertyOptions();
    return () => {
      cancelled = true;
    };
  }, [getCompanyFilter]);

  const scopeLabel = (() => {
    if (propertyId !== ALL_PROPERTIES_FILTER) {
      const selected = propertyOptions.find(option => option.id === propertyId);
      return selected?.title || 'Propiedad';
    }
    if (company === COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES) {
      return 'Mis propiedades';
    }
    if (company === COMPANY_SELECTOR_OPTIONS.ALL_PROPERTIES) {
      return 'Todas las propiedades';
    }
    if (company === COMPANY_SELECTOR_OPTIONS.ALL_COMPANIES) {
      return 'Todas las compañías';
    }
    return companies.find(item => item.id === company)?.name || 'Compañía';
  })();

  const handleExportCsv = () => {
    const periodLabel = TIME_RANGES.find(range => range.id === timeRange)?.label || 'Últimos 30 días';
    const csv = buildVisitsReportCsv({
      generatedAt: new Date(),
      periodLabel,
      scopeLabel,
      totalVisits: dashboardSummary?.visits?.currentPeriod ?? 0,
      totalMessages: dashboardSummary?.messages?.currentPeriod ?? 0,
      totalProperties: dashboardSummary?.totalProperties?.currentPeriod ?? propertiesPerformance.length,
      daily: dailyVisits.map(row => ({ date: row.date, visits: row.visits })),
      sources: visitsBySource,
      properties: propertiesPerformance,
    });
    downloadVisitsReportCsv(csv, formatVisitsReportFilename());
  };

  const renderTrend = (value?: number, direction?: 'increase' | 'decrease' | 'neutral') => {
    if (value === undefined || direction === undefined) return <span className="text-sm text-gray-500">-</span>;
    const isPositive = direction === 'increase';
    const isNeutral = direction === 'neutral' || value === 0;
    const color = isPositive ? 'text-green-600' : isNeutral ? 'text-yellow-600' : 'text-red-600';
    const Icon = isPositive ? TrendingUpIcon : isNeutral ? () => <span className="font-bold">→</span> : TrendingDownIcon;

    return (
      <div className={`flex items-center mt-2 text-sm ${color}`}>
        <Icon size={16} className="mr-1" />
        <span>{value.toFixed(1)}% {isNeutral ? 'estable' : (isPositive ? 'más' : 'menos')}</span>
      </div>
    );
  };

  const SummaryCard = ({ title, value, icon, trendValue, trendDirection, isLoading, testId }: {
    title: string, value: string | number, icon: React.ReactNode,
    trendValue?: number, trendDirection?: 'increase' | 'decrease' | 'neutral', isLoading: boolean,
    testId?: string
  }) => (
    <div
      data-testid={testId}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 min-h-[150px] flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">{title}</h3>
          <div className="p-2 bg-[#BEE9E8]/60 dark:bg-blue-900/30 rounded-full">{icon}</div>
        </div>
        {isLoading ? (
          <Loader2Icon className="h-8 w-8 text-[#62B6CB] animate-spin" />
        ) : (
          <div data-testid={testId ? `${testId}-value` : undefined} className="text-3xl font-bold">{value}</div>
        )}
      </div>
      {isLoading ? <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse mt-2"></div> : renderTrend(trendValue, trendDirection)}
    </div>
  );

  const selectedPropertyLabel = propertyId === ALL_PROPERTIES_FILTER
    ? 'Todas las propiedades'
    : (propertyOptions.find(option => option.id === propertyId)?.title || 'Propiedad');

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 md:mb-0">
          Reportes y Métricas
        </h1>
        <div className="flex flex-wrap items-center gap-3 print-hide">
          <CompanySelector
            mode="all-options"
            value={company}
            onChange={(nextCompany) => {
              setCompany(nextCompany);
              setPropertyId(ALL_PROPERTIES_FILTER);
            }}
            className="mr-2"
          />

          <Dropdown
            data-testid="report-property-filter"
            dismissOnClick={true}
            label={selectedPropertyLabel}
          >
            <DropdownItem onClick={() => setPropertyId(ALL_PROPERTIES_FILTER)}>
              Todas las propiedades
            </DropdownItem>
            {propertyOptions.map(option => (
              <DropdownItem
                key={option.id}
                onClick={() => setPropertyId(option.id)}
              >
                {option.title}
              </DropdownItem>
            ))}
          </Dropdown>

          <Dropdown
            data-testid="report-period-filter"
            value={timeRange}
            dismissOnClick={true}
            label={TIME_RANGES.find(range => range.id === timeRange)?.label}
          >
            {TIME_RANGES.map(range => (
              <DropdownItem onClick={() => setTimeRange(range.id)} key={range.id} value={range.id}>
                {range.label}
              </DropdownItem>
            ))}
          </Dropdown>

          <Button data-testid="export-visits-csv" onClick={handleExportCsv}>
            <DownloadIcon size={18} className="mr-2" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p className="font-bold">Error al cargar los reportes:</p>
          <pre className="whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <SummaryCard
          title="Visitas Totales"
          testId="report-total-visits"
          value={dashboardSummary?.visits?.currentPeriod ?? '-'}
          icon={<BarChartIcon size={20} className="text-[#1B4965]" />}
          trendValue={dashboardSummary?.visits?.percentageChange}
          trendDirection={dashboardSummary?.visits?.changeDirection}
          isLoading={isLoadingSummary}
        />
        <SummaryCard
          title="Consultas Recibidas"
          testId="report-total-messages"
          value={dashboardSummary?.messages?.currentPeriod ?? '-'}
          icon={<LineChartIcon size={20} className="text-[#1B4965]" />}
          trendValue={dashboardSummary?.messages?.percentageChange}
          trendDirection={dashboardSummary?.messages?.changeDirection}
          isLoading={isLoadingSummary}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <h2 className="text-xl font-semibold mb-6">Visitas por Día</h2>
          <div className="h-80">
            {isLoadingDailyVisits ? (
              <div className="flex items-center justify-center h-full"><Loader2Icon className="h-12 w-12 text-[#62B6CB] animate-spin" /></div>
            ) : dailyVisits.length > 0 ? (
              <VisitsByDateChart data={dailyVisits} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No hay datos de visitas.</div>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold mb-6">Visitas por Fuente</h2>
          <div className="h-80">
            {isLoadingVisitsBySource ? (
              <div className="flex items-center justify-center h-full"><Loader2Icon className="h-12 w-12 text-[#62B6CB] animate-spin" /></div>
            ) : visitsBySource.length > 0 ? (
              <VisitsBySourceChart data={visitsBySource} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No hay datos de fuentes.</div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-6">Rendimiento por propiedad</h2>
        {isLoadingPropertiesPerf ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon className="h-12 w-12 text-[#62B6CB] animate-spin" />
          </div>
        ) : (
          <PropertiesPerformanceTable properties={propertiesPerformance} />
        )}
      </Card>
    </div>
  );
}
