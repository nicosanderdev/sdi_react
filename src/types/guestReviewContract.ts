/**
 * RPC contracts for guest reservation lookup and review submit/edit.
 * Backend: supabase/migrations/20260527120000_reviews_listing_type.sql,
 *          supabase/migrations/20260528120000_guest_review_48h_window.sql,
 *          supabase/migrations/20260529120000_guest_booking_overlap.sql,
 *          supabase/migrations/20260530120000_create_booking_hold_listing_type.sql,
 *          supabase/migrations/20260601120000_host_contact_for_guests.sql
 *          supabase/migrations/20260602120000_dynamic_pricing_schema.sql
 *          supabase/migrations/20260602120100_dynamic_pricing_validation.sql
 *          supabase/migrations/20260721220000_get_public_property_owner.sql
 * Consumer: client/trips apps (not wired in sdi_react dashboard today).
 * Messaging / OTP handoff: docs/handoffs/guest-booking-messaging.md
 * Mercado Pago payments handoff: docs/handoffs/guest-mercado-pago-payments.md
 * See also docs/handoffs/dynamic-pricing-guest-client.md
 */

/** Listing types allowed on public guest sites (excludes AnnualRent). */
export type GuestSiteListingType = 'RealEstate' | 'SummerRent' | 'EventVenue';

export const GUEST_SITE_LISTING_TYPES: readonly GuestSiteListingType[] = [
  'RealEstate',
  'SummerRent',
  'EventVenue',
] as const;

export function isGuestSiteListingType(value: string): value is GuestSiteListingType {
  return (GUEST_SITE_LISTING_TYPES as readonly string[]).includes(value);
}

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'unknown';

export interface ExistingGuestReview {
  reviewId: string;
  rating: number;
  comment: string;
  updatedAt?: string;
}

export interface HostContactInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
}

/** Public host card from `get_public_property_owner` (no email/phone). */
export type PublicPropertyOwnerType = 'member' | 'company';

export interface PublicPropertyOwner {
  ownerId: string;
  ownerType: PublicPropertyOwnerType;
  fullName: string | null;
  avatarUrl: string | null;
  /** Company `Description`, or member `Title` (job title) when no bio column exists. */
  description: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  /** Always null on the public RPC; present on booking-gated owner when contact is allowed. */
  email?: string | null;
  phone?: string | null;
}

/** Params for `get_public_property_owner`. */
export interface GetPublicPropertyOwnerParams {
  p_property_id: string;
}

/** Null when the property is missing or has no public guest listing. */
export type GetPublicPropertyOwnerResponse = PublicPropertyOwner | null;

/**
 * Booked-guest host profile from `get_booking_property_owner`.
 * Auth with manage token OR reservation code + listing type.
 * `email` / `phone` are set only when the booking is confirmed or completed.
 */
export type GetBookingPropertyOwnerParams =
  | { p_manage_token: string; p_reservation_code?: never; p_listing_type?: never }
  | {
      p_manage_token?: never;
      p_reservation_code: string;
      p_listing_type: GuestSiteListingType;
    };

export interface GetBookingPropertyOwnerSuccess {
  success: true;
  owner: PublicPropertyOwner;
  /** True when email/phone were included (confirmed or completed booking). */
  contactAvailable: boolean;
}

export type GetBookingPropertyOwnerResponse =
  | GetBookingPropertyOwnerSuccess
  | RpcFailure;

export interface GuestReservation {
  bookingId: string;
  guestId: string | null;
  reservationCode: string;
  propertyId: string;
  propertyTitle: string;
  listingType: GuestSiteListingType;
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  hostName?: string | null;
  hostEmail?: string | null;
  hostPhone?: string | null;
  hostContact?: HostContactInfo | null;
  canCancel: boolean;
  isExpired: boolean;
  isDeleted: boolean;
  hasExistingReview: boolean;
  canSubmitGuestReview: boolean;
  canEditGuestReview: boolean;
  existingGuestReview?: ExistingGuestReview | null;
  guestReviewWindowEnd?: string;
  /** Authoritative booking total from server quote. */
  totalAmount?: number | null;
  currency?: number | null;
  currencyCode?: string | null;
  /** True when a verified Mercado Pago webhook marked approval (audit only). */
  mercadoPagoApproved?: boolean;
  mercadoPagoApprovedAt?: string | null;
  /** True when seller is connected, booking unpaid via MP, and amount > 0. */
  canPayOnline?: boolean;
  sellerConnected?: boolean;
}

