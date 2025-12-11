import { useState, useEffect, useCallback } from 'react';
import subscriptionService from '../services/SubscriptionService';
import { BillingHistoryData } from '../models/subscriptions/BillingHistoryData';

export interface BillingHistoryFilters {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
}

export interface UseBillingHistoryReturn {
    billingHistory: BillingHistoryData[];
    isLoading: boolean;
    error: string | null;
    filters: BillingHistoryFilters;
    setFilters: (filters: BillingHistoryFilters) => void;
    refresh: () => Promise<void>;
    totalAmount: number;
    filteredCount: number;
}

export const useBillingHistory = (): UseBillingHistoryReturn => {
    const [billingHistory, setBillingHistory] = useState<BillingHistoryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<BillingHistoryFilters>({});

    const fetchBillingHistory = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await subscriptionService.getBillingHistory(filters);
            setBillingHistory(data);
        } catch (err: any) {
            setError(err.message || 'Error al cargar el historial de facturación');
        } finally {
            setIsLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchBillingHistory();
    }, [fetchBillingHistory]);

    const totalAmount = billingHistory
        .filter(item => item.status === '0') // Only paid invoices
        .reduce((sum, item) => sum + item.amount, 0);

    const filteredCount = billingHistory.length;

    return {
        billingHistory,
        isLoading,
        error,
        filters,
        setFilters,
        refresh: fetchBillingHistory,
        totalAmount,
        filteredCount
    };
};
