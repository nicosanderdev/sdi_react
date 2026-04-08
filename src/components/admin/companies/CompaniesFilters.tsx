import { Button, Select, TextInput } from 'flowbite-react';
import { SearchIcon } from 'lucide-react';
import { UseAdminCompaniesReturn } from '../../../hooks/useAdminCompanies';

interface Props {
  hook: UseAdminCompaniesReturn;
}

export function CompaniesFilters({ hook }: Props) {
  const { filters, updateFilters, clearFilters } = hook;
  const hasFilters = Boolean(filters.search || filters.status || filters.createdFrom || filters.createdTo);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4">
      <TextInput
        placeholder="Buscar por nombre o email..."
        icon={SearchIcon}
        value={filters.search ?? ''}
        onChange={e => updateFilters({ search: e.target.value || undefined })}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Select value={filters.status ?? 'all'} onChange={e => updateFilters({ status: e.target.value === 'all' ? undefined : (e.target.value as 'active' | 'deleted') })}>
          <option value="all">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="deleted">Eliminada</option>
        </Select>
        <TextInput type="date" value={filters.createdFrom ?? ''} onChange={e => updateFilters({ createdFrom: e.target.value || undefined })} />
        <TextInput type="date" value={filters.createdTo ?? ''} onChange={e => updateFilters({ createdTo: e.target.value || undefined })} />
        {hasFilters ? <Button color="light" onClick={clearFilters}>Limpiar filtros</Button> : <div />}
      </div>
    </div>
  );
}
