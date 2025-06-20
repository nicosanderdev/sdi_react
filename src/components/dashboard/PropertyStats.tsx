import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import reportService from './../../services/ReportService'; // Adjust path if needed

export function PropertyStats() {
  // --- Data Fetching for Visits Per Day Chart ---
  const { data: dailyVisitsData, isLoading: isLoadingDailyVisits, isError: isErrorDailyVisits, error: errorDailyVisits } = useQuery({
    queryKey: ['dailyVisitsLast7Days'],
    queryFn: () => reportService.getDailyVisits({ period: 'last7days' }),
    select: (response) => response
    // API should return: [{ date: "YYYY-MM-DD", dayName: "Lun", visits: 12 }, ...]
    // We will use 'dayName' for XAxis and 'visits' for Line dataKey
  });

  // --- Data Fetching for Visits By Source Chart ---
  const { data: visitsBySourceData, isLoading: isLoadingVisitsBySource, isError: isErrorVisitsBySource, error: errorVisitsBySource } = useQuery({
    queryKey: ['visitsBySourceLast7Days'],
    queryFn: () => reportService.getVisitsBySource({ period: 'last7days' }),
    select: (response) => response
    // API should return: [{ source: "Web", visits: 45 }, ...]
    // We will use 'source' for XAxis and 'visits' for Bar dataKey
  });

  // Helper for chart loading/error
  const renderChartArea = (isLoading: boolean, isError: boolean, error: any, ChartComponent: any) => {
    if (isLoading) return <p className="text-center text-gray-500">Cargando datos del gráfico...</p>;
    if (isError) return <p className="text-center text-red-500">Error al cargar datos: {error?.message}</p>;
    return ChartComponent;
  };

  return (
    <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-[#1B4965] mb-6">
        Estadísticas de Visitas (Últimos 7 días)
      </h2>
      <div className="mb-8">
        <h3 className="text-md font-medium text-[#1B4965] mb-3">
          Visitas por día
        </h3>
        <div className="h-64">
          {renderChartArea(isLoadingDailyVisits, isErrorDailyVisits, errorDailyVisits,
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyVisitsData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayName" /> {/* Assuming API returns 'dayName' */}
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visits" name="Visitas" stroke="#62B6CB" strokeWidth={2} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-md font-medium text-[#1B4965] mb-3">
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
                <Bar dataKey="visits" name="Visitas" fill="#62B6CB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}