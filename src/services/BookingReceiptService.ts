import { supabase } from '../config/supabase';
import { getCurrentUserId } from './SupabaseHelpers';
import subscriptionService from './SubscriptionService';
import { PlanKey } from '../models/subscriptions/PlanKey';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import { PlanData } from '../models/subscriptions/PlanData';
import {
  BookingReceipt,
  BookingReceiptStatus
} from '../models/subscriptions/BookingReceipt';
import { BookingStatus } from '../models/calendar/CalendarSync';

// Free: create receipt when min amount or 15 days; 7 days to pay; block after 7 days overdue
const FREE_RECEIPT_DAYS = 15;
const FREE_PAY_DAYS = 7;
const FREE_BLOCK_GRACE_DAYS = 7;
// Pro/Business: receipt every 30 days; 15 days to pay; block after 15 days overdue
const PRO_RECEIPT_DAYS = 30;
const PRO_PAY_DAYS = 15;
const PRO_BLOCK_GRACE_DAYS = 15;

const CONFIRMED_OR_COMPLETED = [BookingStatus.Confirmed, BookingStatus.Completed];

function isFreePlan(plan: PlanData): boolean {
  return plan.key === PlanKey.FREE;
}

function isProOrBusiness(plan: PlanData): boolean {
  return (
    plan.key === PlanKey.MANAGER_PRO ||
    plan.key === PlanKey.COMPANY_SMALL ||
    plan.key === PlanKey.COMPANY_UNLIMITED
  );
}

/**
 * Compute commission for one booking from plan's percentage and minimum.
 * Uses booking TotalAmount; if null, 0. Currency conversion not applied (same-currency assumption).
 */
function computeCommission(
  totalAmount: number,
  commissionPct: number | null | undefined,
  commissionMin: number | null | undefined
): number {
  const pct = commissionPct ?? 0;
  const min = commissionMin ?? 0;
  const fromPct = totalAmount * (pct / 100);
  return Math.max(fromPct, min);
}

/** Minimal subscription shape needed to resolve owner and properties */
interface SubscriptionOwner {
  ownerType: string;
  ownerId: string;
}

/**
 * Get Owner.Id (from Owners table) for the subscription's owner.
 * subscription.ownerId is userId for member (OwnerType 0) or companyId for company (OwnerType 1).
 */
async function getOwnerIdsForSubscription(
  subscription: SubscriptionOwner
): Promise<string[]> {
  const ownerType = parseInt(subscription.ownerType, 10);
  const ownerId = subscription.ownerId;

  if (ownerType === 0) {
    // Member: resolve Member.Id from userId (ownerId is userId in this app)
    const { data: members } = await supabase
      .from('Members')
      .select('Id')
      .eq('UserId', ownerId)
      .eq('IsDeleted', false);
    const memberIds = (members ?? []).map((m) => m.Id);
    if (memberIds.length === 0) return [];

    const { data: owners } = await supabase
      .from('Owners')
      .select('Id')
      .eq('OwnerType', 'member')
      .in('MemberId', memberIds)
      .eq('IsDeleted', false);
    return (owners ?? []).map((o) => o.Id);
  }

  if (ownerType === 1) {
    const { data: owners } = await supabase
      .from('Owners')
      .select('Id')
      .eq('OwnerType', 'company')
      .eq('CompanyId', ownerId)
      .eq('IsDeleted', false);
    return (owners ?? []).map((o) => o.Id);
  }

  return [];
}

/**
 * Get all EstateProperty Ids owned by this subscription's owner.
 */
async function getPropertyIdsForSubscription(
  subscription: SubscriptionOwner
): Promise<string[]> {
  const ownerIds = await getOwnerIdsForSubscription(subscription);
  if (ownerIds.length === 0) return [];

  const { data: rows } = await supabase
    .from('EstateProperties')
    .select('Id')
    .in('OwnerId', ownerIds)
    .eq('IsDeleted', false);
  return (rows ?? []).map((r) => r.Id);
}

/**
 * Get booking IDs that are already in a paid receipt (so excluded from "unpaid").
 */
async function getPaidBookingIds(subscriptionId: string): Promise<Set<string>> {
  const { data: receipts } = await supabase
    .from('BookingReceipts')
    .select('Id')
    .eq('SubscriptionId', subscriptionId)
    .not('PaidAt', 'is', null)
    .eq('IsDeleted', false);

  const receiptIds = (receipts ?? []).map((r) => r.Id);
  if (receiptIds.length === 0) return new Set();

  const { data: items } = await supabase
    .from('BookingReceiptItems')
    .select('BookingId')
    .in('BookingReceiptId', receiptIds);
  const paid = new Set((items ?? []).map((i) => i.BookingId));
  return paid;
}

