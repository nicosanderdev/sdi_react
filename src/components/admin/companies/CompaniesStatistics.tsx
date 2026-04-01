import { Building2Icon, BuildingIcon, CalendarDaysIcon } from 'lucide-react';
import { AdminCompanyMetrics } from '../../../services/CompanyService';

interface Props {
  metrics: AdminCompanyMetrics | null;
  loading?: boolean;
}

export function CompaniesStatistics({ metrics, loading = false }: Props) {
  const cards = [
    { title: 'Total de compañías', value: metrics?.totalCompanies ?? 0, icon: <Building2Icon className="h-5 w-5" /> },
    { title: 'Compañías activas', value: metrics?.activeCompanies ?? 0, icon: <BuildingIcon className="h-5 w-5" /> },
    { title: 'Creadas este mes', value: metrics?.companiesCreatedThisMonth ?? 0, icon: <CalendarDaysIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(card => (
        <div key={card.title} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{card.title}</p>
            <div className="text-green-600 dark:text-green-400">{card.icon}</div>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{loading ? '...' : card.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
