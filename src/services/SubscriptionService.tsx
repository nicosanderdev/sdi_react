import { BillingHistoryData, BillingHistoryList } from '../models/subscriptions/BillingHistoryData';
import { CancelSubscriptionRequest } from '../models/subscriptions/CancelSubscriptionRequest';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import { PlanData } from '../models/subscriptions/PlanData';
import apiClient from './AxiosClient';

const ENDPOINTS = {
    CURRENT_SUBSCRIPTION: '/subscriptions/current',
    CHECKOUT: '/subscriptions/checkout',
    CHANGE: '/subscriptions/change',
    CANCEL: '/subscriptions/cancel',
    BILLING_HISTORY: '/subscriptions/billing-history',
    PLANS: '/plans',
    COMPANY_SUBSCRIPTION: '/companies/{id}/subscription',
    ADMIN_SUBSCRIPTIONS: '/admin/subscriptions',
    ADMIN_INVOICES: '/admin/invoices',
    ADMIN_MANUAL_INVOICE: '/admin/manual-invoice',
    WEBHOOKS_PAYMENTS: '/webhooks/payments'
}

/**
 * @returns The current subscription
 */
const getCurrentSubscription = async () => {
    const response = await apiClient.get<SubscriptionData>(ENDPOINTS.CURRENT_SUBSCRIPTION);
    return response;
}

/**
 * Gets the checkout URL for upgrading subscription
 * @param planId - The plan ID to upgrade to
 * @returns The checkout URL
 */
const getCheckout = async (planId?: string) => {
    const url = planId ? `${ENDPOINTS.CHECKOUT}?planId=${planId}` : ENDPOINTS.CHECKOUT;
    const response = await apiClient.get<string>(url);
    return response;
}

/**
 * Gets the checkout URL for changing subscription plan
 * @param planId - The plan ID to change to
 * @returns The checkout URL
 */
const getCheckoutChange = async (planId: string) => {
    const response = await apiClient.post<string>(ENDPOINTS.CHANGE, { planId });
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
    const response = await apiClient.get<BillingHistoryList>(ENDPOINTS.BILLING_HISTORY);
    return response.items;
}

/**
 * Gets all available plans
 * @returns List of available plans
 */
const getPlans = async () => {
    const response = await apiClient.get<PlanData[]>(ENDPOINTS.PLANS);
    return response;
}

/**
 * Gets subscription for a specific company
 * @param companyId - The company ID
 * @returns The company subscription
 */
const getCompanySubscription = async (companyId: string) => {
    const url = ENDPOINTS.COMPANY_SUBSCRIPTION.replace('{id}', companyId);
    const response = await apiClient.get<SubscriptionData>(url);
    return response;
}

/**
 * Gets all subscriptions (admin only)
 * @param filters - Optional filters (active, canceled, overdue)
 * @returns List of subscriptions
 */
const getAdminSubscriptions = async (filters?: { status?: string; overdue?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.overdue !== undefined) params.append('overdue', String(filters.overdue));
    
    const url = params.toString() 
        ? `${ENDPOINTS.ADMIN_SUBSCRIPTIONS}?${params.toString()}`
        : ENDPOINTS.ADMIN_SUBSCRIPTIONS;
    
    const response = await apiClient.get<SubscriptionData[]>(url);
    return response;
}

/**
 * Gets all invoices (admin only)
 * @param filters - Optional filters (userId, companyId)
 * @returns List of invoices
 */
const getAdminInvoices = async (filters?: { userId?: string; companyId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.companyId) params.append('companyId', filters.companyId);
    
    const url = params.toString()
        ? `${ENDPOINTS.ADMIN_INVOICES}?${params.toString()}`
        : ENDPOINTS.ADMIN_INVOICES;
    
    const response = await apiClient.get<BillingHistoryData[]>(url);
    return response;
}

/**
 * Downloads an invoice PDF
 * @param invoiceId - The invoice ID
 * @returns Blob of the PDF
 */
const downloadInvoice = async (invoiceId: string) => {
    // Use axios directly for blob responses to bypass the interceptor
    const axios = (await import('axios')).default;
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
    const TENANT_API_KEY = import.meta.env.VITE_TENANT_API_KEY || 'YOUR_DEFAULT_TENANT_KEY';
    
    const response = await axios.get(`${API_BASE_URL}${ENDPOINTS.BILLING_HISTORY}/${invoiceId}/download`, {
        responseType: 'blob',
        headers: {
            'X-API-Key': TENANT_API_KEY,
        },
        withCredentials: true
    });
    return response.data;
}

const subscriptionService = {
    getCurrentSubscription,
    getCheckout,
    getCheckoutChange,
    cancelSubscription,
    getBillingHistory,
    getPlans,
    getCompanySubscription,
    getAdminSubscriptions,
    getAdminInvoices,
    downloadInvoice
}

export default subscriptionService;