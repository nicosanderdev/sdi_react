// src/components/ReportsAndMetrics.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { DownloadIcon, BarChartIcon, PieChartIcon, LineChartIcon, CalendarIcon, TrendingUpIcon, TrendingDownIcon, Loader2Icon, AlertTriangleIcon } from 'lucide-react';
import { VisitsBySourceChart } from './VisitsBySourceChart'; // Assuming in same directory
import { VisitsByDateChart } from './VisitsByDateChart';   // Assuming in same directory
import { PropertiesPerformanceTable } from './PropertiesPerformanceTable'; // Assuming in same directory
import reportService, { 
    DashboardSummaryData, 
    DailyVisit, 
    VisitSource, 
    PropertyVisitStat,
    // GeneralTotalsData // If you want to use this for overall lifetime stats somewhere
} from '../../services/ReportService'; // Adjust path as needed

const TIME_RANGES = [
  { id: 'last7days', label: 'Últimos 7 días' },
  { id: 'last30days', label: 'Últimos 30 días' },
  { id: 'last90days', label: 'Últimos 90 días' }, // Example for 'Trimestre'
  { id: 'thisyear', label: 'Este año' },
  // Or more specific ones if your backend supports them:
  // { id: 'currentWeek', label: 'Esta semana' },
  // { id: 'currentMonth', label: 'Este mes' },
];

// Helper to map component's timeRange to backend's period string
const mapTimeRangeToPeriod = (timeRangeValue: string): string => {
    // This is a simple mapping. You might need a more complex one
    // if your component's 'quarter', 'year' needs to translate to specific date ranges
    // or backend supported keywords like 'currentQuarter', 'currentYear'.
    const selectedRange = TIME_RANGES.find(r => r.id === timeRangeValue);
    return selectedRange ? selectedRange.id : 'last30days'; // Default
};


