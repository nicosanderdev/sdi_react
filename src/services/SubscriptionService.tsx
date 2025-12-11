import { BillingHistoryData, BillingHistoryList } from '../models/subscriptions/BillingHistoryData';
import { CancelSubscriptionRequest } from '../models/subscriptions/CancelSubscriptionRequest';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import { PlanData } from '../models/subscriptions/PlanData';
import apiClient from './AxiosClient'; // Keep for Stripe operations
import { supabase } from '../config/supabase';
import { mapDbToSubscription, getCurrentUserId } from './SupabaseHelpers';
import { PlanKey } from '../models/subscriptions/PlanKey';
import { log } from 'console';

const ENDPOINTS = {
    CURRENT_SUBSCRIPTION: '/subscriptions/current',
    CHECKOUT: '/subscriptions/checkout',
    CREATE_PAYMENT_SESSION: '/payments/create-session',
    CHANGE: '/subscriptions/change',
    CANCEL: '/subscriptions/cancel',
    BILLING_HISTORY: '/subscriptions/billing-history',
    PLANS: '/plans',
    COMPANY_SUBSCRIPTION: '/companies/{id}/subscription',
    ADMIN_SUBSCRIPTIONS: '/admin/subscriptions',
    ADMIN_INVOICES: '/admin/invoices',
    ADMIN_MANUAL_INVOICE: '/admin/manual-invoice',
    WEBHOOKS_PAYMENTS: '/webhooks/payments',
    SUBSCRIPTION_STATUS: '/subscriptions/status'
}

/**
 * @returns The current subscription
 */
const getCurrentSubscription = async (): Promise<SubscriptionData> => {
    try {
        const userId = await getCurrentUserId();

        // First try to find subscription by user ownership
        const { data: userSubscriptionData, error } = await supabase
            .from('Subscriptions')
            .select(`
                *,
                Plans (*)
            `)
            .eq('OwnerId', userId)
            .eq('Status', 1) // Only active subscriptions
            .eq('IsDeleted', false)
            .order('CreatedAt', { ascending: false })
            .limit(1);

        if (error) throw error;

        let subscriptionData = userSubscriptionData ?? [];

        // If no user-owned subscription, try company-owned subscriptions where user is a member
        if (subscriptionData.length === 0) {
            const { data: userCompanies, error: companiesError } = await supabase
                .from('UserCompanies')
                .select('CompanyId')
                .eq('MemberId', userId)
                .eq('IsDeleted', false);

            if (companiesError) throw companiesError;

            const companyIds = (userCompanies ?? [])
                .map(uc => uc.CompanyId)
                .filter(Boolean);

            if (companyIds.length > 0) {
                const { data: companySubs, error: companyError } = await supabase
                    .from('Subscriptions')
                    .select(`
                        *,
                        Plans (*)
                    `)
                    .eq('OwnerType', 1) // Assuming 1 = company ownership
                    .in('OwnerId', companyIds)
                    .eq('Status', 1) // Only active subscriptions
                    .eq('IsDeleted', false)
                    .order('CreatedAt', { ascending: false })
                    .limit(1);

                if (companyError) throw companyError;
                subscriptionData = companySubs ?? [];
            }
        }

        if (!subscriptionData || subscriptionData.length === 0) {
            throw new Error('No active subscription found');
        }

        return mapDbToSubscription(subscriptionData[0]);

    } catch (error: any) {
        console.log('No active subscription found:', error.message);
        throw error;
    }
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
 * Creates a payment session for subscription purchase
 * @param params - Payment session parameters
 * @returns Payment session data with checkout URL
 */
const createPaymentSession = async (params: {
    planId: string;
    entityType: 'personal' | 'company';
    entityId: string;
}) => {
    try {
        const response = await apiClient.post<{
            checkoutUrl: string;
            sessionId: string;
        }>(ENDPOINTS.CREATE_PAYMENT_SESSION, params);
        return response;
    } catch (error: any) {
        console.error('Error creating payment session:', error.message);
        throw error;
    }
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
const getPlans = async (): Promise<PlanData[]> => {
    try {
        const { data, error } = await supabase
            .from('Plans')
            .select('*')
            .eq('IsActive', true)
            .eq('IsDeleted', false)
            .order('MonthlyPrice', { ascending: true });

        if (error) throw error;

        return data?.map(plan => ({
            id: plan.Id,
            key: plan.Key,
            name: plan.Name,
            monthlyPrice: plan.MonthlyPrice,
            currency: plan.Currency,
            maxProperties: plan.MaxProperties || 0,
            maxUsers: plan.MaxUsers || 0,
            maxStorageMb: plan.MaxStorageMb || 0,
            billingCycle: plan.BillingCycle.toString(),
            isActive: plan.IsActive
        })) || [];

    } catch (error: any) {
        console.error('Error fetching plans:', error.message);
        throw error;
    }
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

/**
 * Gets the current subscription status including user access permissions
 * @returns The subscription status with user access information
 */
const getSubscriptionStatus = async (user?: any): Promise<{
    subscription: SubscriptionData;
    userAccess: { hasCompanyAccess: boolean; companyIds: string[] }
}> => {
    try {
        const userId = await getCurrentUserId(user);

        // Get user companies
        const { data: userCompanies, error: companiesError } = await supabase
            .from('UserCompanies')
            .select('CompanyId')
            .eq('MemberId', userId)
            .eq('IsDeleted', false);

        if (companiesError) throw companiesError;

        const companyIds = userCompanies?.map(uc => uc.CompanyId) || [];
        const hasCompanyAccess = companyIds.length > 0;

        // Get subscription (same logic as getCurrentSubscription)
        let subscription: SubscriptionData;

        try {
            subscription = await getCurrentSubscription();
        } catch (subError) {
            // If no subscription found, create a default one
            subscription = {
                id: '',
                ownerType: '0',
                ownerId: userId,
                providerCustomerId: '',
                providerSubscriptionId: '',
                planId: '',
                plan: {
                    id: '',
                    key: PlanKey.FREE,
                    name: 'Free',
                    monthlyPrice: 0,
                    currency: 'USD',
                    maxProperties: 0,
                    maxUsers: 1,
                    maxStorageMb: 0,
                    billingCycle: '1',
                    isActive: true
                },
                status: '0', // Assuming 0 = inactive/cancelled
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(),
                cancelAtPeriodEnd: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        return {
            subscription,
            userAccess: {
                hasCompanyAccess,
                companyIds
            }
        };

    } catch (error: any) {
        console.error('Error fetching subscription status:', error.message);
        throw error;
    }
}

const subscriptionService = {
    getCurrentSubscription,
    getCheckout,
    createPaymentSession,
    getCheckoutChange,
    cancelSubscription,
    getBillingHistory,
    getPlans,
    getCompanySubscription,
    getAdminSubscriptions,
    getAdminInvoices,
    downloadInvoice,
    getSubscriptionStatus
}

export default subscriptionService;