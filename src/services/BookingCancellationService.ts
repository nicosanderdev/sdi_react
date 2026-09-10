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

class BookingCancellationService {
  /**
   * Email-only booking cancellation notice. Guests are expected to provide an email.
   * Skips (does not throw) when there is no email so older bookings still cancel.
   */
  static async sendTenantCancellation(payload: BookingCancellationPayload): Promise<void> {
    const guestEmail = payload.guestEmail?.trim();

    if (!guestEmail) {
      console.warn(
        `Skipping booking cancellation notice for ${payload.bookingId}: guest has no email`
      );
      return;
    }

    const emailRes = await supabase.functions.invoke('send-booking-cancellation', {
      body: { bookingId: payload.bookingId },
    });

    const data = emailRes.data as { success?: boolean; error?: string; skipReason?: string } | null;
    const isNoEmail =
      data?.skipReason === 'no_email' ||
      data?.error === 'no_email' ||
      /no_email/i.test(emailRes.error?.message ?? '');

    if (isNoEmail) {
      console.warn(
        `Skipping booking cancellation notice for ${payload.bookingId}: email function reported no_email`
      );
      return;
    }

    if (emailRes.error) {
      throw new Error(emailRes.error.message);
    }

    if (data && data.success === false) {
      throw new Error(data.error ?? 'Cancellation email failed');
    }
  }

  static async handlePostCancellation(payload: BookingCancellationPayload): Promise<void> {
    await this.sendTenantCancellation(payload);
  }
}

export default BookingCancellationService;
