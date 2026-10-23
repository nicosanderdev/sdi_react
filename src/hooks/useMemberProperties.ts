import { useState, useEffect, useCallback, useMemo } from 'react';
import propertyService from '../services/PropertyService';
import propertyAdminService, {
  AdminPropertyListItem,
  PropertyFilters,
  PropertyStatistics,
} from '../services/PropertyAdminService';
import { PropertyData } from '../models/properties';
import { SortConfig, SortDirection, SortField } from './useAdminProperties';
import { COMPANY_SELECTOR_OPTIONS } from '../components/dashboard/CompanySelector';

export interface UseMemberPropertiesReturn {
  properties: AdminPropertyListItem[];
  statistics: PropertyStatistics | null;
  totalProperties: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;

  loading: boolean;
  statisticsLoading: boolean;
  actionLoading: boolean;

  error: string | null;
  statisticsError: string | null;
  actionError: string | null;

  filters: PropertyFilters;
  sortConfig: SortConfig;
  scope: string;

  deleteConfirmModalOpen: boolean;
  propertyToDelete: AdminPropertyListItem | null;
  editingListingPropertyId: string | null;

  selectedProperty: PropertyData | null;
  detailModalOpen: boolean;
  propertyDetailLoading: boolean;
  propertyDetailError: string | null;

  selectedPropertyIds: string[];
  primarySelectedProperty: AdminPropertyListItem | null;

