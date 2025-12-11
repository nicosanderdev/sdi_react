import React, { createContext, useContext, useState, useCallback } from 'react';
import { PaymentData, PaymentStatus, CreatePaymentRequest, PaymentResponse } from '../models/payments/PaymentData';
import paymentService from '../services/PaymentService';

interface PaymentContextType {
    currentPayment: PaymentData | null;
    paymentHistory: PaymentData[];
    isProcessing: boolean;
    error: string | null;
    createPayment: (request: CreatePaymentRequest) => Promise<PaymentResponse>;
    checkPaymentStatus: (paymentId: string) => Promise<PaymentData>;
    clearCurrentPayment: () => void;
    clearError: () => void;
    refreshPaymentHistory: () => Promise<void>;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function usePayment() {
    const context = useContext(PaymentContext);
    if (context === undefined) {
        throw new Error('usePayment must be used within a PaymentProvider');
    }
    return context;
}

interface PaymentProviderProps {
    children: React.ReactNode;
}

export function PaymentProvider({ children }: PaymentProviderProps) {
    const [currentPayment, setCurrentPayment] = useState<PaymentData | null>(null);
    const [paymentHistory, setPaymentHistory] = useState<PaymentData[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createPayment = useCallback(async (request: CreatePaymentRequest): Promise<PaymentResponse> => {
        try {
            setIsProcessing(true);
            setError(null);

            const response = await paymentService.createPayment(request);

            // Create payment data from response for local state
            const paymentData: PaymentData = {
                id: response.paymentId,
                amount: request.amount,
                currency: request.currency,
                paymentMethod: request.paymentMethod,
                status: response.status,
                orderId: request.orderId,
                customerInfo: request.customerInfo,
                transactionDetails: response.transactionDetails,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            setCurrentPayment(paymentData);
            return response;
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to create payment';
            setError(errorMessage);
            throw err;
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const checkPaymentStatus = useCallback(async (paymentId: string): Promise<PaymentData> => {
        try {
            setIsProcessing(true);
            setError(null);

            const paymentData = await paymentService.getPaymentStatus(paymentId);
            setCurrentPayment(paymentData);

            // Update payment history if this payment exists there
            setPaymentHistory(prev =>
                prev.map(p => p.id === paymentId ? paymentData : p)
            );

            return paymentData;
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to check payment status';
            setError(errorMessage);
            throw err;
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const clearCurrentPayment = useCallback(() => {
        setCurrentPayment(null);
        setError(null);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const refreshPaymentHistory = useCallback(async () => {
        // This would typically fetch payment history from the backend
        // For now, we'll keep it empty as this would depend on backend implementation
        try {
            setError(null);
            // TODO: Implement payment history fetching when backend is ready
            setPaymentHistory([]);
        } catch (err: any) {
            setError(err.message || 'Failed to refresh payment history');
        }
    }, []);

    const value: PaymentContextType = {
        currentPayment,
        paymentHistory,
        isProcessing,
        error,
        createPayment,
        checkPaymentStatus,
        clearCurrentPayment,
        clearError,
        refreshPaymentHistory
    };

    return (
        <PaymentContext.Provider value={value}>
            {children}
        </PaymentContext.Provider>
    );
}
