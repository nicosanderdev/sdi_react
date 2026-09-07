import { useCallback, useEffect, useMemo, useState } from 'react';
import companyService, {
  AdminCompanyDetail,
  AdminCompanyFilters,
  AdminCompanyListItem,
  AdminCompanyMetrics,
  AdminCompanyMember,
} from '../services/CompanyService';

export interface UseAdminCompaniesReturn {
  companies: AdminCompanyListItem[];
  metrics: AdminCompanyMetrics | null;
  members: AdminCompanyMember[];
  companyDetail: AdminCompanyDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  totalCompanies: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  actionError: string | null;
  filters: AdminCompanyFilters;
  setPage: (page: number) => void;
  updateFilters: (next: Partial<AdminCompanyFilters>) => void;
  clearFilters: () => void;
  fetchCompanies: () => Promise<void>;
  fetchCompanyDetail: (companyId: string) => Promise<void>;
  createCompany: (payload: { name: string; billingEmail: string; description?: string; planId: string }) => Promise<boolean>;
  updateCompany: (companyId: string, payload: { name: string; billingEmail: string; description?: string; phone?: string }) => Promise<boolean>;
  addUserByEmail: (companyId: string, email: string) => Promise<boolean>;
}

const DEFAULT_PAGE_SIZE = 10;

export const useAdminCompanies = (): UseAdminCompaniesReturn => {
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([]);
  const [members, setMembers] = useState<AdminCompanyMember[]>([]);
  const [companyDetail, setCompanyDetail] = useState<AdminCompanyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminCompanyMetrics | null>(null);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminCompanyFilters>({});

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCompanies / pageSize)), [totalCompanies, pageSize]);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, nextMetrics] = await Promise.all([
        companyService.listAdminCompanies({
          ...filters,
          page: currentPage,
          limit: pageSize,
        }),
        companyService.getAdminCompaniesMetrics(),
      ]);
      setCompanies(list.companies);
      setTotalCompanies(list.total);
      setMetrics(nextMetrics);
    } catch (err: any) {
      setError(err.message || 'No se pudieron cargar las compañías.');
    } finally {
      setLoading(false);
    }
  }, [filters, currentPage, pageSize]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const fetchCompanyDetail = useCallback(async (companyId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await companyService.getAdminCompanyDetail(companyId);
      setMembers(detail.members);
      setCompanyDetail(detail);
    } catch (err: any) {
      setDetailError(err.message || 'No se pudieron cargar los datos de la compañía.');
      setCompanyDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const createCompany = useCallback(
    async (payload: { name: string; billingEmail: string; description?: string; planId: string }) => {
      setActionError(null);
      try {
        await companyService.createAdminCompany(payload);
        await fetchCompanies();
        return true;
      } catch (err: any) {
        setActionError(err.message || 'No se pudo crear la compañía.');
        return false;
      }
    },
    [fetchCompanies],
  );

  const updateCompany = useCallback(
    async (companyId: string, payload: { name: string; billingEmail: string; description?: string; phone?: string }) => {
      setActionError(null);
      try {
        await companyService.updateAdminCompany(companyId, payload);
        return true;
      } catch (err: any) {
        setActionError(err.message || 'No se pudo actualizar la compañía.');
        return false;
      }
    },
    [],
  );

  const addUserByEmail = useCallback(async (companyId: string, email: string) => {
    setActionError(null);
    try {
      const result = await companyService.addMemberToAdminCompanyByEmail(companyId, email);
      if (!result.success) {
        setActionError(result.message);
        return false;
      }
      await fetchCompanyDetail(companyId);
      return true;
    } catch (err: any) {
      setActionError(err.message || 'No se pudo agregar el usuario.');
      return false;
    }
  }, [fetchCompanyDetail]);

  const updateFilters = useCallback((next: Partial<AdminCompanyFilters>) => {
    setFilters(prev => ({ ...prev, ...next }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setCurrentPage(1);
  }, []);

  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  return {
    companies,
    metrics,
    members,
    companyDetail,
    detailLoading,
    detailError,
    totalCompanies,
    currentPage,
    pageSize,
    totalPages,
    loading,
    error,
    actionError,
    filters,
    setPage,
    updateFilters,
    clearFilters,
    fetchCompanies,
    fetchCompanyDetail,
    createCompany,
    updateCompany,
    addUserByEmail,
  };
};
