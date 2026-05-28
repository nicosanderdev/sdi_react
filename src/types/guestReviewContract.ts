/**
 * RPC contracts for guest reservation lookup and review submit/edit.
 * Backend: supabase/migrations/20260527120000_reviews_listing_type.sql,
 *          supabase/migrations/20260528120000_guest_review_48h_window.sql,
 *          supabase/migrations/20260529120000_guest_booking_overlap.sql,
 *          supabase/migrations/20260530120000_create_booking_hold_listing_type.sql,
 *          supabase/migrations/20260601120000_host_contact_for_guests.sql
 *          supabase/migrations/20260602120000_dynamic_pricing_schema.sql
 *          supabase/migrations/20260602120100_dynamic_pricing_validation.sql
 * Consumer: client/trips apps (not wired in sdi_react dashboard today).
 * See docs/handoffs/dynamic-pricing-guest-client.md
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

/** Stable error codes returned by guest booking RPCs. */
export type GuestBookingErrorCode = 'GUEST_BOOKING_OVERLAP' | 'PRICE_QUOTE_MISMATCH';

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
}

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

/** Parameters for create_booking_hold (9-arg). */
export interface CreateBookingHoldParams {
  p_property_id: string;
  p_check_in: string;
  p_check_out: string;
  p_guests: number;
  p_ip_hash?: string | null;
  p_idempotency_key?: string | null;
  p_visible_check_out?: string | null;
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
