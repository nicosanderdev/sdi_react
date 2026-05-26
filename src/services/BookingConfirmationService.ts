import { supabase } from '../config/supabase';
import { assertBookingConfirmationAllowed, ensureBookingUsageIfApplicable } from './BillingUsageRecords';

export interface BookingConfirmationPayload {
  bookingId: string;
  estatePropertyId: string;
  checkInDate?: string;
  checkOutDate?: string;
  propertyTitle?: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  reservationCode?: string | null;
  listingType?: string | null;
}

function buildFallbackReservationCode(bookingId: string): string {
  return bookingId.replace(/-/g, '').slice(0, 10).toUpperCase();
}

function buildDashboardManageUrl(bookingId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/dashboard/bookings?booking=${bookingId}`;
}

function buildGuestManageUrl(
  reservationCode: string,
  listingType?: string | null
): string | null {
  const base = import.meta.env.VITE_GUEST_BOOKING_MANAGE_BASE_URL as string | undefined;
  if (!base) {
    return null;
  }

  const url = new URL(base, base.startsWith('http') ? undefined : window.location.origin);
  url.searchParams.set('code', reservationCode);
  if (listingType) {
    url.searchParams.set('listingType', listingType);
  }
  return url.toString();
}

function resolveManageUrl(payload: BookingConfirmationPayload): string {
  const reservationCode = payload.reservationCode?.trim();
  if (reservationCode) {
    return (
      buildGuestManageUrl(reservationCode, payload.listingType) ??
      buildDashboardManageUrl(payload.bookingId)
    );
  }

  return buildDashboardManageUrl(payload.bookingId);
}

function resolveReservationCode(payload: BookingConfirmationPayload): string {
  const reservationCode = payload.reservationCode?.trim();
  if (reservationCode) {
    return reservationCode;
  }

  return buildFallbackReservationCode(payload.bookingId);
}

class BookingConfirmationService {
  static async assertCanConfirm(estatePropertyId: string, bookingId?: string | null): Promise<void> {
    await assertBookingConfirmationAllowed(estatePropertyId, bookingId ?? null);
  }

  static async handlePostConfirmation(payload: BookingConfirmationPayload): Promise<void> {
    await ensureBookingUsageIfApplicable(payload.bookingId, payload.estatePropertyId);
    await this.sendTenantConfirmation(payload);
  }

  static async sendTenantConfirmation(payload: BookingConfirmationPayload): Promise<void> {
    let lastError: Error | null = null;
    const reservationCode = resolveReservationCode(payload);
    const manageUrl = resolveManageUrl(payload);

    if (payload.guestPhone) {
      const smsRes = await supabase.functions.invoke('booking-send-confirmation', {
        body: {
          bookingId: payload.bookingId,
          phone: payload.guestPhone,
          propertyTitle: payload.propertyTitle ?? 'Property',
          checkIn: payload.checkInDate ?? '',
          checkOut: payload.checkOutDate ?? '',
          reservationCode,
          manageUrl,
        },
      });

      if (!smsRes.error) {
        return;
      }

      lastError = new Error(smsRes.error.message);
    }

    const emailRes = await supabase.functions.invoke('send-booking-confirmation', {
      body: { bookingId: payload.bookingId },
    });

    if (emailRes.error) {
      lastError = new Error(emailRes.error.message);
    } else {
      lastError = null;
    }

    if (lastError) {
      throw lastError;
    }
  }
}

export default BookingConfirmationService;
