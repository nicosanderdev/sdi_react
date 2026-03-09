import { useState, useEffect } from 'react';
import BookingReceiptService, {
  ensureReceiptsAndBlockStatus,
  EnsureReceiptsResult
} from '../services/BookingReceiptService';
import { BookingReceipt } from '../models/subscriptions/BookingReceipt';

export interface UseEnsureReceiptsAndBlockReturn {
  /** Unpaid booking receipts (after ensure has run) */
  unpaidReceipts: BookingReceipt[];
  /** Whether the ensure run is in progress */
  isLoading: boolean;
  /** Error from ensure run, if any */
  error: string | null;
  /** Last result from ensure (for UI that needs didBlock etc.) */
  lastResult: EnsureReceiptsResult | null;
  /** Manually trigger ensure again */
  runEnsure: () => Promise<void>;
}

/**
 * Runs ensureReceiptsAndBlockStatus on mount (and optionally when navigating to dashboard/billing/Reservas).
 * Use this on DashboardOverview, BookingsPage, and BillingHistoryPage so receipts are created and block status applied on-demand (no cron).
 */
export function useEnsureReceiptsAndBlock(): UseEnsureReceiptsAndBlockReturn {
  const [unpaidReceipts, setUnpaidReceipts] = useState<BookingReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<EnsureReceiptsResult | null>(null);

  const runEnsure = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ensureReceiptsAndBlockStatus();
      if (result) {
        setUnpaidReceipts(result.unpaidReceipts);
        setLastResult(result);
      } else {
        const list = await BookingReceiptService.getUnpaidReceipts();
        setUnpaidReceipts(list);
        setLastResult(null);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error al actualizar recibos');
      setUnpaidReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runEnsure();
  }, []);

  return {
    unpaidReceipts,
    isLoading,
    error,
    lastResult,
    runEnsure
  };
}
