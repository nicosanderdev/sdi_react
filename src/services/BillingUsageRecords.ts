import { supabase } from '../config/supabase';

export type PlanPricingModel = 'free' | 'per_booking' | 'per_listing' | 'hybrid';

export interface ActivePlanSnapshot {
  pricingModel: PlanPricingModel | null;
  /** Plan "Price" column — used as line amount for per-listing usage rows. */
  price: number | null;
}

/**
 * Resolves the member that is billed for flexible-billing UsageRecords for a property
 * (owner member, or mapped billing member for companies).
 */
export async function resolveBillingMemberIdByPropertyId(propertyId: string): Promise<string | null> {
  const { data: property, error: propertyError } = await supabase
    .from('EstateProperties')
    .select('OwnerId')
    .eq('Id', propertyId)
    .eq('IsDeleted', false)
    .single();

  if (propertyError) throw propertyError;
  if (!property?.OwnerId) return null;

  const { data: owner, error: ownerError } = await supabase
    .from('Owners')
    .select('OwnerType,MemberId,CompanyId')
    .eq('Id', property.OwnerId)
    .eq('IsDeleted', false)
    .single();

  if (ownerError) throw ownerError;
  if (!owner) return null;

  if (owner.OwnerType === 'member') {
    return owner.MemberId ?? null;
  }

  if (owner.OwnerType === 'company' && owner.CompanyId) {
    const { data: ownerMap, error: ownerMapError } = await supabase
      .from('BillingOwnerMemberMap')
      .select('MemberId')
      .eq('OwnerId', owner.CompanyId)
      .eq('IsActive', true)
      .limit(1);

    if (ownerMapError) throw ownerMapError;
    return ownerMap?.[0]?.MemberId ?? null;
  }

  return null;
}

export async function getActivePlanSnapshotForMember(memberId: string): Promise<ActivePlanSnapshot | null> {
  const now = Date.now();

  const { data: rows, error } = await supabase
    .from('MemberPlans')
    .select(
      `
      StartDate,
      EndDate,
      Plans (
        PricingModel,
        Price,
        IsActive,
        IsActiveV2
      )
    `
    )
    .eq('MemberId', memberId)
    .eq('IsActive', true)
    .order('StartDate', { ascending: false });

  if (error) throw error;

  const data = (rows ?? []).find((r) => {
    const start = new Date(r.StartDate).getTime();
    const end = r.EndDate ? new Date(r.EndDate).getTime() : null;
    if (start > now) return false;
    if (end != null && end < now) return false;
    return true;
  });

  if (!data) return null;

  const plan = data.Plans as
    | { PricingModel?: string | null; Price?: number | null; IsActive?: boolean | null; IsActiveV2?: boolean | null }
    | null
    | undefined;

  if (!plan) return null;

  const planRowActive = plan.IsActiveV2 ?? plan.IsActive ?? true;
  if (!planRowActive) return null;

  const raw = plan.PricingModel ?? null;
  const pricingModel =
    raw === 'free' || raw === 'per_booking' || raw === 'per_listing' || raw === 'hybrid' ? raw : null;

  return {
    pricingModel,
    price: plan.Price != null ? Number(plan.Price) : null
  };
}

export function pricingModelAllowsBookingUsage(model: string | null | undefined): boolean {
  if (!model) return false;
  return model === 'per_booking' || model === 'hybrid';
}

export function pricingModelAllowsListingUsage(model: string | null | undefined): boolean {
  if (!model) return false;
  return model === 'per_listing' || model === 'hybrid';
}

/**
 * Inserts/ignores a booking Usage row when the member's plan bills per confirmed booking (or hybrid).
 */
export async function ensureBookingUsageIfApplicable(bookingId: string, propertyId: string): Promise<void> {
  const memberId = await resolveBillingMemberIdByPropertyId(propertyId);
  if (!memberId) {
    throw new Error('Unable to resolve billing member for booking usage record');
  }

  const snapshot = await getActivePlanSnapshotForMember(memberId);
  if (!snapshot || !pricingModelAllowsBookingUsage(snapshot.pricingModel)) {
    return;
  }

  const payload = {
    MemberId: memberId,
    Type: 'booking' as const,
    ReferenceId: bookingId,
    Amount: null as number | null
  };

  const { error } = await supabase.from('UsageRecords').upsert(payload, {
    onConflict: 'MemberId,Type,ReferenceId',
    ignoreDuplicates: true
  });

  if (error) throw error;
}

/**
 * When a listing becomes published (visible + active), record listing usage for per_listing / hybrid plans.
 * Uses Listings.Id as ReferenceId (text). Amount defaults to plan Price for invoice math on the server.
 * Swallows errors so a failed usage row does not roll back an already-saved property publish.
 */
export async function tryRecordListingUsageOnPublish(estatePropertyId: string): Promise<void> {
  try {
    const { data: listing, error: listingError } = await supabase
      .from('Listings')
      .select('Id, IsPropertyVisible, IsActive')
      .eq('EstatePropertyId', estatePropertyId)
      .eq('IsDeleted', false)
      .limit(1)
      .maybeSingle();

    if (listingError) throw listingError;
    if (!listing?.Id) return;
    if (!listing.IsPropertyVisible || !listing.IsActive) return;

    const memberId = await resolveBillingMemberIdByPropertyId(estatePropertyId);
    if (!memberId) return;

    const snapshot = await getActivePlanSnapshotForMember(memberId);
    if (!snapshot || !pricingModelAllowsListingUsage(snapshot.pricingModel)) {
      return;
    }

    const amount =
      snapshot.price != null && !Number.isNaN(snapshot.price)
        ? snapshot.price
        : snapshot.pricingModel === 'per_listing' || snapshot.pricingModel === 'hybrid'
          ? 0
          : null;

    const payload = {
      MemberId: memberId,
      Type: 'listing' as const,
      ReferenceId: String(listing.Id),
      Amount: amount
    };

    const { error } = await supabase.from('UsageRecords').upsert(payload, {
      onConflict: 'MemberId,Type,ReferenceId',
      ignoreDuplicates: true
    });

    if (error) throw error;
  } catch (e) {
    console.error('tryRecordListingUsageOnPublish:', e);
  }
}
