import { BillingHistoryData } from '../models/subscriptions/BillingHistoryData';
import { CancelSubscriptionRequest } from '../models/subscriptions/CancelSubscriptionRequest';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import { PlanData } from '../models/subscriptions/PlanData';
import apiClient from './AxiosClient'; // Keep for Stripe operations
import { supabase } from '../config/supabase';
import { getCurrentUserId, getMemberByUserId } from './SupabaseHelpers';
import { PlanKey } from '../models/subscriptions/PlanKey';

/**
 * Maps database integer Key value to PlanKey enum
 * Database stores: 0 = FREE, 1 = MANAGER_PRO, 2 = COMPANY_SMALL/COMPANY_UNLIMITED
 */
const intToPlanKey = (keyInt: number): PlanKey => {
    const mapping: Record<number, PlanKey> = {
        0: PlanKey.FREE,
        1: PlanKey.MANAGER_PRO, // Default to MANAGER_PRO for 1
        2: PlanKey.COMPANY_SMALL // Default to COMPANY_SMALL for 2
    };
    return mapping[keyInt] ?? PlanKey.FREE;
};

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
 * @returns The current subscription, or free plan if no subscription found
 */
const getCurrentSubscription = async (): Promise<SubscriptionData> => {
    try {
        const userId = await getCurrentUserId();

        const member = await getMemberByUserId(userId);
        if (!member) throw new Error('Member not found for user');

        const { data: memberPlanData, error } = await supabase
            .from('MemberPlans')
            .select(`
                *,
                Plans (*)
            `)
            .eq('MemberId', member.Id)
            .eq('IsActive', true)
            .order('StartDate', { ascending: false })
            .limit(1);

        if (error) throw error;

        // If no subscription found, return free plan subscription
        if (!memberPlanData || memberPlanData.length === 0) {
            // Try to fetch free plan from database
            const { data: freePlanData, error: freePlanError } = await supabase
                .from('Plans')
                .select('*')
                .or('PricingModel.eq.free,Key.eq.0')
                .limit(1);

            let freePlan: PlanData;
            
            if (!freePlanError && freePlanData && freePlanData.length > 0) {
                // Use free plan from database
                const plan = freePlanData[0];
                freePlan = {
                    id: plan.Id,
                    key: intToPlanKey(plan.Key),
                    name: plan.Name,
                    monthlyPrice: plan.MonthlyPrice,
                    currency: plan.Currency,
                    maxProperties: plan.MaxProperties || 0,
                    maxUsers: plan.MaxUsers || 0,
                    maxStorageMb: plan.MaxStorageMb || 0,
                    billingCycle: plan.BillingCycle.toString(),
                    isActive: plan.IsActive,
                    publishedProperties: plan.MaxPublishedProperties || 0,
                    totalProperties: plan.MaxProperties || 0,
                    bookingReceiptMinimumAmount: plan.BookingReceiptMinimumAmount ?? undefined
                };
            } else {
                // Create default free plan object if not found in database (Inicial plan: 5 published, 7 total)
                freePlan = {
                    id: '',
                    key: PlanKey.FREE,
                    name: 'Free',
                    monthlyPrice: 0,
                    currency: 'USD',
                    maxProperties: 7, // Total properties limit
                    maxUsers: 1,
                    maxStorageMb: 0,
                    billingCycle: '1',
                    isActive: true,
                    publishedProperties: 5, // Published properties limit
                    totalProperties: 7, // Total properties limit
                    bookingReceiptMinimumAmount: undefined
                };
            }

            const now = new Date();
            return {
                id: '',
                ownerType: '0',
                ownerId: member.Id,
                providerCustomerId: '',
                providerSubscriptionId: '',
                planId: freePlan.id,
                plan: freePlan,
                status: '0', // 0 = inactive/free plan
                currentPeriodStart: now,
                currentPeriodEnd: now,
                cancelAtPeriodEnd: false,
                createdAt: now,
                updatedAt: now
            };
        }
        const row = memberPlanData[0];
        const plan = row.Plans;
        const billingCycle = plan?.DurationDays ?? 30;
        const startDate = new Date(row.StartDate ?? row.Created ?? new Date().toISOString());
        const endDate = row.EndDate ? new Date(row.EndDate) : new Date(startDate.getTime() + billingCycle * 24 * 60 * 60 * 1000);

        return {
            id: row.Id,
            ownerType: '0',
            ownerId: row.MemberId,
            providerCustomerId: '',
            providerSubscriptionId: '',
            planId: row.PlanId,
            plan: {
                id: plan.Id,
                key: intToPlanKey(plan.Key ?? 0),
                name: plan.Name,
                monthlyPrice: Number(plan.Price ?? plan.MonthlyPrice ?? 0),
                currency: plan.Currency ?? 'USD',
                maxProperties: plan.MaxProperties || 0,
                maxUsers: plan.MaxUsers || 0,
                maxStorageMb: plan.MaxStorageMb || 0,
                billingCycle: String(plan.DurationDays ?? plan.BillingCycle ?? 30),
                isActive: Boolean(plan.IsActiveV2 ?? plan.IsActive ?? true),
                publishedProperties: plan.MaxPublishedProperties || 0,
                totalProperties: plan.MaxProperties || 0,
                bookingReceiptMinimumAmount: plan.BookingReceiptMinimumAmount ?? undefined,
                propertyType: plan.PropertyType as any
            },
            status: row.IsActive ? '1' : '0',
            currentPeriodStart: startDate,
            currentPeriodEnd: endDate,
            cancelAtPeriodEnd: false,
            createdAt: new Date(row.Created ?? new Date().toISOString()),
            updatedAt: new Date(row.LastModified ?? new Date().toISOString())
        };

    } catch (error: any) {
        console.log('Error fetching subscription, returning free plan:', error.message);
        
        // On error, return free plan as fallback
        const userId = await getCurrentUserId().catch(() => '');
        return {
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
                maxProperties: 7, // Total properties limit
                maxUsers: 1,
                maxStorageMb: 0,
                billingCycle: '1',
                isActive: true,
                publishedProperties: 5, // Published properties limit
                totalProperties: 7, // Total properties limit
                bookingReceiptMinimumAmount: undefined
            },
            status: '0',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(),
            cancelAtPeriodEnd: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
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
 * Gets the billing history for the current subscription using Supabase SDK
 * @param filters - Optional filters for date range and status
 * @returns The billing history
 */
const getBillingHistory = async (filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
}): Promise<BillingHistoryData[]> => {
    try {
        const userId = await getCurrentUserId();

        const member = await getMemberByUserId(userId);
        if (!member) {
            return [];
        }

        let query = supabase
            .from('Invoices')
            .select('*')
            .eq('MemberId', member.Id)
            .order('CreatedAt', { ascending: false });

        // Apply filters
        if (filters?.dateFrom) {
            query = query.gte('CreatedAt', filters.dateFrom.toISOString());
        }
        if (filters?.dateTo) {
            query = query.lte('CreatedAt', filters.dateTo.toISOString());
        }
        if (filters?.status !== undefined) {
            query = query.eq('Status', filters.status === '1' ? 'paid' : 'pending');
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data ?? []).map(item => ({
            id: item.Id,
            subscriptionId: item.BillingCycleId || '',
            providerInvoiceId: item.Id,
            amount: parseFloat(item.Total),
            currency: 'USD',
            status: item.Status === 'paid' ? '1' : '0',
            paidAt: new Date(item.UpdatedAt || item.CreatedAt),
            createdAt: new Date(item.CreatedAt)
        }));

    } catch (error: any) {
        console.error('Error fetching billing history:', error.message);
        throw error;
    }
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
            .or('IsActiveV2.eq.true,IsActive.eq.true')
            .order('Price', { ascending: true });

        if (error) throw error;

        return data?.map(plan => ({
            id: plan.Id,
            key: intToPlanKey(plan.Key),
            name: plan.Name,
            monthlyPrice: Number(plan.Price ?? plan.MonthlyPrice ?? 0),
            currency: plan.Currency,
            maxProperties: plan.MaxProperties || 0,
            maxUsers: plan.MaxUsers || 0,
            maxStorageMb: plan.MaxStorageMb || 0,
            billingCycle: String(plan.DurationDays ?? plan.BillingCycle ?? 30),
            isActive: Boolean(plan.IsActiveV2 ?? plan.IsActive ?? true),
            publishedProperties: plan.MaxPublishedProperties || 0,
            totalProperties: plan.MaxProperties || 0,
            bookingReceiptMinimumAmount: plan.BookingReceiptMinimumAmount ?? undefined,
            propertyType: plan.PropertyType as any
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
const getAdminSubscriptions = async (filters?: { status?: string; overdue?: boolean }): Promise<SubscriptionData[]> => {
    try {
        const { data, error } = await supabase
            .from('MemberPlans')
            .select(`*, Plans(*)`)
            .eq('IsActive', true)
            .order('StartDate', { ascending: false });

        if (error) throw error;

        return (data ?? []).map((row: any) => ({
            id: row.Id,
            ownerType: '0',
            ownerId: row.MemberId,
            providerCustomerId: '',
            providerSubscriptionId: '',
            planId: row.PlanId,
            plan: {
                id: row.Plans?.Id,
                key: intToPlanKey(row.Plans?.Key ?? 0),
                name: row.Plans?.Name ?? 'Plan',
                monthlyPrice: Number(row.Plans?.Price ?? row.Plans?.MonthlyPrice ?? 0),
                currency: row.Plans?.Currency ?? 'USD',
                maxProperties: row.Plans?.MaxProperties || 0,
                maxUsers: row.Plans?.MaxUsers || 0,
                maxStorageMb: row.Plans?.MaxStorageMb || 0,
                billingCycle: String(row.Plans?.DurationDays ?? row.Plans?.BillingCycle ?? 30),
                isActive: Boolean(row.Plans?.IsActiveV2 ?? row.Plans?.IsActive ?? true),
                publishedProperties: row.Plans?.MaxPublishedProperties || 0,
                totalProperties: row.Plans?.MaxProperties || 0,
                bookingReceiptMinimumAmount: row.Plans?.BookingReceiptMinimumAmount ?? undefined,
                propertyType: row.Plans?.PropertyType
            },
            status: row.IsActive ? '1' : '0',
            currentPeriodStart: new Date(row.StartDate),
            currentPeriodEnd: row.EndDate ? new Date(row.EndDate) : new Date(row.StartDate),
            cancelAtPeriodEnd: false,
            createdAt: new Date(row.Created ?? row.StartDate),
            updatedAt: new Date(row.LastModified ?? row.StartDate)
        }));

    } catch (error: any) {
        console.error('Error fetching admin subscriptions:', error.message);
        throw error;
    }
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

        const member = await getMemberByUserId(userId);

        let companyIds: string[] = [];

        if (member) {
            const { data: userCompanies, error: companiesError } = await supabase
                .from('CompanyMembers')
                .select('CompanyId')
                .eq('MemberId', member.Id)
                .eq('IsDeleted', false);

            if (companiesError) throw companiesError;

            companyIds = userCompanies?.map(uc => uc.CompanyId) || [];
        }
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
                    maxProperties: 7, // Total properties limit
                    maxUsers: 1,
                    maxStorageMb: 0,
                    billingCycle: '1',
                    isActive: true,
                    publishedProperties: 5, // Published properties limit
                    totalProperties: 7, // Total properties limit
                    bookingReceiptMinimumAmount: undefined
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