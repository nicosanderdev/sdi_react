import { supabase } from '../config/supabase';

export interface BookingCancellationPayload {
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

function resolveReservationCode(payload: BookingCancellationPayload): string {
  const reservationCode = payload.reservationCode?.trim();
  if (reservationCode) {
    return reservationCode;
  }

  return buildFallbackReservationCode(payload.bookingId);
}

async function sendWhatsappCancellation(payload: BookingCancellationPayload): Promise<void> {
  const reservationCode = resolveReservationCode(payload);
  const phone = payload.guestPhone?.trim();
  if (!phone) {
    throw new Error('Guest has no phone for WhatsApp cancellation notice');
  }

  const waRes = await supabase.functions.invoke('booking-send-confirmation', {
    body: {
      bookingId: payload.bookingId,
      phone,
      propertyTitle: payload.propertyTitle ?? 'Property',
      checkIn: payload.checkInDate ?? '',
      checkOut: payload.checkOutDate ?? '',
      reservationCode,
      eventType: 'cancelled',
    },
  });

  if (waRes.error) {
    throw new Error(waRes.error.message);
  }

  const data = waRes.data as { success?: boolean; error?: string } | null;
  if (data && data.success === false) {
    throw new Error(data.error ?? 'WhatsApp cancellation notice failed');
  }
}

class BookingCancellationService {
  /**
   * Email first for booking alerts; WhatsApp only when guest has no email.
   */
  static async sendTenantCancellation(payload: BookingCancellationPayload): Promise<void> {
    const guestEmail = payload.guestEmail?.trim();
    const guestPhone = payload.guestPhone?.trim();

    if (guestEmail) {
      const emailRes = await supabase.functions.invoke('send-booking-cancellation', {
        body: { bookingId: payload.bookingId },
      });

      const data = emailRes.data as { success?: boolean; error?: string; skipReason?: string } | null;
      const isNoEmail =
        data?.skipReason === 'no_email' ||
        data?.error === 'no_email' ||
        /no_email/i.test(emailRes.error?.message ?? '');

      if (isNoEmail) {
        if (guestPhone) {
          await sendWhatsappCancellation(payload);
          return;
        }
        throw new Error('Guest has no email or phone for cancellation notice');
      }

      if (emailRes.error) {
        throw new Error(emailRes.error.message);
      }

      if (data && data.success === false) {
        throw new Error(data.error ?? 'Cancellation email failed');
      }

      return;
    }

    if (guestPhone) {
      await sendWhatsappCancellation(payload);
      return;
    }

    throw new Error('Guest has no email or phone for cancellation notice');
  }

  static async handlePostCancellation(payload: BookingCancellationPayload): Promise<void> {
    await this.sendTenantCancellation(payload);
  }
}

export default BookingCancellationService;
