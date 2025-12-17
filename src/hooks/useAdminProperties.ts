// src/hooks/useAdminProperties.ts
import { useState, useEffect, useCallback } from 'react';
import propertyAdminService, {
  AdminPropertyListItem,
  AdminPropertyDetail,
  PropertyFilters,
  PropertyListResponse,
  ActionResult,
  PropertyStatistics,
  PropertyStatus,
} from '../services/PropertyAdminService';

// Sorting options
export type SortField = 'title' | 'ownerName' | 'status' | 'city' | 'createdAt' | 'lastModified';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface UseAdminPropertiesReturn {
  // Data
  properties: AdminPropertyListItem[];
  selectedProperty: AdminPropertyDetail | null;
  statistics: PropertyStatistics | null;
  totalProperties: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;

  // Loading states
  loading: boolean;
  propertyDetailLoading: boolean;
  actionLoading: boolean;
  statisticsLoading: boolean;

  // Errors
  error: string | null;
  propertyDetailError: string | null;
  actionError: string | null;
  statisticsError: string | null;

  // Filters and sorting
  filters: PropertyFilters;
  sortConfig: SortConfig;

  // Modal states
  detailModalOpen: boolean;
  deleteConfirmModalOpen: boolean;
  propertyToDelete: AdminPropertyListItem | AdminPropertyDetail | null;

  // Actions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  updateFilters: (newFilters: Partial<PropertyFilters>) => void;
  clearFilters: () => void;
  setSorting: (field: SortField, direction?: SortDirection) => void;
  fetchProperties: () => Promise<void>;
  fetchPropertyDetail: (propertyId: string) => Promise<void>;
  fetchStatistics: () => Promise<void>;
  closeDetailModal: () => void;

  // Property actions
  hideProperty: (propertyId: string, reason?: string) => Promise<void>;
  markPropertyInvalid: (propertyId: string, reason: string, markAsSpam?: boolean) => Promise<void>;
  deleteProperty: (propertyId: string, reason: string) => Promise<void>;

  // Modal actions
  openDeleteConfirmModal: (property: AdminPropertyListItem | AdminPropertyDetail) => void;
  closeDeleteConfirmModal: () => void;
  confirmDeleteProperty: (reason: string) => Promise<void>;
}

const defaultFilters: PropertyFilters = {
  page: 1,
  limit: 20,
};

const defaultSortConfig: SortConfig = {
  field: 'createdAt',
  direction: 'desc',
};

const defaultStatistics: PropertyStatistics = {
  totalProperties: 0,
  incompleteProperties: 0,
  neverPublished: 0,
  activeProperties: 0,
  archivedProperties: 0,
};

