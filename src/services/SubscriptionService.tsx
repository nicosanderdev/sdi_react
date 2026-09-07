import { BillingHistoryData } from '../models/subscriptions/BillingHistoryData';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import { PlanData } from '../models/subscriptions/PlanData';
import { supabase } from '../config/supabase';
import { getCurrentUserId, getMemberByUserId } from './SupabaseHelpers';
import { PlanKey } from '../models/subscriptions/PlanKey';
import { generateInvoicePdfBlob } from '../utils/generateInvoicePdf';

/**
 * Maps database integer Key value to PlanKey enum
 * Database stores: 0 = FREE, 1 = MANAGER_PRO, 2 = COMPANY_SMALL/COMPANY_UNLIMITED
 */
const intToPlanKey = (keyInt: number): PlanKey => {
    const mapping: Record<number, PlanKey> = {
        0: PlanKey.FREE,
        1: PlanKey.MANAGER_PRO,
        2: PlanKey.COMPANY_SMALL,
        4: PlanKey.COMPANY_UNLIMITED,
        5: PlanKey.COMPANY_FREE,
    };
    return mapping[keyInt] ?? PlanKey.FREE;
};

const mapPlanRow = (plan: any): PlanData => ({
    id: plan.Id,
    key: intToPlanKey(plan.Key ?? 0),
    name: plan.Name,
    monthlyPrice: Number(plan.Price ?? plan.MonthlyPrice ?? 0),
    currency: plan.Currency ?? 'UYU',
    maxProperties: plan.MaxProperties ?? null,
    maxUsers: plan.MaxUsers ?? null,
    maxStorageMb: plan.MaxStorageMb ?? null,
    billingCycle: String(plan.DurationDays ?? plan.BillingCycle ?? 30),
    isActive: Boolean(plan.IsActiveV2 ?? plan.IsActive ?? true),
    publishedProperties: plan.MaxPublishedProperties ?? null,
    totalProperties: plan.MaxProperties ?? null,
    bookingReceiptMinimumAmount: plan.BookingReceiptMinimumAmount ?? undefined,
    propertyType: plan.PropertyType,
    maxPhotosPerProperty: plan.MaxPhotosPerProperty ?? null,
    audience: plan.Audience === 'company' ? 'company' : 'member',
});

export const isPlanPaymentRequiredError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return message.includes('PLAN_PAYMENT_REQUIRED');
};

const mapInvoiceRow = (item: {
    Id: string;
    BillingCycleId?: string | null;
    Total: number | string;
    Status: string;
    UpdatedAt?: string | null;
    CreatedAt: string;
    PaidAt?: string | null;
}): BillingHistoryData => ({
    id: item.Id,
    subscriptionId: item.BillingCycleId || '',
    providerInvoiceId: item.Id,
    amount: parseFloat(String(item.Total)),
    currency: 'UYU',
    status: item.Status === 'paid' ? '0' : '1',
    paidAt: new Date(item.PaidAt || item.UpdatedAt || item.CreatedAt),
    createdAt: new Date(item.CreatedAt),
});

/**
 * @returns The current subscription, or free plan if no subscription found
 */
