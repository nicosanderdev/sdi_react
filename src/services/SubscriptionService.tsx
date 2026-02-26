import { BillingHistoryData } from '../models/subscriptions/BillingHistoryData';
import { CancelSubscriptionRequest } from '../models/subscriptions/CancelSubscriptionRequest';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import { PlanData } from '../models/subscriptions/PlanData';
import apiClient from './AxiosClient'; // Keep for Stripe operations
import { supabase } from '../config/supabase';
import { mapDbToSubscription, getCurrentUserId } from './SupabaseHelpers';
import { PlanKey } from '../models/subscriptions/PlanKey';

/**
 * Maps PlanKey enum to database integer Key value
 * Database stores: 0 = FREE, 1 = MANAGER_PRO, 2 = COMPANY_SMALL/COMPANY_UNLIMITED
 */
const planKeyToInt = (planKey: PlanKey): number => {
    const mapping: Record<PlanKey, number> = {
        [PlanKey.FREE]: 0,
        [PlanKey.MANAGER]: 1, // Note: MANAGER maps to 1, but seed data shows MANAGER_PRO = 1
        [PlanKey.MANAGER_PRO]: 1,
        [PlanKey.COMPANY_SMALL]: 2,
        [PlanKey.COMPANY_UNLIMITED]: 2
    };
    return mapping[planKey] ?? 0;
};

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

