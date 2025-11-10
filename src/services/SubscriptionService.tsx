import { BillingHistoryData } from '../models/subscriptions/BillingHistoryData';
import { CancelSubscriptionRequest } from '../models/subscriptions/CancelSubscriptionRequest';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import apiClient from './AxiosClient';

/**
 * @returns The current subscription
 */
const getCurrentSubscription = async () => {
    const response = await apiClient.get<SubscriptionData>(ENDPOINTS.CURRENT_SUBSCRIPTION);
    return response;
}

/**
 * Gets the checkout URL for the current subscription
 * @returns The checkout URL
 */
const getCheckout = async () => {
    const response = await apiClient.get<string>(ENDPOINTS.CHECKOUT);
    return response;
}

/**
 * Cancels the current subscription
 * @param request - The request body
 * @returns The response
 */
const cancelSubscription = async (request: CancelSubscriptionRequest) => {
    const response = await apiClient.post<SubscriptionData>(ENDPOINTS.CANCEL, request);
    return response;
}

/**
 * Gets the billing history for the current subscription
 * @returns The billing history
 */
const getBillingHistory = async () => {
    const response = await apiClient.get<BillingHistoryData[]>(ENDPOINTS.BILLING_HISTORY);
    return Array.isArray(response) ? response : [];
}

const ENDPOINTS = {
    CURRENT_SUBSCRIPTION: '/subscriptions/current',
    CHECKOUT: '/subscriptions/checkout',
    CHANGE: '/subscriptions/change',
    CANCEL: '/subscriptions/cancel',
    BILLING_HISTORY: '/subscriptions/billing-history',
    PLANS: '/plans',
    COMPANY_SUBSCRIPTION: '/companies/{id}/subscription',
    ADMIN_SUBSCRIPTIONS: '/admin/subscriptions',
    ADMIN_MANUAL_INVOICE: '/admin/manual-invoice',
    WEBHOOKS_PAYMENTS: '/webhooks/payments'
}

const subscriptionService = {
    getCurrentSubscription,
    /* getCheckout,
    getCheckoutChange, */
    cancelSubscription,
    getBillingHistory
    /*
    getPlans,
    getCompanySubscription,
    getAdminSubscriptions,
    getAdminManualInvoice,
    getWebhooksPayments,*/
}

export default subscriptionService;