const getCurrentSubscription = async (): Promise<SubscriptionData> => {
    try {
        const userId = await getCurrentUserId();

        const member = await getMemberByUserId(userId);
        if (!member) throw new Error('Member not found for user');

        const { data: memberPlanData, error } = await supabase
            .from('BillingPlanAssignments')
            .select(`
                *,
                Plans (*)
            `)
            .eq('SubjectType', 'member')
            .eq('MemberOrCompanyId', member.Id)
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
                .eq('Key', 0)
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
                    maxProperties: plan.MaxProperties ?? null,
                    maxUsers: plan.MaxUsers ?? null,
                    maxStorageMb: plan.MaxStorageMb ?? null,
                    billingCycle: plan.BillingCycle.toString(),
                    isActive: plan.IsActive,
                    publishedProperties: plan.MaxPublishedProperties ?? null,
                    totalProperties: plan.MaxProperties ?? null,
                    bookingReceiptMinimumAmount: plan.BookingReceiptMinimumAmount ?? undefined,
                    maxPhotosPerProperty: plan.MaxPhotosPerProperty ?? null
                };
            } else {
                // Fallback when Free plan row is missing — match Plan BASE-Inicial defaults
                freePlan = {
                    id: '',
                    key: PlanKey.FREE,
                    name: 'Free',
                    monthlyPrice: 0,
                    currency: 'USD',
                    maxProperties: 20,
                    maxUsers: 1,
                    maxStorageMb: 0,
                    billingCycle: '1',
                    isActive: true,
                    publishedProperties: 15,
                    totalProperties: 20,
                    bookingReceiptMinimumAmount: undefined,
                    maxPhotosPerProperty: null
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
            ownerId: row.MemberOrCompanyId,
            providerCustomerId: '',
            providerSubscriptionId: '',
            planId: row.PlanId,
            plan: {
                id: plan.Id,
                key: intToPlanKey(plan.Key ?? 0),
                name: plan.Name,
                monthlyPrice: Number(plan.Price ?? plan.MonthlyPrice ?? 0),
                currency: plan.Currency ?? 'USD',
                maxProperties: plan.MaxProperties ?? null,
                maxUsers: plan.MaxUsers ?? null,
                maxStorageMb: plan.MaxStorageMb ?? null,
                billingCycle: String(plan.DurationDays ?? plan.BillingCycle ?? 30),
                isActive: Boolean(plan.IsActiveV2 ?? plan.IsActive ?? true),
                publishedProperties: plan.MaxPublishedProperties ?? null,
                totalProperties: plan.MaxProperties ?? null,
                bookingReceiptMinimumAmount: plan.BookingReceiptMinimumAmount ?? undefined,
                propertyType: plan.PropertyType as any,
                maxPhotosPerProperty: plan.MaxPhotosPerProperty ?? null
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
                maxProperties: 20,
                maxUsers: 1,
                maxStorageMb: 0,
                billingCycle: '1',
                isActive: true,
                publishedProperties: 15,
                totalProperties: 20,
                bookingReceiptMinimumAmount: undefined,
                maxPhotosPerProperty: null
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
 * Company Admin (or platform admin via RLS) changes the active company plan assignment.
 * Paid checkout uses createPlanCheckout; this covers assign/change when payment is not required.
 */
const changeCompanyPlan = async (companyId: string, planId: string): Promise<SubscriptionData> => {
    const { error } = await supabase.rpc('change_company_plan_for_current_admin', {
        p_company_id: companyId,
        p_plan_id: planId,
    });
    if (error) throw error;

    const subscription = await getCompanySubscription(companyId);
    if (!subscription) {
        throw new Error('Failed to load company subscription after plan change');
    }
    return subscription;
};

const createPlanCheckout = async (params: {
    kind: 'create_company' | 'change_company';
    planId: string;
    name?: string;
    billingEmail?: string;
    description?: string;
    companyId?: string;
}): Promise<{ checkoutUrl: string; attemptId: string }> => {
    const { data, error } = await supabase.functions.invoke('mercado-pago-create-plan-preference', {
        body: params,
    });
    if (error) throw error;
    const body = data as { success?: boolean; checkoutUrl?: string; attemptId?: string; error?: string };
    if (!body?.success || !body.checkoutUrl) {
        throw new Error(body?.error || 'No se pudo iniciar el pago del plan');
    }
    return { checkoutUrl: body.checkoutUrl, attemptId: body.attemptId || '' };
};

/**
 * Company Admin (or platform admin): cancel the paid company plan onto the cheapest active $0 company plan.
 */
const cancelCompanyPlan = async (companyId: string): Promise<SubscriptionData> => {
    const { error } = await supabase.rpc('cancel_company_plan_for_current_admin', {
        p_company_id: companyId,
    });
    if (error) throw error;

    const subscription = await getCompanySubscription(companyId);
    if (!subscription) {
        throw new Error('Failed to load company subscription after cancel');
    }
    return subscription;
};

/**
 * Gets billing history for the current member, or for a company when companyId is set.
 */
const getBillingHistory = async (filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
    companyId?: string;
}): Promise<BillingHistoryData[]> => {
    try {
        let subjectType: 'member' | 'company' = 'member';
        let subjectId: string | null = null;

        if (filters?.companyId) {
            subjectType = 'company';
            subjectId = filters.companyId;
        } else {
            const userId = await getCurrentUserId();
            const member = await getMemberByUserId(userId);
            if (!member) return [];
            subjectId = member.Id;
        }

        let query = supabase
            .from('Invoices')
            .select('*')
            .eq('SubjectType', subjectType)
            .eq('MemberOrCompanyId', subjectId)
            .order('CreatedAt', { ascending: false });

        if (filters?.dateFrom) {
            query = query.gte('CreatedAt', filters.dateFrom.toISOString());
        }
        if (filters?.dateTo) {
            query = query.lte('CreatedAt', filters.dateTo.toISOString());
        }
        if (filters?.status !== undefined) {
            query = query.eq('Status', filters.status === '0' ? 'paid' : 'pending');
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data ?? []).map(mapInvoiceRow);

    } catch (error: any) {
        console.error('Error fetching billing history:', error.message);
        throw error;
    }
}

/**
 * Gets all available plans
 * @returns List of available plans
 */
const getPlans = async (audience?: 'member' | 'company'): Promise<PlanData[]> => {
    try {
        let query = supabase
            .from('Plans')
            .select('*')
            .eq('IsDeleted', false)
            .or('IsActiveV2.eq.true,IsActive.eq.true')
            .order('Price', { ascending: true });

        if (audience) {
            query = query.eq('Audience', audience);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map(mapPlanRow);
    } catch (error: any) {
        console.error('Error fetching plans:', error.message);
        throw error;
    }
}

const COMPANY_FREE_PLAN_ID = '66666666-6666-4666-8666-666666666666';

const getCompanyFreeLandingPlan = async (): Promise<PlanData | null> => {
    const plans = await getPlans('company');
    const freePlans = plans.filter(plan => plan.isActive && Number(plan.monthlyPrice ?? 0) <= 0);
    if (freePlans.length === 0) return null;
    const designated = freePlans.find(plan => plan.id === COMPANY_FREE_PLAN_ID);
    if (designated) return designated;
    return [...freePlans].sort((a, b) => {
        const aMax = a.maxProperties ?? Number.MAX_SAFE_INTEGER;
        const bMax = b.maxProperties ?? Number.MAX_SAFE_INTEGER;
        if (aMax !== bMax) return aMax - bMax;
        return a.name.localeCompare(b.name, 'es');
    })[0];
};

/**
 * Active company-subject BillingPlanAssignment, or null when none.
 */
const getCompanySubscription = async (companyId: string): Promise<SubscriptionData | null> => {
    const { data, error } = await supabase
        .from('BillingPlanAssignments')
        .select(`*, Plans (*)`)
        .eq('SubjectType', 'company')
        .eq('MemberOrCompanyId', companyId)
        .eq('IsActive', true)
        .order('StartDate', { ascending: false })
        .limit(1);

    if (error) throw error;
    if (!data?.length) return null;

    const row = data[0];
    const plan = row.Plans;
    const billingCycle = plan?.DurationDays ?? 30;
    const startDate = new Date(row.StartDate ?? row.Created ?? new Date().toISOString());
    const endDate = row.EndDate
        ? new Date(row.EndDate)
        : new Date(startDate.getTime() + billingCycle * 24 * 60 * 60 * 1000);

    return {
        id: row.Id,
        ownerType: '1',
        ownerId: row.MemberOrCompanyId,
        providerCustomerId: '',
        providerSubscriptionId: '',
        planId: row.PlanId,
        plan: {
            id: plan.Id,
            key: intToPlanKey(plan.Key ?? 0),
            name: plan.Name,
            monthlyPrice: Number(plan.Price ?? plan.MonthlyPrice ?? 0),
            currency: plan.Currency ?? 'USD',
            maxProperties: plan.MaxProperties ?? null,
            maxUsers: plan.MaxUsers ?? null,
            maxStorageMb: plan.MaxStorageMb ?? null,
            billingCycle: String(plan.DurationDays ?? plan.BillingCycle ?? 30),
            isActive: Boolean(plan.IsActiveV2 ?? plan.IsActive ?? true),
            publishedProperties: plan.MaxPublishedProperties ?? null,
            totalProperties: plan.MaxProperties ?? null,
            bookingReceiptMinimumAmount: plan.BookingReceiptMinimumAmount ?? undefined,
            propertyType: plan.PropertyType as any,
            maxPhotosPerProperty: plan.MaxPhotosPerProperty ?? null,
        },
        status: row.IsActive ? '1' : '0',
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate,
        cancelAtPeriodEnd: false,
        createdAt: new Date(row.Created ?? new Date().toISOString()),
        updatedAt: new Date(row.LastModified ?? new Date().toISOString()),
    };
};

/**
 * Gets all subscriptions (admin only)
 * @param filters - Optional filters (active, canceled, overdue)
 * @returns List of subscriptions
 */
const getAdminSubscriptions = async (_filters?: { status?: string; overdue?: boolean }): Promise<SubscriptionData[]> => {
    try {
        const { data, error } = await supabase
            .from('BillingPlanAssignments')
            .select(`*, Plans(*)`)
            .eq('IsActive', true)
            .order('StartDate', { ascending: false });

        if (error) throw error;

        return (data ?? []).map((row: any) => ({
            id: row.Id,
            ownerType: row.SubjectType === 'company' ? '1' : '0',
            ownerId: row.MemberOrCompanyId,
            providerCustomerId: '',
            providerSubscriptionId: '',
            planId: row.PlanId,
            plan: {
                id: row.Plans?.Id,
                key: intToPlanKey(row.Plans?.Key ?? 0),
                name: row.Plans?.Name ?? 'Plan',
                monthlyPrice: Number(row.Plans?.Price ?? row.Plans?.MonthlyPrice ?? 0),
                currency: row.Plans?.Currency ?? 'USD',
                maxProperties: row.Plans?.MaxProperties ?? null,
                maxUsers: row.Plans?.MaxUsers ?? null,
                maxStorageMb: row.Plans?.MaxStorageMb ?? null,
                billingCycle: String(row.Plans?.DurationDays ?? row.Plans?.BillingCycle ?? 30),
                isActive: Boolean(row.Plans?.IsActiveV2 ?? row.Plans?.IsActive ?? true),
                publishedProperties: row.Plans?.MaxPublishedProperties ?? null,
                totalProperties: row.Plans?.MaxProperties ?? null,
                bookingReceiptMinimumAmount: row.Plans?.BookingReceiptMinimumAmount ?? undefined,
                propertyType: row.Plans?.PropertyType,
                maxPhotosPerProperty: row.Plans?.MaxPhotosPerProperty ?? null
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
 * Builds a receipt PDF from the Invoices row and its UsageRecords.
 */
const downloadInvoice = async (invoiceId: string): Promise<Blob> => {
    const { data: invoice, error: invoiceError } = await supabase
        .from('Invoices')
        .select('*')
        .eq('Id', invoiceId)
        .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error('Factura no encontrada');

    const { data: usageRows, error: usageError } = await supabase
        .from('UsageRecords')
        .select('Type, Amount, CreatedAt')
        .eq('InvoiceId', invoiceId)
        .order('CreatedAt', { ascending: true });

    if (usageError) throw usageError;

    let billedTo = '';
    if (invoice.SubjectType === 'company') {
        const { data: company } = await supabase
            .from('Companies')
            .select('Name, BillingEmail')
            .eq('Id', invoice.MemberOrCompanyId)
            .maybeSingle();
        billedTo = company?.Name || company?.BillingEmail || 'Compañía';
    } else {
        const { data: member } = await supabase
            .from('Members')
            .select('FirstName, LastName, Email')
            .eq('Id', invoice.MemberOrCompanyId)
            .maybeSingle();
        const fullName = `${member?.FirstName ?? ''} ${member?.LastName ?? ''}`.trim();
        billedTo = fullName || member?.Email || 'Miembro';
    }

    return generateInvoicePdfBlob({
        invoiceId: invoice.Id,
        billedTo,
        createdAt: new Date(invoice.CreatedAt),
        dueDate: invoice.DueDate ? new Date(invoice.DueDate) : null,
        paidAt: invoice.PaidAt ? new Date(invoice.PaidAt) : null,
        status: invoice.Status,
        total: parseFloat(String(invoice.Total)),
        lines: (usageRows ?? []).map((row: { Type: string; Amount: number | string; CreatedAt: string }) => ({
            type: row.Type,
            amount: parseFloat(String(row.Amount)),
            createdAt: new Date(row.CreatedAt),
        })),
    });
};

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
                    maxProperties: 20,
                    maxUsers: 1,
                    maxStorageMb: 0,
                    billingCycle: '1',
                    isActive: true,
                    publishedProperties: 15,
                    totalProperties: 20,
                    bookingReceiptMinimumAmount: undefined,
                    maxPhotosPerProperty: null
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
    createPlanCheckout,
    changeCompanyPlan,
    cancelCompanyPlan,
    getCompanyFreeLandingPlan,
    getBillingHistory,
    getPlans,
    getCompanySubscription,
    getAdminSubscriptions,
    downloadInvoice,
    getSubscriptionStatus
}

export default subscriptionService;