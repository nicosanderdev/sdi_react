import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import reportService from './../../services/ReportService'; // Adjust path if needed
import { Card } from 'flowbite-react';

export interface PropertyStatsProps {
  /** Time period for charts (default last7days) */
  period?: string;
  /** Company filter: undefined = my properties, or company UUID for a specific company */
  companyId?: string | null;
}

export function PropertyStats({ period = 'last7days', companyId }: PropertyStatsProps) {
  const companyFilter = companyId ? { companyId } : {};

  // --- Data Fetching for Visits Per Day Chart ---
  const {
    data: dailyVisitsData,
    isLoading: isLoadingDailyVisits,
    isError: isErrorDailyVisits,
    error: errorDailyVisits,
  } = useQuery({
    queryKey: ['dailyVisits', period, companyId],
    queryFn: () => reportService.getDailyVisits({ period, ...companyFilter }),
  });

  const {
    data: dailyMessagesData,
    isLoading: isLoadingDailyMessages,
    isError: isErrorDailyMessages,
    error: errorDailyMessages,
  } = useQuery({
    queryKey: ['dailyMessages', period, companyId],
    queryFn: () => reportService.getDailyMessages({ period, ...companyFilter }),
  });

  // --- Data Fetching for Visits By Source Chart ---
  const { data: visitsBySourceData, isLoading: isLoadingVisitsBySource, isError: isErrorVisitsBySource, error: errorVisitsBySource } = useQuery({
    queryKey: ['visitsBySource', period, companyId],
    queryFn: () => reportService.getVisitsBySource({ period, ...companyFilter }),
    select: (response) => response
  });

  // Helper for chart loading/error
  const renderChartArea = (isLoading: boolean, isError: boolean, error: any, ChartComponent: any) => {
    if (isLoading) return <p className="text-center text-gray-500">Cargando datos del gráfico...</p>;
    if (isError) return <p className="text-center text-red-500">Error al cargar datos: {error?.message}</p>;
    return ChartComponent;
  };

  const isLoadingDailyLine = isLoadingDailyVisits || isLoadingDailyMessages;
  const isErrorDailyLine = isErrorDailyVisits || isErrorDailyMessages;
  const errorDailyLine = errorDailyVisits || errorDailyMessages;

  const combinedDailyData =
    dailyVisitsData && dailyMessagesData
      ? dailyVisitsData.map((item, idx) => ({
          ...item,
          messages: dailyMessagesData[idx]?.messages ?? 0,
        }))
      : dailyVisitsData || [];

  const periodLabel = period === 'last7days' ? 'Últimos 7 días' : period === 'last30days' ? 'Últimos 30 días' : period === 'last90days' ? 'Últimos 90 días' : period === 'thisyear' ? 'Este año' : period;

  return (
    <Card>
      <h2 className="text-xl font-bold mb-6">
        Estadísticas de Visitas ({periodLabel})
      </h2>
      <div className="mb-8">
        <h3 className="text-md font-medium mb-3">
          Visitas por día
        </h3>
        <div className="h-64">
          {renderChartArea(
            isLoadingDailyLine,
            isErrorDailyLine,
            errorDailyLine,
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinedDailyData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayName" /> {/* Assuming API returns 'dayName' */}
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="visits"
                  name="Visitas"
                  stroke="#0f9d58"
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="messages"
                  name="Mensajes recibidos"
                  stroke="#E6AF2E"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-md font-medium mb-3">
          Visitas por fuente
        </h3>
        <div className="h-64">
          {renderChartArea(isLoadingVisitsBySource, isErrorVisitsBySource, errorVisitsBySource,
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitsBySourceData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="source" /> {/* Assuming API returns 'source' */}
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="visits" name="Visitas" fill="#0f9d58" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
}