export function ReportsAndMetrics() {
  const [timeRange, setTimeRange] = useState<string>('last30days'); // Default to one of the mapped IDs

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummaryData | null>(null);
  const [dailyVisits, setDailyVisits] = useState<DailyVisit[]>([]);
  const [visitsBySource, setVisitsBySource] = useState<VisitSource[]>([]);
  const [propertiesPerformance, setPropertiesPerformance] = useState<PropertyVisitStat[]>([]);

  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);
  const [isLoadingDailyVisits, setIsLoadingDailyVisits] = useState<boolean>(true);
  const [isLoadingVisitsBySource, setIsLoadingVisitsBySource] = useState<boolean>(true);
  const [isLoadingPropertiesPerf, setIsLoadingPropertiesPerf] = useState<boolean>(true);
  
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const currentPeriod = mapTimeRangeToPeriod(timeRange);
    setError(null);

    // Fetch Dashboard Summary (Cards)
    setIsLoadingSummary(true);
    try {
      const summary = await reportService.getDashboardSummary({ period: currentPeriod });
      setDashboardSummary(summary);
    } catch (err) {
      console.error("Error fetching dashboard summary:", err);
      setError(prev => prev ? `${prev}\nFallo al cargar resumen.` : 'Fallo al cargar resumen.');
      setDashboardSummary(null); // Clear on error to show placeholders or error state in cards
    } finally {
      setIsLoadingSummary(false);
    }

    // Fetch Daily Visits (VisitsByDateChart)
    setIsLoadingDailyVisits(true);
    try {
      const visits = await reportService.getDailyVisits({ period: currentPeriod });
      setDailyVisits(visits);
    } catch (err) {
      console.error("Error fetching daily visits:", err);
      setError(prev => prev ? `${prev}\nFallo al cargar visitas diarias.` : 'Fallo al cargar visitas diarias.');
    } finally {
      setIsLoadingDailyVisits(false);
    }

    // Fetch Visits by Source (VisitsBySourceChart)
    setIsLoadingVisitsBySource(true);
    try {
      const sources = await reportService.getVisitsBySource({ period: currentPeriod });
      setVisitsBySource(sources);
    } catch (err) {
      console.error("Error fetching visits by source:", err);
       setError(prev => prev ? `${prev}\nFallo al cargar visitas por fuente.` : 'Fallo al cargar visitas por fuente.');
    } finally {
      setIsLoadingVisitsBySource(false);
    }
    
    // Fetch Properties Performance (PropertiesPerformanceTable)
    setIsLoadingPropertiesPerf(true);
    try {
      // Assuming getVisitsByProperty can be used, or you have a dedicated endpoint
      const performanceData = await reportService.getVisitsByProperty({ period: currentPeriod, limit: 10 }); // Example limit
      setPropertiesPerformance(performanceData.data);
    } catch (err) {
      console.error("Error fetching properties performance:", err);
      setError(prev => prev ? `${prev}\nFallo al cargar rendimiento de propiedades.` : 'Fallo al cargar rendimiento de propiedades.');
    } finally {
      setIsLoadingPropertiesPerf(false);
    }

  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Re-fetch when timeRange changes

  const handleExport = () => {
    // Placeholder: Implement actual export functionality
    // This might involve calling a specific backend endpoint that generates a CSV/PDF
    // or client-side generation if data is simple enough.
    console.log('Exporting reports for period:', timeRange);
    alert('Funcionalidad de exportación pendiente.');
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

  // Summary Card Component
  const SummaryCard = ({ title, value, icon, trendValue, trendDirection, isLoading }: {
    title: string, value: string | number, icon: React.ReactNode, 
    trendValue?: number, trendDirection?: 'increase' | 'decrease' | 'neutral', isLoading: boolean
  }) => (
    <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6 min-h-[150px] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[#1B4965]">{title}</h3>
          <div className="p-2 bg-[#BEE9E8]/60 rounded-full">{icon}</div>
        </div>
        {isLoading ? (
          <Loader2Icon className="h-8 w-8 text-[#62B6CB] animate-spin" />
        ) : (
          <div className="text-3xl font-bold text-[#1B4965]">{value}</div>
        )}
      </div>
      {isLoading ? <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse mt-2"></div> : renderTrend(trendValue, trendDirection)}
    </div>
  );


  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1B4965] mb-4 md:mb-0">
          Reportes y Métricas
        </h1>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <select 
              value={timeRange} 
              onChange={e => setTimeRange(e.target.value)} 
              className="pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg appearance-none focus:outline-none focus:ring-1 focus:ring-[#62B6CB] bg-[#FDFFFC] text-sm"
            >
              {TIME_RANGES.map(range => (
                <option key={range.id} value={range.id}>
                  {range.label}
                </option>
              ))}
            </select>
            <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center bg-[#62B6CB] text-[#FDFFFC] px-4 py-2.5 rounded-md hover:opacity-90 transition-opacity shadow-sm"
          >
            <DownloadIcon size={18} className="mr-2" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
            <p className="font-bold">Error al cargar los reportes:</p>
            <pre className="whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <SummaryCard 
            title="Visitas Totales" 
            value={dashboardSummary?.visits?.currentPeriod ?? '-'}
            icon={<BarChartIcon size={20} className="text-[#1B4965]" />}
            trendValue={dashboardSummary?.visits?.percentageChange}
            trendDirection={dashboardSummary?.visits?.changeDirection}
            isLoading={isLoadingSummary}
        />
        <SummaryCard 
            title="Consultas Recibidas" 
            value={dashboardSummary?.messages?.currentPeriod ?? '-'}
            icon={<LineChartIcon size={20} className="text-[#1B4965]" />}
            trendValue={dashboardSummary?.messages?.percentageChange}
            trendDirection={dashboardSummary?.messages?.changeDirection}
            isLoading={isLoadingSummary}
        />
        <SummaryCard 
            title="Tasa de Conversión" 
            // Assuming conversionRate is part of dashboardSummary
            value={dashboardSummary?.conversionRate?.currentPeriod ? `${dashboardSummary.conversionRate.currentPeriod}%` : '-'}
            icon={<PieChartIcon size={20} className="text-[#1B4965]" />}
            trendValue={dashboardSummary?.conversionRate?.percentageChange}
            trendDirection={dashboardSummary?.conversionRate?.changeDirection}
            isLoading={isLoadingSummary}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6 min-h-[400px]">
          <h2 className="text-xl font-semibold text-[#1B4965] mb-6">Visitas por Día</h2>
          <div className="h-80">
            {isLoadingDailyVisits ? (
              <div className="flex items-center justify-center h-full"><Loader2Icon className="h-12 w-12 text-[#62B6CB] animate-spin" /></div>
            ) : dailyVisits.length > 0 ? (
              <VisitsByDateChart data={dailyVisits} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No hay datos de visitas.</div>
            )}
          </div>
        </div>
        <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6 min-h-[400px]">
          <h2 className="text-xl font-semibold text-[#1B4965] mb-6">Visitas por Fuente</h2>
          <div className="h-80">
            {isLoadingVisitsBySource ? (
              <div className="flex items-center justify-center h-full"><Loader2Icon className="h-12 w-12 text-[#62B6CB] animate-spin" /></div>
            ) : visitsBySource.length > 0 ? (
              <VisitsBySourceChart data={visitsBySource} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No hay datos de fuentes.</div>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#1B4965] mb-3 sm:mb-0">
            Rendimiento de Propiedades
          </h2>
          <button 
            onClick={() => alert("Funcionalidad de descarga de informe de propiedades pendiente.")}
            className="flex items-center text-[#62B6CB] hover:opacity-80 transition-opacity text-sm px-3 py-1.5 border border-[#62B6CB] rounded-md"
            >
            <DownloadIcon size={16} className="mr-2" />
            <span>Descargar Informe</span>
          </button>
        </div>
         {isLoadingPropertiesPerf ? (
            <div className="flex items-center justify-center h-40"><Loader2Icon className="h-12 w-12 text-[#62B6CB] animate-spin" /></div>
        ) : propertiesPerformance.length > 0 ? (
            <PropertiesPerformanceTable properties={propertiesPerformance} />
        ) : (
            <div className="flex items-center justify-center h-40 text-gray-500">No hay datos de rendimiento de propiedades.</div>
        )}
      </div>
    </div>
  );
}