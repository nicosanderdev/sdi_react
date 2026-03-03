import {
    PaymentData,
    PaymentStatus,
    CreatePaymentRequest,
    PaymentResponse,
    RefundRequest,
    RefundResponse
} from '../models/payments/PaymentData';
import { supabase } from '../config/supabase';

// Edge Function endpoint
const EDGE_FUNCTION_URL = 'dlocal-payments';

/**
 * Creates a new payment using dLocal Go via Supabase Edge Function
 * @param paymentRequest - The payment creation request
 * @returns Payment response with payment details
 */
const createPayment = async (paymentRequest: CreatePaymentRequest): Promise<PaymentResponse> => {
    try {
        const edgeRequest = {
            action: 'create',
            amount: paymentRequest.amount,
            currency: paymentRequest.currency,
            orderId: paymentRequest.orderId,
            description: paymentRequest.description || 'Property payment',
            customerInfo: {
                name: paymentRequest.customerInfo.name,
                email: paymentRequest.customerInfo.email,
                phone: paymentRequest.customerInfo.phone,
                document: paymentRequest.customerInfo.document
            },
            callbackUrl: paymentRequest.callbackUrl
        };

        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_URL, {
            body: edgeRequest
        });

        if (error) {
            throw new Error(error.message || 'Failed to create payment');
        }

        // Transform Edge Function response to our format
        const paymentResponse: PaymentResponse = {
            paymentId: data.paymentId,
            status: data.status === 'APPROVED' ? PaymentStatus.APPROVED :
                   data.status === 'DECLINED' ? PaymentStatus.DECLINED :
                   PaymentStatus.PENDING,
            redirectUrl: data.redirectUrl,
            transactionDetails: data.transactionDetails
        };

        return paymentResponse;
    } catch (error: any) {
        console.error('Error creating payment:', error.message);
        throw error;
    }
};

/**
 * Gets payment status by payment ID via Supabase Edge Function
 * @param paymentId - The payment ID to check
 * @returns Payment data with current status
 */
const getPaymentStatus = async (paymentId: string): Promise<PaymentData> => {
    try {
        const edgeRequest = {
            action: 'status',
            paymentId
        };

        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_URL, {
            body: edgeRequest
        });

        if (error) {
            throw new Error(error.message || 'Failed to get payment status');
        }

        const paymentData: PaymentData = {
            id: data.id,
            amount: data.amount,
            currency: data.currency,
            paymentMethod: 'card', // Default to card, can be expanded later
            status: data.status === 'APPROVED' ? PaymentStatus.APPROVED :
                   data.status === 'DECLINED' ? PaymentStatus.DECLINED :
                   data.status === 'REFUNDED' ? PaymentStatus.REFUNDED :
                   PaymentStatus.PENDING,
            orderId: data.orderId,
            customerInfo: {
                name: data.customerInfo?.name || '',
                email: data.customerInfo?.email || '',
                document: data.customerInfo?.document,
                phone: '' // Not returned by Edge Function currently
            },
            transactionDetails: {
                providerPaymentId: data.transactionDetails.providerPaymentId,
                providerTransactionId: data.transactionDetails.providerTransactionId,
                failureReason: data.transactionDetails.failureReason
            },
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt)
        };

        return paymentData;
    } catch (error: any) {
        console.error('Error getting payment status:', error.message);
        throw error;
    }
};

/**
 * Processes a refund for a payment via Supabase Edge Function
 * @param refundRequest - The refund request details
 * @returns Refund response
 */
const refundPayment = async (refundRequest: RefundRequest): Promise<RefundResponse> => {
    try {
        const edgeRequest = {
            action: 'refund',
            paymentId: refundRequest.paymentId,
            amount: refundRequest.amount,
            reason: refundRequest.reason || 'Customer request'
        };

        const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION_URL, {
            body: edgeRequest
        });

        if (error) {
            throw new Error(error.message || 'Failed to process refund');
        }

        const refundResponse: RefundResponse = {
            refundId: data.refundId,
            status: data.status,
            amount: data.amount
        };

        return refundResponse;
    } catch (error: any) {
        console.error('Error processing refund:', error.message);
        throw error;
    }
};


/**
 * Gets available payment methods for a country
 * Note: This is a stub implementation as the Edge Function doesn't currently support this
 * @param country - Country code (ISO 3166-1 alpha-2)
 * @returns List of available payment methods
 */
const getPaymentMethods = async (country: string) => {
    // TODO: Implement payment methods endpoint in Edge Function
    console.warn(`getPaymentMethods not implemented via Edge Function yet for country: ${country}`);
    return [];
};

/**
 * Validates if the current environment is properly configured
 * Note: Configuration validation now happens in the Edge Function
 * @returns True if configuration is valid (always returns true for now)
 */
const validateConfiguration = (): boolean => {
    // Configuration is now handled by Supabase Edge Function environment variables
    return true;
};

/**
 * Determines if the application is running in sandbox mode
 * @returns True if using sandbox environment, false for production
 */
const isSandbox = import.meta.env.VITE_DLOCAL_ENVIRONMENT === 'sandbox';

const paymentService = {
    createPayment,
    getPaymentStatus,
    refundPayment,
    getPaymentMethods,
    validateConfiguration,
    isSandbox
};

export default paymentService;