export interface GetReservationByCodeSuccess {
  success: true;
  reservation: GuestReservation;
}

export interface RpcFailure {
  success: false;
  error: string;
  error_code?: GuestBookingErrorCode;
}

/** Stable error codes returned by guest booking RPCs / payment edges. */
export type GuestBookingErrorCode =
  | 'GUEST_BOOKING_OVERLAP'
  | 'PRICE_QUOTE_MISMATCH'
  | 'SELLER_NOT_CONNECTED'
  | 'NO_DESIGNATED_SELLER'
  | 'ALREADY_APPROVED'
  | 'CANNOT_PAY'
  | 'INVALID_AMOUNT'
  | 'AMOUNT_MISMATCH'
  | 'CURRENCY_MISMATCH';

export type GetReservationByCodeResponse =
  | GetReservationByCodeSuccess
  | RpcFailure;

export interface ManageBookingView {
  bookingId: string;
  reservationCode: string;
  propertyTitle: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: ReservationStatus;
  canCancel: boolean;
  hostName?: string | null;
  hostEmail?: string | null;
  hostPhone?: string | null;
  hostContact?: HostContactInfo | null;
  totalAmount?: number | null;
  currency?: number | null;
  currencyCode?: string | null;
  mercadoPagoApproved?: boolean;
  mercadoPagoApprovedAt?: string | null;
  canPayOnline?: boolean;
  sellerConnected?: boolean;
}

/** create_booking_hold / confirm_booking_from_hold Mercado Pago eligibility. */
export interface MercadoPagoBookingEligibility {
  can_pay_online: boolean;
  seller_connected: boolean;
  mercado_pago_approved: boolean;
}

export interface CreateMercadoPagoPreferenceRequest {
  manageToken?: string;
  reservationCode?: string;
  listingType?: GuestSiteListingType;
}

export interface CreateMercadoPagoPreferenceSuccess {
  success: true;
  attemptId: string;
  preferenceId: string | null;
  initPoint?: string;
  sandboxInitPoint?: string;
  amount: number;
  currencyCode: string;
  reused: boolean;
  disclaimerKey: 'mercado_pago_bridge_disclaimer';
}

export type CreateMercadoPagoPreferenceResponse =
  | CreateMercadoPagoPreferenceSuccess
  | RpcFailure;

export interface BookingPaymentStatusSuccess {
  success: true;
  booking_id: string;
  reservation_code: string | null;
  amount: number | null;
  currency: number | null;
  currency_code: string;
  mercado_pago_approved: boolean;
  mercado_pago_approved_at: string | null;
  can_pay_online: boolean;
  seller_connected: boolean;
  seller_error_code?: string | null;
  seller_member_id?: string | null;
}

export type BookingPaymentStatusResponse =
  | BookingPaymentStatusSuccess
  | RpcFailure;

export interface GetBookingByManageTokenSuccess {
  success: true;
  booking: ManageBookingView;
}

export type GetBookingByManageTokenResponse =
  | GetBookingByManageTokenSuccess
  | RpcFailure;

export interface CreateGuestReviewSuccess {
  success: true;
  reviewId: string;
  listingType: GuestSiteListingType;
}

export type CreateGuestReviewResponse =
  | CreateGuestReviewSuccess
  | RpcFailure;

export type UpdateGuestReviewResponse = CreateGuestReviewResponse;

/**
 * Parameters for create_booking_hold.
 *
 * Guest count rules (backend does not distinguish Spanish labels):
 * - `p_guests` is required and must be >= 1. It becomes `Bookings.GuestCount`.
 * - SummerRent: send overnight headcount here (UI label: "huéspedes").
 * - EventVenue: send party/attendee headcount here (UI label: "invitados").
 * - `p_estimated_guests` is optional metadata only (hold + booking notes); it does
 *   not replace `p_guests` and is not written to `GuestCount`.
 * - Confirm guest form does not require a guest count; optional `estimatedGuests`
 *   in the JSON payload only updates hold `estimated_guests` / notes.
 * - Capacity (`EstateProperties.Capacity` / `EventVenueExtension.MaxGuests`) is
 *   not enforced by validate_booking_selection — UI may warn, RPC only checks >= 1.
 */