export interface UnpaidBookingRow {
  Id: string;
  EstatePropertyId: string;
  TotalAmount: number | null;
  Created: string;
  Status: number;
}

/**
 * Get unpaid bookings for this subscription's properties (Confirmed or Completed, not in paid receipt).
 */
async function getUnpaidBookings(
  subscriptionId: string,
  propertyIds: string[]
): Promise<UnpaidBookingRow[]> {
  if (propertyIds.length === 0) return [];

  const paidIds = await getPaidBookingIds(subscriptionId);

  const { data: bookings } = await supabase
    .from('Bookings')
    .select('Id, EstatePropertyId, TotalAmount, Created, Status')
    .in('EstatePropertyId', propertyIds)
    .in('Status', CONFIRMED_OR_COMPLETED)
    .eq('IsDeleted', false)
    .order('Created', { ascending: true });

  const rows = (bookings ?? []) as UnpaidBookingRow[];
  return rows.filter((b) => !paidIds.has(b.Id));
}

/**
 * Get the latest EstatePropertyValues row Id for each property (for updating visibility).
 */
async function getLatestValueIdsByProperty(
  propertyIds: string[]
): Promise<Record<string, string>> {
  if (propertyIds.length === 0) return {};

  const { data: values } = await supabase
    .from('EstatePropertyValues')
    .select('Id, EstatePropertyId, Created')
    .in('EstatePropertyId', propertyIds)
    .eq('IsDeleted', false);

  const byProperty = (values ?? []).reduce(
    (acc: Record<string, { Id: string; Created: string }>, v) => {
      const key = v.EstatePropertyId;
      const existing = acc[key];
      if (
        !existing ||
        new Date(v.Created).getTime() > new Date(existing.Created).getTime()
      ) {
        acc[key] = { Id: v.Id, Created: v.Created };
      }
      return acc;
    },
    {}
  );
  const out: Record<string, string> = {};
  for (const [propId, v] of Object.entries(byProperty)) {
    out[propId] = v.Id;
  }
  return out;
}

/**
 * Set IsPropertyVisible for all of the owner's properties (latest value row per property).
 */
async function setPropertiesVisibility(
  subscription: SubscriptionOwner,
  visible: boolean
): Promise<void> {
  const propertyIds = await getPropertyIdsForSubscription(subscription);
  if (propertyIds.length === 0) return;

  const latestIds = await getLatestValueIdsByProperty(propertyIds);
  const valueIds = Object.values(latestIds);
  if (valueIds.length === 0) return;

  await supabase
    .from('EstatePropertyValues')
    .update({ IsPropertyVisible: visible, LastModified: new Date().toISOString() })
    .in('Id', valueIds);
}

/**
 * Set BlockedForBooking for all of the owner's properties (latest value row per property).
 * When true: property stays visible but cannot accept new bookings (e.g. overdue receipt).
 */
async function setPropertiesBlockedForBooking(
  subscription: SubscriptionOwner,
  blocked: boolean
): Promise<void> {
  const propertyIds = await getPropertyIdsForSubscription(subscription);
  if (propertyIds.length === 0) return;

  const latestIds = await getLatestValueIdsByProperty(propertyIds);
  const valueIds = Object.values(latestIds);
  if (valueIds.length === 0) return;

  await supabase
    .from('EstatePropertyValues')
    .update({
      BlockedForBooking: blocked,
      LastModified: new Date().toISOString()
    })
    .in('Id', valueIds);
}

/**
 * Create a single receipt with items and due date.
 */
async function createReceipt(
  subscriptionId: string,
  currency: string,
  items: { bookingId: string; amount: number }[],
  dueDate: Date
): Promise<BookingReceipt | null> {
  const amount = items.reduce((s, i) => s + i.amount, 0);

  const { data: receipt, error: receiptError } = await supabase
    .from('BookingReceipts')
    .insert({
      SubscriptionId: subscriptionId,
      Amount: amount,
      Currency: currency,
      DueDate: dueDate.toISOString(),
      PaidAt: null,
      Status: BookingReceiptStatus.Pending,
      IsDeleted: false
    })
    .select('Id')
    .single();

  if (receiptError || !receipt) return null;

  for (const item of items) {
    await supabase.from('BookingReceiptItems').insert({
      BookingReceiptId: receipt.Id,
      BookingId: item.bookingId,
      Amount: item.amount
    });
  }

  return {
    id: receipt.Id,
    subscriptionId,
    amount,
    currency,
    dueDate,
    paidAt: null,
    status: BookingReceiptStatus.Pending,
    createdAt: new Date(),
    lastModified: new Date()
  };
}

