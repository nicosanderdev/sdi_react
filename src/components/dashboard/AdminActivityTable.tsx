import React, { useState, useMemo } from 'react';
import { DashboardChartCard } from './DashboardChartCard';
import { AdminActivityData } from '../../services/AdminService';
import { User, Building, Flag, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface AdminActivityTableProps {
  data: AdminActivityData | null;
  loading?: boolean;
  className?: string;
}

type ActivityType = 'users' | 'properties' | 'flags';
type SortField = 'name' | 'title' | 'createdAt' | 'updatedAt';
type SortDirection = 'asc' | 'desc';

interface ActivityItem {
  id: string;
  name?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  type: ActivityType;
}

export const AdminActivityTable: React.FC<AdminActivityTableProps> = ({
  data,
  loading = false,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<ActivityType>('users');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const tabLabels: Record<ActivityType, string> = {
    users: 'usuarios',
    properties: 'propiedades',
    flags: 'reportes'
  };
  const tabs = [
    { key: 'users' as const, label: 'Usuarios recientes', icon: User, count: data?.users?.length || 0 },
    { key: 'properties' as const, label: 'Propiedades recientes', icon: Building, count: data?.properties?.length || 0 },
    { key: 'flags' as const, label: 'Reportes abiertos', icon: Flag, count: data?.flags?.length || 0 }
  ];

  // Combine and prepare data for current tab
  const tableData = useMemo(() => {
    if (!data) return [];

    let items: ActivityItem[] = [];

    switch (activeTab) {
      case 'users':
        items = data.users.map(user => ({ ...user, type: 'users' as const }));
        break;
      case 'properties':
        items = data.properties.map(property => ({ ...property, type: 'properties' as const }));
        break;
      case 'flags':
        items = data.flags.map(flag => ({ ...flag, type: 'flags' as const }));
        break;
    }

    // Sort data
    return items.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name || a.title || '';
          bValue = b.name || b.title || '';
          break;
        case 'title':
          aValue = a.title || a.name || '';
          bValue = b.title || b.name || '';
          break;
        case 'createdAt':
          aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        case 'updatedAt':
          aValue = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          bValue = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, activeTab, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ?
      <ArrowUp className="w-4 h-4" /> :
      <ArrowDown className="w-4 h-4" />;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-gray-100 text-gray-800';

    switch (status.toLowerCase()) {
      case 'active':
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <DashboardChartCard title="Actividad reciente" className={className}>
        <div className="animate-pulse">
          <div className="flex space-x-2 mb-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </DashboardChartCard>
    );
  }

  return (
    <DashboardChartCard title="Actividad reciente" className={className}>
      <div className="flex space-x-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-[#1B4965] text-[#1B4965] dark:text-[#62B6CB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full text-xs">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort(activeTab === 'properties' ? 'title' : 'name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>{activeTab === 'properties' ? 'Título' : 'Nombre'}</span>
                    {getSortIcon(activeTab === 'properties' ? 'title' : 'name')}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Creado</span>
                    {getSortIcon('createdAt')}
                  </div>
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('updatedAt')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Actualizado</span>
                    {getSortIcon('updatedAt')}
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No hay {tabLabels[activeTab]} para mostrar
                  </td>
                </tr>
              ) : (
              tableData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.name || item.title || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(item.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(item.updatedAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.status ? (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))
              ) }
            </tbody>
          </table>
        </div>
      </div>
    </DashboardChartCard>
  );
};
