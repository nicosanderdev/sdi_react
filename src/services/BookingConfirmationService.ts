import { supabase } from '../config/supabase';
import { assertBookingConfirmationAllowed, ensureBookingUsageIfApplicable } from './BillingUsageRecords';

export interface BookingConfirmationPayload {
  bookingId: string;
  estatePropertyId: string;
  checkInDate?: string;
  checkOutDate?: string;
  propertyTitle?: string;
  guestPhone?: string | null;
}

function buildReservationCode(bookingId: string): string {
  return bookingId.replace(/-/g, '').slice(0, 10).toUpperCase();
}

function buildManageUrl(bookingId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/dashboard/bookings?booking=${bookingId}`;
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

    if (payload.guestPhone) {
      const smsRes = await supabase.functions.invoke('booking-send-confirmation', {
        body: {
          bookingId: payload.bookingId,
          phone: payload.guestPhone,
          propertyTitle: payload.propertyTitle ?? 'Property',
          checkIn: payload.checkInDate ?? '',
          checkOut: payload.checkOutDate ?? '',
          reservationCode: buildReservationCode(payload.bookingId),
          manageUrl: buildManageUrl(payload.bookingId)
        }
      });

      if (!smsRes.error) {
        return;
      }

      lastError = new Error(smsRes.error.message);
    }

    const emailRes = await supabase.functions.invoke('send-booking-confirmation', {
      body: { bookingId: payload.bookingId }
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
