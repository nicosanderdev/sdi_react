import { useState, useEffect, useCallback } from 'react';
import guestAdminService, {
  GuestDetail,
  GuestFilters,
  GuestListItem,
  GuestListResponse,
} from '../services/GuestAdminService';

export type GuestSortField = 'name' | 'email' | 'phone' | 'created';
export type GuestSortDirection = 'asc' | 'desc';

export interface GuestSortConfig {
  field: GuestSortField;
  direction: GuestSortDirection;
}

export interface UseAdminGuestsReturn {
  guests: GuestListItem[];
  totalGuests: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  filters: GuestFilters;
  sortConfig: GuestSortConfig;
  viewModalOpen: boolean;
  viewGuest: GuestDetail | null;
  viewGuestLoading: boolean;
  viewModalError: string | null;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  updateFilters: (newFilters: Partial<GuestFilters>) => void;
  clearFilters: () => void;
  setSorting: (field: GuestSortField, direction?: GuestSortDirection) => void;
  fetchGuests: () => Promise<void>;
  openGuestView: (guestId: string) => Promise<void>;
  closeViewModal: () => void;
}

const defaultFilters: GuestFilters = {
  page: 1,
  limit: 10,
};

const defaultSortConfig: GuestSortConfig = {
  field: 'created',
  direction: 'desc',
};

function sortGuests(guests: GuestListItem[], sortConfig: GuestSortConfig): GuestListItem[] {
  const sorted = [...guests];
  const dir = sortConfig.direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sortConfig.field) {
      case 'name': {
        const na = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
        const nb = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
        return na.localeCompare(nb) * dir;
      }
      case 'email':
        return (a.email ?? '').localeCompare(b.email ?? '') * dir;
      case 'phone':
        return a.phoneNumber.localeCompare(b.phoneNumber) * dir;
      case 'created':
        return (new Date(a.created).getTime() - new Date(b.created).getTime()) * dir;
      default:
        return 0;
    }
  });

  return sorted;
}

export const useAdminGuests = (): UseAdminGuestsReturn => {
  const [guests, setGuests] = useState<GuestListItem[]>([]);
  const [totalGuests, setTotalGuests] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GuestFilters>(defaultFilters);
  const [sortConfig, setSortConfig] = useState<GuestSortConfig>(defaultSortConfig);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewGuest, setViewGuest] = useState<GuestDetail | null>(null);
  const [viewGuestLoading, setViewGuestLoading] = useState(false);
  const [viewModalError, setViewModalError] = useState<string | null>(null);

  const totalPages = Math.ceil(totalGuests / pageSize) || 1;

  const fetchGuests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response: GuestListResponse = await guestAdminService.getGuestsList({
        ...filters,
        page: currentPage,
        limit: pageSize,
      });

      setGuests(sortGuests(response.guests, sortConfig));
      setTotalGuests(response.total);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch guests';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize, sortConfig]);

  useEffect(() => {
    void fetchGuests();
  }, [fetchGuests]);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);

  const updateFilters = useCallback((newFilters: Partial<GuestFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setCurrentPage(1);
  }, []);

  const setSorting = useCallback((field: GuestSortField, direction?: GuestSortDirection) => {
    setSortConfig((prev) => ({
      field,
      direction:
        direction ??
        (prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'),
    }));
  }, []);

  const closeViewModal = useCallback(() => {
    setViewModalOpen(false);
    setViewGuest(null);
    setViewModalError(null);
    setViewGuestLoading(false);
  }, []);

  const openGuestView = useCallback(async (guestId: string) => {
    setViewModalOpen(true);
    setViewGuest(null);
    setViewModalError(null);
    setViewGuestLoading(true);

    try {
      const detail = await guestAdminService.getGuestDetail(guestId);
      if (!detail) {
        setViewModalError('Huésped no encontrado');
        return;
      }
      setViewGuest(detail);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los datos';
      setViewModalError(message);
    } finally {
      setViewGuestLoading(false);
    }
  }, []);

  return {
    guests,
    totalGuests,
    currentPage,
    pageSize,
    totalPages,
    loading,
    error,
    filters,
    sortConfig,
    viewModalOpen,
    viewGuest,
    viewGuestLoading,
    viewModalError,
    setPage,
    setPageSize,
    updateFilters,
    clearFilters,
    setSorting,
    fetchGuests,
    openGuestView,
    closeViewModal,
  };
};