  setScope: (scope: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  updateFilters: (newFilters: Partial<PropertyFilters>) => void;
  clearFilters: () => void;
  setSorting: (field: SortField, direction?: SortDirection) => void;
  fetchProperties: () => Promise<void>;
  fetchStatistics: () => Promise<void>;
  fetchPropertyDetail: (propertyId: string) => Promise<void>;
  closeDetailModal: () => void;

  openDeleteConfirmModal: (property: AdminPropertyListItem) => void;
  closeDeleteConfirmModal: () => void;
  confirmDeleteProperty: () => Promise<void>;

  togglePropertySelection: (propertyId: string) => void;
  toggleSelectAllOnPage: (pagePropertyIds: string[]) => void;
  clearPropertySelection: () => void;
  setEditingListingPropertyId: (propertyId: string | null) => void;
}

const defaultFilters: PropertyFilters = {
  page: 1,
  limit: 10,
  location: undefined,
};

const defaultSortConfig: SortConfig = {
  field: 'createdAt',
  direction: 'desc',
};

export const useMemberProperties = (
  initialScope: string = COMPANY_SELECTOR_OPTIONS.MY_PROPERTIES
): UseMemberPropertiesReturn => {
  const [properties, setProperties] = useState<AdminPropertyListItem[]>([]);
  const [statistics, setStatistics] = useState<PropertyStatistics | null>(null);
  const [totalProperties, setTotalProperties] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [scope, setScopeState] = useState(initialScope);

  const [loading, setLoading] = useState(false);
  const [statisticsLoading, setStatisticsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [statisticsError, setStatisticsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [filters, setFilters] = useState<PropertyFilters>(defaultFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSortConfig);

  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<AdminPropertyListItem | null>(null);
  const [editingListingPropertyId, setEditingListingPropertyId] = useState<string | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<PropertyData | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [propertyDetailLoading, setPropertyDetailLoading] = useState(false);
  const [propertyDetailError, setPropertyDetailError] = useState<string | null>(null);

  const primarySelectedProperty = useMemo((): AdminPropertyListItem | null => {
    if (selectedPropertyIds.length !== 1) return null;
    const id = selectedPropertyIds[0];
    return properties.find((p) => p.id === id) ?? null;
  }, [properties, selectedPropertyIds]);

  const totalPages = Math.ceil(totalProperties / pageSize);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await propertyService.getMemberPropertiesList({
        ...filters,
        page: currentPage,
        limit: pageSize,
        scope,
      });

      setProperties(response.properties);
      setTotalProperties(response.total);
      setSelectedPropertyIds([]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize, scope]);

  const fetchStatistics = useCallback(async () => {
    setStatisticsLoading(true);
    setStatisticsError(null);

    try {
      const stats = await propertyService.getMemberPropertyStatistics(scope);
      setStatistics(stats);
    } catch (err: any) {
      setStatisticsError(err.message || 'Failed to fetch statistics');
    } finally {
      setStatisticsLoading(false);
    }
  }, [scope]);

  const setScope = useCallback((nextScope: string) => {
    setScopeState(nextScope);
    setCurrentPage(1);
  }, []);

  const updateFilters = useCallback((newFilters: Partial<PropertyFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  }, []);

  const setSorting = useCallback((field: SortField, direction?: SortDirection) => {
    setSortConfig((prev) => ({
      field,
      direction: direction || (prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'),
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const openDeleteConfirmModal = useCallback((property: AdminPropertyListItem) => {
    setPropertyToDelete(property);
    setDeleteConfirmModalOpen(true);
    setActionError(null);
  }, []);

  const closeDeleteConfirmModal = useCallback(() => {
    setDeleteConfirmModalOpen(false);
    setPropertyToDelete(null);
    setActionError(null);
  }, []);

  const confirmDeleteProperty = useCallback(async () => {
    if (!propertyToDelete) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await propertyService.deleteProperty(propertyToDelete.id);
      closeDeleteConfirmModal();
      await fetchProperties();
      await fetchStatistics();
    } catch (err: any) {
      setActionError(err.message || 'Failed to delete property.');
    } finally {
      setActionLoading(false);
    }
  }, [propertyToDelete, closeDeleteConfirmModal, fetchProperties, fetchStatistics]);

  const togglePropertySelection = useCallback((propertyId: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propertyId) ? prev.filter((id) => id !== propertyId) : [...prev, propertyId]
    );
  }, []);

  const toggleSelectAllOnPage = useCallback((pagePropertyIds: string[]) => {
    if (pagePropertyIds.length === 0) return;
    setSelectedPropertyIds((prev) => {
      const allIn = pagePropertyIds.every((id) => prev.includes(id));
      if (allIn) return prev.filter((id) => !pagePropertyIds.includes(id));
      return [...new Set([...prev, ...pagePropertyIds])];
    });
  }, []);

  const clearPropertySelection = useCallback(() => {
    setSelectedPropertyIds([]);
  }, []);

  const fetchPropertyDetail = useCallback(async (propertyId: string) => {
    setDetailModalOpen(true);
    setSelectedProperty(null);
    setPropertyDetailLoading(true);
    setPropertyDetailError(null);

    try {
      const propertyDetail = await propertyAdminService.getPropertyDetail(propertyId);
      if (!propertyDetail) {
        setPropertyDetailError(
          'No se pudieron cargar los detalles de la propiedad. No se encontró la propiedad.'
        );
        return;
      }
      setSelectedProperty(propertyDetail);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Error desconocido';
      setPropertyDetailError(`No se pudieron cargar los detalles de la propiedad. ${reason}`);
    } finally {
      setPropertyDetailLoading(false);
    }
  }, []);

  const closeDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedProperty(null);
    setPropertyDetailError(null);
  }, []);

  useEffect(() => {
    void fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    void fetchStatistics();
  }, [fetchStatistics]);

  return {
    properties,
    statistics,
    totalProperties,
    currentPage,
    pageSize,
    totalPages,

    loading,
    statisticsLoading,
    actionLoading,

    error,
    statisticsError,
    actionError,

    filters,
    sortConfig,
    scope,

    deleteConfirmModalOpen,
    propertyToDelete,
    editingListingPropertyId,

    selectedProperty,
    detailModalOpen,
    propertyDetailLoading,
    propertyDetailError,

    selectedPropertyIds,
    primarySelectedProperty,

    setScope,
    setPage,
    setPageSize: handleSetPageSize,
    updateFilters,
    clearFilters,
    setSorting,
    fetchProperties,
    fetchStatistics,
    fetchPropertyDetail,
    closeDetailModal,

    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    confirmDeleteProperty,

    togglePropertySelection,
    toggleSelectAllOnPage,
    clearPropertySelection,
    setEditingListingPropertyId,
  };
};
