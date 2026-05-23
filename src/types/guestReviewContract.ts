/**
 * RPC contracts for guest reservation lookup and review submit/edit.
 * Backend: supabase/migrations/20260527120000_reviews_listing_type.sql,
 *          supabase/migrations/20260528120000_guest_review_48h_window.sql
 * Consumer: client/trips apps (not wired in sdi_react dashboard today).
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
}

export type GetReservationByCodeResponse =
  | GetReservationByCodeSuccess
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
