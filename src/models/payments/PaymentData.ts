export interface PaymentData {
    id: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: PaymentStatus;
    orderId: string;
    customerInfo: CustomerInfo;
    transactionDetails?: TransactionDetails;
    createdAt: Date;
    updatedAt: Date;
}

export interface CustomerInfo {
    name: string;
    email: string;
    document?: string;
    phone?: string;
}

export interface TransactionDetails {
    providerPaymentId: string;
    providerTransactionId: string;
    redirectUrl?: string;
    failureReason?: string;
}

export enum PaymentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    DECLINED = 'declined',
    CANCELLED = 'cancelled',
    REFUNDED = 'refunded'
}

export interface CreatePaymentRequest {
    amount: number;
    currency: string;
    paymentMethod: string;
    customerInfo: CustomerInfo;
    orderId: string;
    description?: string;
    callbackUrl?: string;
}

export interface PaymentResponse {
    paymentId: string;
    status: PaymentStatus;
    redirectUrl?: string;
    transactionDetails?: TransactionDetails;
}

export interface RefundRequest {
    paymentId: string;
    amount?: number;
    reason?: string;
}

export interface RefundResponse {
    refundId: string;
    status: string;
    amount: number;
}
