import { useCallback, useMemo, useState } from 'react';
import paymentsAdminService, {
  AdminPaymentBookingRow,
  AdminReceiptRow,
  PaymentFilterStatus
} from '../services/PaymentsAdminService';

interface BookingFiltersState {
  userSearch: string;
  paymentStatus: PaymentFilterStatus;
  fromDate: string;
  toDate: string;
}

const defaultFilters: BookingFiltersState = {
  userSearch: '',
  paymentStatus: 'all',
  fromDate: '',
  toDate: ''
};

export function useAdminPayments() {
  const [activeSection, setActiveSection] = useState<'bookings' | 'receipts'>('bookings');
  const [filters, setFilters] = useState<BookingFiltersState>(defaultFilters);
  const [bookings, setBookings] = useState<AdminPaymentBookingRow[]>([]);
  const [receipts, setReceipts] = useState<AdminReceiptRow[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [updatingReceiptId, setUpdatingReceiptId] = useState<string | null>(null);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);

  const totalToCollect = useMemo(
    () => bookings.reduce((sum, booking) => sum + Number(booking.totalAmount ?? 0), 0),
    [bookings]
  );

  const allFilteredBookingsUnpaid = useMemo(
    () => bookings.length > 0 && bookings.every((booking) => booking.paymentStatus === 0),
    [bookings]
  );

  const loadBookings = useCallback(async () => {
    const searchTerm = filters.userSearch.trim();
    setBookingsError(null);

    setLoadingBookings(true);
    try {
      const data = await paymentsAdminService.getBookings({
        userSearch: searchTerm,
        paymentStatus: filters.paymentStatus,
        fromDate: filters.fromDate,
        toDate: filters.toDate
      });
      setBookings(data);
    } catch (error: any) {
      setBookingsError(error.message || 'Error al cargar reservas');
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }, [filters]);

  const loadReceipts = useCallback(async () => {
    setLoadingReceipts(true);
    setReceiptsError(null);
    try {
      const data = await paymentsAdminService.getReceipts();
      setReceipts(data);
    } catch (error: any) {
      setReceiptsError(error.message || 'Error al cargar recibos');
      setReceipts([]);
    } finally {
      setLoadingReceipts(false);
    }
  }, []);

  const updateFilters = useCallback((patch: Partial<BookingFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setBookings([]);
    setBookingsError(null);
  }, []);

  const generateReceipt = useCallback(async () => {
    if (!allFilteredBookingsUnpaid || bookings.length === 0) {
      return;
    }

    setSubmittingReceipt(true);
    setBookingsError(null);
    try {
      const bookingIds = bookings.map((booking) => booking.id);
      await paymentsAdminService.generateReceipt(bookingIds);
      await Promise.all([loadBookings(), loadReceipts()]);
    } catch (error: any) {
      setBookingsError(error.message || 'No se pudo generar el recibo');
    } finally {
      setSubmittingReceipt(false);
    }
  }, [allFilteredBookingsUnpaid, bookings, loadBookings, loadReceipts]);

  const setReceiptStatus = useCallback(
    async (receiptId: string, isPaid: boolean) => {
      setUpdatingReceiptId(receiptId);
      setReceiptsError(null);
      try {
        await paymentsAdminService.updateReceiptStatus(receiptId, isPaid);
        await Promise.all([loadReceipts(), loadBookings()]);
      } catch (error: any) {
        setReceiptsError(error.message || 'No se pudo actualizar el estado del recibo');
      } finally {
        setUpdatingReceiptId(null);
      }
    },
    [loadBookings, loadReceipts]
  );

  return {
    activeSection,
    setActiveSection,
    filters,
    updateFilters,
    resetFilters,
    bookings,
    receipts,
    loadingBookings,
    loadingReceipts,
    submittingReceipt,
    updatingReceiptId,
    bookingsError,
    receiptsError,
    totalToCollect,
    allFilteredBookingsUnpaid,
    loadBookings,
    loadReceipts,
    generateReceipt,
    setReceiptStatus
  };
}