// Type for the RPC response from get_admin_subscriptions
interface AdminSubscriptionRpcResponse {
  Id: string;
  OwnerType: number;
  OwnerId: string;
  ProviderCustomerId: string | null;
  ProviderSubscriptionId: string | null;
  PlanId: string;
  Status: number;
  CurrentPeriodStart: string;
  CurrentPeriodEnd: string;
  CancelAtPeriodEnd: boolean;
  CreatedAt: string;
  UpdatedAt: string;
  CompanyId: string | null;
  IsDeleted: boolean;
  Created: string;
  CreatedBy: string | null;
  LastModified: string;
  LastModifiedBy: string | null;
  Plans_Id: string;
  Plans_Key: number; // Database stores Key as integer
  Plans_Name: string;
  Plans_MonthlyPrice: number;
  Plans_Currency: string;
  Plans_MaxProperties: number | null;
  Plans_MaxPublishedProperties: number | null;
  Plans_MaxUsers: number | null;
  Plans_MaxStorageMb: number | null;
  Plans_BillingCycle: number;
  Plans_IsActive: boolean;
  Plans_IsDeleted: boolean;
  Plans_Created: string;
  Plans_CreatedBy: string | null;
  Plans_LastModified: string;
  Plans_LastModifiedBy: string | null;
}

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

        // If no subscription found, return free plan subscription
        if (!subscriptionData || subscriptionData.length === 0) {
            // Try to fetch free plan from database
            const { data: freePlanData, error: freePlanError } = await supabase
                .from('Plans')
                .select('*')
                .eq('Key', planKeyToInt(PlanKey.FREE))
                .eq('IsActive', true)
                .eq('IsDeleted', false)
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

            // Return free plan subscription
            return {
                id: '',
                ownerType: '0',
                ownerId: userId,
                providerCustomerId: '',
                providerSubscriptionId: '',
                planId: freePlan.id,
                plan: freePlan,
                status: '0', // 0 = inactive/free plan
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(),
                cancelAtPeriodEnd: false,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        return mapDbToSubscription(subscriptionData[0]);

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

        // First get the user's subscription(s)
        const { data: userSubscriptionData, error: subError } = await supabase
            .from('Subscriptions')
            .select('Id')
            .eq('OwnerId', userId)
            .eq('Status', 1) // Only active subscriptions
            .eq('IsDeleted', false);

        if (subError) throw subError;

        let subscriptionIds: string[] = (userSubscriptionData ?? []).map(sub => sub.Id);

        // If no user-owned subscription, try company-owned subscriptions
        if (subscriptionIds.length === 0) {
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
                    .select('Id')
                    .eq('OwnerType', 1) // Assuming 1 = company ownership
                    .in('OwnerId', companyIds)
                    .eq('Status', 1) // Only active subscriptions
                    .eq('IsDeleted', false);

                if (companyError) throw companyError;
                subscriptionIds = (companySubs ?? []).map(sub => sub.Id);
            }
        }

        if (subscriptionIds.length === 0) {
            return [];
        }

        // Now query billing history for these subscriptions
        let query = supabase
            .from('BillingHistories')
            .select('*')
            .in('SubscriptionId', subscriptionIds)
            .eq('IsDeleted', false)
            .order('Created', { ascending: false });

        // Apply filters
        if (filters?.dateFrom) {
            query = query.gte('Created', filters.dateFrom.toISOString());
        }
        if (filters?.dateTo) {
            query = query.lte('Created', filters.dateTo.toISOString());
        }
        if (filters?.status !== undefined) {
            query = query.eq('Status', parseInt(filters.status));
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data ?? []).map(item => ({
            id: item.Id,
            subscriptionId: item.SubscriptionId,
            providerInvoiceId: item.ProviderInvoiceId,
            amount: parseFloat(item.Amount),
            currency: item.Currency,
            status: item.Status.toString(),
            paidAt: new Date(item.PaidAt || item.Created),
            createdAt: new Date(item.Created)
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
            .eq('IsActive', true)
            .eq('IsDeleted', false)
            .order('MonthlyPrice', { ascending: true });

        if (error) throw error;

        return data?.map(plan => ({
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
            .rpc('get_admin_subscriptions', {
                status_filter: filters?.status || null,
                overdue_filter: filters?.overdue || null
            });

        if (error) throw error;

        // Transform the flat result into the expected nested format for mapDbToSubscription
        return (data as AdminSubscriptionRpcResponse[] || []).map((item: AdminSubscriptionRpcResponse) => {
            // Transform flat columns back to nested structure expected by mapDbToSubscription
            const subscriptionRow = {
                Id: item.Id,
                OwnerType: item.OwnerType,
                OwnerId: item.OwnerId,
                ProviderCustomerId: item.ProviderCustomerId,
                ProviderSubscriptionId: item.ProviderSubscriptionId,
                PlanId: item.PlanId,
                Status: item.Status,
                CurrentPeriodStart: item.CurrentPeriodStart,
                CurrentPeriodEnd: item.CurrentPeriodEnd,
                CancelAtPeriodEnd: item.CancelAtPeriodEnd,
                CreatedAt: item.CreatedAt,
                UpdatedAt: item.UpdatedAt,
                CompanyId: item.CompanyId,
                IsDeleted: item.IsDeleted,
                Created: item.Created,
                CreatedBy: item.CreatedBy,
                LastModified: item.LastModified,
                LastModifiedBy: item.LastModifiedBy,
                Plans: {
                    Id: item.Plans_Id,
                    Key: item.Plans_Key,
                    Name: item.Plans_Name,
                    MonthlyPrice: item.Plans_MonthlyPrice,
                    Currency: item.Plans_Currency,
                    MaxProperties: item.Plans_MaxProperties,
                    MaxPublishedProperties: item.Plans_MaxPublishedProperties || null,
                    MaxUsers: item.Plans_MaxUsers,
                    MaxStorageMb: item.Plans_MaxStorageMb,
                    BillingCycle: item.Plans_BillingCycle,
                    IsActive: item.Plans_IsActive,
                    IsDeleted: item.Plans_IsDeleted,
                    Created: item.Plans_Created,
                    CreatedBy: item.Plans_CreatedBy,
                    LastModified: item.Plans_LastModified,
                    LastModifiedBy: item.Plans_LastModifiedBy
                }
            };

            return mapDbToSubscription(subscriptionRow);
        });

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