/**
 * Pro: create receipt when 30 days since period start (last receipt Created or first unpaid booking).
 */
async function getLastReceiptCreated(
  subscriptionId: string
): Promise<Date | null> {
  const { data } = await supabase
    .from('BookingReceipts')
    .select('Created')
    .eq('SubscriptionId', subscriptionId)
    .eq('IsDeleted', false)
    .order('Created', { ascending: false })
    .limit(1)
    .single();
  return data?.Created ? new Date(data.Created) : null;
}

/**
 * Get unpaid receipts that are past DueDate + grace (overdue for blocking).
 */
async function getOverdueUnpaidReceipts(
  subscriptionId: string,
  graceDays: number
): Promise<BookingReceipt[]> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - graceDays);

  const { data: rows } = await supabase
    .from('BookingReceipts')
    .select('*')
    .eq('SubscriptionId', subscriptionId)
    .eq('IsDeleted', false)
    .is('PaidAt', null)
    .lt('DueDate', cutoff.toISOString());

  return (rows ?? []).map((r) => ({
    id: r.Id,
    subscriptionId: r.SubscriptionId,
    amount: parseFloat(r.Amount),
    currency: r.Currency,
    dueDate: new Date(r.DueDate),
    paidAt: r.PaidAt ? new Date(r.PaidAt) : null,
    status: r.Status as BookingReceiptStatus,
    createdAt: new Date(r.Created),
    lastModified: new Date(r.LastModified)
  }));
}

/**
 * Check if subscription has any overdue unpaid receipt (for blocking).
 */
async function hasOverdueUnpaidReceipt(
  subscriptionId: string,
  graceDays: number
): Promise<boolean> {
  const list = await getOverdueUnpaidReceipts(subscriptionId, graceDays);
  return list.length > 0;
}

export interface EnsureReceiptsResult {
  subscriptionId: string;
  subscription: SubscriptionData;
  unpaidReceipts: BookingReceipt[];
  didCreateReceipt: boolean;
  didBlock: boolean;
  didUnblock: boolean;
}

/**
 * Main entry: ensure receipts are created (if threshold met) and block/unblock properties.
 * Call when owner loads dashboard, billing, or BookingsPage.
 */
export async function ensureReceiptsAndBlockStatus(): Promise<EnsureReceiptsResult | null> {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return null;

  const subscription = await subscriptionService.getCurrentSubscription();
  const plan = subscription.plan;
  const subscriptionId = subscription.id;
  // No subscription id when on free fallback (id === '')
  if (!subscriptionId) {
    // Still run block check for free users: they have a logical "subscription" with id ''
    // We cannot create receipts without a real Subscription row. So for free plan without
    // a row we skip receipt creation but could still block if we had receipts. For now skip.
    return null;
  }

  const propertyIds = await getPropertyIdsForSubscription(subscription);
  const unpaidRows = await getUnpaidBookings(subscriptionId, propertyIds);

  const currency = plan.currency ?? 'USD';

  // Fetch plan from DB for commission and receipt minimum (not all fields on subscription.plan)
  const { data: planRow } = await supabase
    .from('Plans')
    .select('CommissionPercentage, CommissionMinimumAmount, BookingReceiptMinimumAmount')
    .eq('Id', subscription.planId)
    .single();

  const pct = planRow?.CommissionPercentage ?? 0;
  const minAmt = planRow?.CommissionMinimumAmount ?? 0;
  const receiptMinAmount = planRow?.BookingReceiptMinimumAmount ?? plan.bookingReceiptMinimumAmount ?? 0;

  let didCreateReceipt = false;

  // Compute unpaid commission and earliest booking date
  const unpaidWithCommission = unpaidRows.map((b) => {
    const total = b.TotalAmount != null ? Number(b.TotalAmount) : 0;
    const amount = computeCommission(total, pct, minAmt);
    return { ...b, commission: amount };
  });
  const totalUnpaidCommission = unpaidWithCommission.reduce(
    (s, b) => s + b.commission,
    0
  );
  const earliestUnpaidDate =
    unpaidRows.length > 0
      ? new Date(unpaidRows[0].Created)
      : null;

  if (isFreePlan(plan) && unpaidWithCommission.length > 0) {
    const now = new Date();
    const daysSinceFirst =
      earliestUnpaidDate
        ? (now.getTime() - earliestUnpaidDate.getTime()) / (24 * 60 * 60 * 1000)
        : 0;
    const hitMinAmount = totalUnpaidCommission >= receiptMinAmount;
    const hit15Days = daysSinceFirst >= FREE_RECEIPT_DAYS;
    if (hitMinAmount || hit15Days) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + FREE_PAY_DAYS);
      const created = await createReceipt(
        subscriptionId,
        currency,
        unpaidWithCommission.map((b) => ({ bookingId: b.Id, amount: b.commission })),
        dueDate
      );
      if (created) didCreateReceipt = true;
    }
  }

  if (isProOrBusiness(plan) && unpaidWithCommission.length > 0) {
    const lastReceipt = await getLastReceiptCreated(subscriptionId);
    const periodStart = lastReceipt ?? earliestUnpaidDate ?? new Date();
    const now = new Date();
    const daysSincePeriod =
      (now.getTime() - new Date(periodStart).getTime()) /
      (24 * 60 * 60 * 1000);
    if (daysSincePeriod >= PRO_RECEIPT_DAYS) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + PRO_PAY_DAYS);
      const created = await createReceipt(
        subscriptionId,
        currency,
        unpaidWithCommission.map((b) => ({ bookingId: b.Id, amount: b.commission })),
        dueDate
      );
      if (created) didCreateReceipt = true;
    }
  }

  const graceDays = isFreePlan(plan)
    ? FREE_BLOCK_GRACE_DAYS
    : PRO_BLOCK_GRACE_DAYS;
  const hasOverdue = await hasOverdueUnpaidReceipt(subscriptionId, graceDays);

  let didBlock = false;
  let didUnblock = false;

  if (hasOverdue) {
    await setPropertiesBlockedForBooking(subscription, true);
    didBlock = true;
  }
  // Unblock only happens in markReceiptPaid when receipt is paid

  const allUnpaid = await supabase
    .from('BookingReceipts')
    .select('*')
    .eq('SubscriptionId', subscriptionId)
    .eq('IsDeleted', false)
    .is('PaidAt', null)
    .order('DueDate', { ascending: true });
  const unpaidList = (allUnpaid.data ?? []).map((r) => ({
    id: r.Id,
    subscriptionId: r.SubscriptionId,
    amount: parseFloat(r.Amount),
    currency: r.Currency,
    dueDate: new Date(r.DueDate),
    paidAt: r.PaidAt ? new Date(r.PaidAt) : null,
    status: r.Status as BookingReceiptStatus,
    createdAt: new Date(r.Created),
    lastModified: new Date(r.LastModified)
  }));

  return {
    subscriptionId,
    subscription,
    unpaidReceipts: unpaidList,
    didCreateReceipt,
    didBlock,
    didUnblock
  };
}

