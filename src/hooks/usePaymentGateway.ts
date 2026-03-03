import { useState, useCallback } from 'react';
import { usePayment } from '../contexts/PaymentContext';
import { CreatePaymentRequest, PaymentResponse, PaymentStatus } from '../models/payments/PaymentData';

export interface UsePaymentGatewayReturn {
    createPayment: (request: CreatePaymentRequest) => Promise<PaymentResponse>;
    checkStatus: (paymentId: string) => Promise<void>;
    isProcessing: boolean;
    error: string | null;
    currentPayment: any;
    clearError: () => void;
}

export const usePaymentGateway = (): UsePaymentGatewayReturn => {
    const { createPayment, checkPaymentStatus, isProcessing, error, currentPayment, clearError } = usePayment();

    const handleCreatePayment = useCallback(async (request: CreatePaymentRequest): Promise<PaymentResponse> => {
        return await createPayment(request);
    }, [createPayment]);

    const handleCheckStatus = useCallback(async (paymentId: string): Promise<void> => {
        await checkPaymentStatus(paymentId);
    }, [checkPaymentStatus]);

    return {
        createPayment: handleCreatePayment,
        checkStatus: handleCheckStatus,
        isProcessing,
        error,
        currentPayment,
        clearError
    };
};