export const useAdminProperties = (): UseAdminPropertiesReturn => {
  // Data state
  const [properties, setProperties] = useState<AdminPropertyListItem[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<AdminPropertyDetail | null>(null);
  const [statistics, setStatistics] = useState<PropertyStatistics | null>(null);
  const [totalProperties, setTotalProperties] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [propertyDetailLoading, setPropertyDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statisticsLoading, setStatisticsLoading] = useState(false);

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [propertyDetailError, setPropertyDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statisticsError, setStatisticsError] = useState<string | null>(null);

  // Filters and sorting
  const [filters, setFilters] = useState<PropertyFilters>(defaultFilters);
  const [sortConfig, setSortConfig] = useState<SortConfig>(defaultSortConfig);

  // Modal states
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<AdminPropertyListItem | null>(null);

  // Computed values
  const totalPages = Math.ceil(totalProperties / pageSize);

  // Fetch properties list
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response: PropertyListResponse = await propertyAdminService.getPropertiesList({
        ...filters,
        page: currentPage,
        limit: pageSize,
      });

      setProperties(response.properties);
      setTotalProperties(response.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize]);

  // Fetch property detail
  const fetchPropertyDetail = useCallback(async (propertyId: string) => {
    setPropertyDetailLoading(true);
    setPropertyDetailError(null);

    try {
      const propertyDetail = await propertyAdminService.getPropertyDetail(propertyId);
      setSelectedProperty(propertyDetail);
      setDetailModalOpen(true);
    } catch (err: any) {
      setPropertyDetailError(err.message || 'Failed to fetch property details');
    } finally {
      setPropertyDetailLoading(false);
    }
  }, []);

  // Fetch statistics
  const fetchStatistics = useCallback(async () => {
    setStatisticsLoading(true);
    setStatisticsError(null);

    try {
      const stats = await propertyAdminService.getPropertyStatistics();
      setStatistics(stats);
    } catch (err: any) {
      setStatisticsError(err.message || 'Failed to fetch statistics');
    } finally {
      setStatisticsLoading(false);
    }
  }, []);

  // Close detail modal
  const closeDetailModal = useCallback(() => {
    setDetailModalOpen(false);
    setSelectedProperty(null);
    setPropertyDetailError(null);
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<PropertyFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 })); // Reset to first page when filtering
    setCurrentPage(1);
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  }, []);

  // Set sorting
  const setSorting = useCallback((field: SortField, direction?: SortDirection) => {
    setSortConfig(prev => ({
      field,
      direction: direction || (prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'),
    }));
  }, []);

  // Set page
  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Set page size
  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page
  }, []);

  // Modal actions (defined before handleAction to avoid temporal dead zone)
  const closeDeleteConfirmModal = useCallback(() => {
    setDeleteConfirmModalOpen(false);
    setPropertyToDelete(null);
    setActionError(null);
  }, []);

  // Generic action handler
  const handleAction = useCallback(async (
    action: () => Promise<ActionResult>,
    successMessage: string,
    errorMessage: string
  ) => {
    setActionLoading(true);
    setActionError(null);

    try {
      const result = await action();
      if (result.success) {
        // Refresh properties list and statistics
        await fetchProperties();
        await fetchStatistics();
        // Close modals if needed
        if (deleteConfirmModalOpen) {
          closeDeleteConfirmModal();
        }
      } else {
        setActionError(result.message || errorMessage);
      }
    } catch (err: any) {
      setActionError(err.message || errorMessage);
    } finally {
      setActionLoading(false);
    }
  }, [fetchProperties, fetchStatistics, deleteConfirmModalOpen, closeDeleteConfirmModal]);

  // Property actions
  const hideProperty = useCallback((propertyId: string, reason?: string) =>
    handleAction(
      () => propertyAdminService.hideProperty(propertyId, reason),
      'Property hidden successfully',
      'Failed to hide property'
    ), [handleAction]);

  const markPropertyInvalid = useCallback((propertyId: string, reason: string, markAsSpam?: boolean) =>
    handleAction(
      () => propertyAdminService.markPropertyInvalid(propertyId, reason, markAsSpam),
      markAsSpam ? 'Property marked as spam successfully' : 'Property marked as invalid successfully',
      'Failed to mark property as invalid'
    ), [handleAction]);

  const deleteProperty = useCallback((propertyId: string, reason: string) =>
    handleAction(
      () => propertyAdminService.deleteProperty(propertyId, reason),
      'Property deleted successfully',
      'Failed to delete property'
    ), [handleAction]);

  // Modal actions
  const openDeleteConfirmModal = useCallback((property: AdminPropertyListItem | AdminPropertyDetail) => {
    setPropertyToDelete(property);
    setDeleteConfirmModalOpen(true);
  }, []);

  const confirmDeleteProperty = useCallback((reason: string) => {
    if (!propertyToDelete) return Promise.resolve();
    return deleteProperty(propertyToDelete.id, reason);
  }, [propertyToDelete, deleteProperty]);

  // Initial fetch
  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Fetch statistics on mount
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    // Data
    properties,
    selectedProperty,
    statistics,
    totalProperties,
    currentPage,
    pageSize,
    totalPages,

    // Loading states
    loading,
    propertyDetailLoading,
    actionLoading,
    statisticsLoading,

    // Errors
    error,
    propertyDetailError,
    actionError,
    statisticsError,

    // Filters and sorting
    filters,
    sortConfig,

    // Modal states
    detailModalOpen,
    deleteConfirmModalOpen,
    propertyToDelete,

    // Actions
    setPage,
    setPageSize: handleSetPageSize,
    updateFilters,
    clearFilters,
    setSorting,
    fetchProperties,
    fetchPropertyDetail,
    fetchStatistics,
    closeDetailModal,

    // Property actions
    hideProperty,
    markPropertyInvalid,
    deleteProperty,

    // Modal actions
    openDeleteConfirmModal,
    closeDeleteConfirmModal,
    confirmDeleteProperty,
  };
};
