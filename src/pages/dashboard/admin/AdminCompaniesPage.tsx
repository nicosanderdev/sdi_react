import { useState } from 'react';
import { Button, Card } from 'flowbite-react';
import { RefreshCwIcon } from 'lucide-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAdminCompanies } from '../../../hooks/useAdminCompanies';
import { CompaniesStatistics } from '../../../components/admin/companies/CompaniesStatistics';
import { CompaniesFilters } from '../../../components/admin/companies/CompaniesFilters';
import { CompaniesTable } from '../../../components/admin/companies/CompaniesTable';
import { CreateCompanyModal } from '../../../components/admin/companies/CreateCompanyModal';

export function AdminCompaniesPage() {
  const hook = useAdminCompanies();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <DashboardPageTitle title="Administración de compañías" subtitle="Gestiona compañías, estado y miembros" />
        <Button color="light" size="sm" onClick={hook.fetchCompanies} disabled={hook.loading}>
          <RefreshCwIcon className={`h-4 w-4 ${hook.loading ? 'animate-spin' : ''}`} />
          <span className="ml-2">Actualizar</span>
        </Button>
      </div>

      {hook.error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-red-700 dark:text-red-200">{hook.error}</p>
        </Card>
      )}

      <CompaniesStatistics metrics={hook.metrics} loading={hook.loading} />
      <CompaniesFilters hook={hook} />

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Compañías</h3>
          <Button color="green" onClick={() => setCreateOpen(true)}>Crear compañía</Button>
        </div>
        <CompaniesTable hook={hook} />
      </Card>

      {hook.totalPages > 1 && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Página {hook.currentPage} de {hook.totalPages}</span>
            <div className="flex items-center gap-2">
              <Button size="xs" color="light" disabled={hook.currentPage <= 1} onClick={() => hook.setPage(hook.currentPage - 1)}>Anterior</Button>
              <Button size="xs" color="light" disabled={hook.currentPage >= hook.totalPages} onClick={() => hook.setPage(hook.currentPage + 1)}>Siguiente</Button>
            </div>
          </div>
        </Card>
      )}

      <CreateCompanyModal open={createOpen} onClose={() => setCreateOpen(false)} hook={hook} />
    </div>
  );
}