export interface CreateBookingHoldParams {
  p_property_id: string;
  p_check_in: string;
  p_check_out: string;
  /** Required >= 1. SummerRent = huéspedes; EventVenue = invitados. → GuestCount */
  p_guests: number;
  p_ip_hash?: string | null;
  p_idempotency_key?: string | null;
  p_visible_check_out?: string | null;
  /** Optional; does not become GuestCount. Prefer putting the real count in p_guests. */
  p_estimated_guests?: number | null;
  p_listing_type: GuestSiteListingType;
  /** Client-computed total; server rejects hold if outside PRICE_QUOTE_TOLERANCE. */
  p_client_total?: number | null;
}

export interface BookingHoldPricing {
  nightly_price: number;
  nights: number;
  total_price: number;
  listing_id?: string;
}

export interface BookingHoldValidation {
  is_valid: boolean;
  errors: string[];
  pricing?: BookingHoldPricing;
  normalized_rules?: Record<string, unknown>;
  error_code?: GuestBookingErrorCode;
}

export interface CreateBookingHoldSuccess {
  success: true;
  hold: {
    id: string;
    expires_at: string;
    listing_type?: GuestSiteListingType | null;
  };
  validation: BookingHoldValidation;
}

export type CreateBookingHoldResponse =
  | CreateBookingHoldSuccess
  | RpcFailure;

/** Parameters for get_reservation_by_code(reservation_code, p_listing_type). */
export interface GetReservationByCodeParams {
  reservation_code: string;
  p_listing_type: GuestSiteListingType;
}

/** Parameters for create_guest_review_by_reservation_code (5-arg). */
export interface CreateGuestReviewByReservationCodeParams {
  p_reservation_code: string;
  p_guest_email: string;
  p_rating: number;
  p_comment: string;
  p_listing_type: GuestSiteListingType;
}

/** Parameters for update_guest_review_by_reservation_code (5-arg). */
export interface UpdateGuestReviewByReservationCodeParams {
  p_reservation_code: string;
  p_guest_email: string;
  p_rating: number;
  p_comment: string;
  p_listing_type: GuestSiteListingType;
}

/** confirm_booking_from_hold success payload (listing_type when hold had listing_type). */
export interface ConfirmBookingFromHoldSuccess {
  success: true;
  booking_id: string;
  guest_id: string;
  reservation_code: string;
  listing_type?: GuestSiteListingType;
  manage_token: string;
  manage_expires_at: string;
  total_amount?: number;
  currency?: number;
  currency_code?: string;
  mercado_pago?: MercadoPagoBookingEligibility;
}

export type ConfirmBookingFromHoldResponse =
  | ConfirmBookingFromHoldSuccess
  | RpcFailure;

/** Parameters for validate_guest_booking_overlap(p_email, p_check_in, p_check_out). */
export interface ValidateGuestBookingOverlapParams {
  p_email: string;
  p_check_in: string;
  p_check_out: string;
}

export interface ValidateGuestBookingOverlapNoOverlap {
  success: true;
  hasOverlap: false;
}

export interface ValidateGuestBookingOverlapFound {
  success: true;
  hasOverlap: true;
  error_code: 'GUEST_BOOKING_OVERLAP';
  error: string;
}

export type ValidateGuestBookingOverlapSuccess =
  | ValidateGuestBookingOverlapNoOverlap
  | ValidateGuestBookingOverlapFound;

export type ValidateGuestBookingOverlapResponse =
  | ValidateGuestBookingOverlapSuccess
  | RpcFailure;

export function isGuestBookingOverlapError(
  result:
    | RpcFailure
    | ValidateGuestBookingOverlapSuccess
    | null
    | undefined
): boolean {
  if (!result || !result.success) {
    return result?.error_code === 'GUEST_BOOKING_OVERLAP';
  }
  return 'hasOverlap' in result && result.hasOverlap === true;
}