/**
 * Fetch unpaid receipts for the current user's subscription(s).
 */
export async function getUnpaidReceipts(): Promise<BookingReceipt[]> {
  const subscription = await subscriptionService.getCurrentSubscription();
  if (!subscription.id) return [];

  const { data: rows } = await supabase
    .from('BookingReceipts')
    .select('*')
    .eq('SubscriptionId', subscription.id)
    .eq('IsDeleted', false)
    .is('PaidAt', null)
    .order('DueDate', { ascending: true });

  return (rows ?? []).map((r) => ({
    id: r.Id,
    subscriptionId: r.SubscriptionId,
    amount: parseFloat(r.Amount),
    currency: r.Currency,
    dueDate: new Date(r.DueDate),
    paidAt: r.PaidAt ? new Date(r.PaidAt) : null,
    status: r.Status as BookingReceiptStatus,
    createdAt: new Date(r.Created),
    lastModified: new Date(r.LastModified)
  }));
}

/**
 * Mark a receipt as paid (e.g. after payment provider callback). Then unblock that subscription's properties.
 */
export async function markReceiptPaid(receiptId: string): Promise<boolean> {
  const { data: receipt, error: upErr } = await supabase
    .from('BookingReceipts')
    .update({
      PaidAt: new Date().toISOString(),
      Status: BookingReceiptStatus.Paid,
      LastModified: new Date().toISOString()
    })
    .eq('Id', receiptId)
    .select('SubscriptionId')
    .single();

  if (upErr || !receipt) return false;

  const { data: subRow } = await supabase
    .from('Subscriptions')
    .select('OwnerType, OwnerId')
    .eq('Id', receipt.SubscriptionId)
    .single();
  if (subRow) {
    await setPropertiesBlockedForBooking(
      { ownerType: String(subRow.OwnerType), ownerId: subRow.OwnerId },
      false
    );
  }
  return true;
}

const BookingReceiptService = {
  ensureReceiptsAndBlockStatus,
  getUnpaidReceipts,
  markReceiptPaid,
  setPropertiesVisibility,
  FREE_PAY_DAYS,
  FREE_BLOCK_GRACE_DAYS,
  PRO_PAY_DAYS,
  PRO_BLOCK_GRACE_DAYS
};

export default BookingReceiptService;
