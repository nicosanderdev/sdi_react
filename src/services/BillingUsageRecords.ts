import { supabase } from '../config/supabase';

export type BillingSubjectType = 'member' | 'company';

export interface BillingSubject {
  subjectType: BillingSubjectType;
  memberOrCompanyId: string;
}

export type PlanPricingModel = 'per_booking' | 'per_listing' | 'hybrid';

export interface ActivePlanSnapshot {
  pricingModel: PlanPricingModel | null;
  /** Plan "Price" column — used as line amount for per-listing usage rows. */
  price: number | null;
  listingLimit: number | null;
  bookingLimit: number | null;
  durationDays: number | null;
}

type FlexibleUsageLimitCheckRow = {
  allowed?: boolean;
  skipped?: boolean;
  idempotent?: boolean;
  reason?: string;
  current?: number;
  limit?: number;
};

/**
 * Resolves billing subject for a property (member owner or company owner).
 */
export async function resolveBillingSubjectByPropertyId(
  propertyId: string
): Promise<BillingSubject | null> {
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

  if (owner.OwnerType === 'member' && owner.MemberId) {
    return { subjectType: 'member', memberOrCompanyId: owner.MemberId };
  }

  if (owner.OwnerType === 'company' && owner.CompanyId) {
    return { subjectType: 'company', memberOrCompanyId: owner.CompanyId };
  }

  return null;
}

/** @deprecated Use resolveBillingSubjectByPropertyId */
export async function resolveBillingMemberIdByPropertyId(propertyId: string): Promise<string | null> {
  const subject = await resolveBillingSubjectByPropertyId(propertyId);
  if (!subject) return null;
  return subject.subjectType === 'member' ? subject.memberOrCompanyId : null;
}

type ActivePlanAssignmentRow = {
  pricing_model?: string | null;
  price?: number | null;
  listing_limit?: number | null;
  booking_limit?: number | null;
  duration_days?: number | null;
};

function mapActivePlanAssignmentRow(row: ActivePlanAssignmentRow): ActivePlanSnapshot | null {
  const raw = row.pricing_model ?? null;
  const pricingModel =
    raw === 'per_booking' || raw === 'per_listing' || raw === 'hybrid' ? raw : null;

  if (!pricingModel) return null;

  return {
    pricingModel,
    price: row.price != null ? Number(row.price) : null,
    listingLimit: row.listing_limit != null ? Number(row.listing_limit) : null,
    bookingLimit: row.booking_limit != null ? Number(row.booking_limit) : null,
    durationDays: row.duration_days != null ? Number(row.duration_days) : null
  };
}

/**
 * Loads active plan via security-definer RPC so admins can resolve any billing subject's plan (RLS-safe).
 */
export async function getActivePlanSnapshotForSubject(
  subject: BillingSubject
): Promise<ActivePlanSnapshot | null> {
  const { data, error } = await supabase.rpc('get_active_plan_assignment', {
    p_subject_type: subject.subjectType,
    p_subject_id: subject.memberOrCompanyId,
    p_at: new Date().toISOString()
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as ActivePlanAssignmentRow | undefined;
  if (!row) return null;

  return mapActivePlanAssignmentRow(row);
}

/** @deprecated Use getActivePlanSnapshotForSubject */
export async function getActivePlanSnapshotForMember(memberId: string): Promise<ActivePlanSnapshot | null> {
  return getActivePlanSnapshotForSubject({ subjectType: 'member', memberOrCompanyId: memberId });
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
 * Server-side limit check (matches flexible_usage_limit_check RPC).
 */
export async function flexibleUsageLimitCheck(
  subject: BillingSubject,
  usageType: 'booking' | 'listing',
  referenceId?: string | null
): Promise<FlexibleUsageLimitCheckRow> {
  const { data, error } = await supabase.rpc('flexible_usage_limit_check', {
    p_subject_type: subject.subjectType,
    p_subject_id: subject.memberOrCompanyId,
    p_usage_type: usageType,
    p_reference_id: referenceId ?? null
  });

  if (error) throw error;

  const row = data as FlexibleUsageLimitCheckRow | null;
  if (row?.allowed === false) {
    const detail =
      row.reason ??
      (usageType === 'booking'
        ? 'Booking confirmation limit exceeded for your plan.'
        : 'Listing publish limit exceeded for your plan.');
    throw new Error(detail);
  }

  return row ?? { allowed: true };
}

/**
 * Inserts/ignores a booking Usage row when the billing subject's plan bills per confirmed booking (or hybrid).
 */
export async function ensureBookingUsageIfApplicable(bookingId: string, propertyId: string): Promise<void> {
  const subject = await resolveBillingSubjectByPropertyId(propertyId);
  if (!subject) {
    throw new Error('Unable to resolve billing subject for booking usage record');
  }

  const snapshot = await getActivePlanSnapshotForSubject(subject);
  if (!snapshot || !pricingModelAllowsBookingUsage(snapshot.pricingModel)) {
    return;
  }

  const { error } = await supabase.rpc('record_booking_usage_record', {
    p_booking_id: bookingId,
    p_estate_property_id: propertyId
  });

  if (error) throw error;
}

/**
 * Before confirming a booking: enforce usage limits (throws if blocked).
 */
export async function assertBookingConfirmationAllowed(propertyId: string, bookingId?: string | null): Promise<void> {
  const subject = await resolveBillingSubjectByPropertyId(propertyId);
  if (!subject) {
    throw new Error('Unable to resolve billing subject for booking usage record');
  }

  const snapshot = await getActivePlanSnapshotForSubject(subject);
  if (!snapshot || !pricingModelAllowsBookingUsage(snapshot.pricingModel)) {
    return;
  }

  await flexibleUsageLimitCheck(subject, 'booking', bookingId ?? null);
}

/**
 * Before publishing a listing (visible + active): enforce plan published-property caps
 * (always, regardless of pricing model), then listing usage limits for billing models that use them.
 */
export async function assertListingPublishAllowed(
  estatePropertyId: string,
  listingId?: string | null
): Promise<void> {
  const subject = await resolveBillingSubjectByPropertyId(estatePropertyId);
  if (!subject) return;

  const { error: publishedCapError } = await supabase.rpc('assert_published_property_within_plan', {
    p_subject_type: subject.subjectType,
    p_subject_id: subject.memberOrCompanyId,
    p_estate_property_id: estatePropertyId
  });
  if (publishedCapError) throw publishedCapError;

  const snapshot = await getActivePlanSnapshotForSubject(subject);
  if (!snapshot || !pricingModelAllowsListingUsage(snapshot.pricingModel)) {
    return;
  }

  await flexibleUsageLimitCheck(subject, 'listing', listingId ?? null);
}

/**
 * When a listing becomes published (visible + active), record listing usage for per_listing / hybrid plans.
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

    const subject = await resolveBillingSubjectByPropertyId(estatePropertyId);
    if (!subject) return;

    const snapshot = await getActivePlanSnapshotForSubject(subject);
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
      SubjectType: subject.subjectType,
      MemberOrCompanyId: subject.memberOrCompanyId,
      Type: 'listing' as const,
      ReferenceId: String(listing.Id),
      Amount: amount
    };

    const { error } = await supabase.from('UsageRecords').upsert(payload, {
      onConflict: 'SubjectType,MemberOrCompanyId,Type,ReferenceId',
      ignoreDuplicates: true
    });

    if (error) throw error;
  } catch (e) {
    console.error('tryRecordListingUsageOnPublish:', e);
  }
}
