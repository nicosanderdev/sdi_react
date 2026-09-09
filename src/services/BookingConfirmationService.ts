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

class BookingConfirmationService {
  static async assertCanConfirm(estatePropertyId: string, bookingId?: string | null): Promise<void> {
    await assertBookingConfirmationAllowed(estatePropertyId, bookingId ?? null);
  }

  static async handlePostConfirmation(payload: BookingConfirmationPayload): Promise<void> {
    await ensureBookingUsageIfApplicable(payload.bookingId, payload.estatePropertyId);
    await this.sendTenantConfirmation(payload);
  }

  /**
   * Email-only booking confirmation. Guests are expected to provide an email.
   * Skips (does not throw) when there is no email so older bookings still confirm.
   */
  static async sendTenantConfirmation(payload: BookingConfirmationPayload): Promise<void> {
    const guestEmail = payload.guestEmail?.trim();

    if (!guestEmail) {
      console.warn(
        `Skipping booking confirmation notice for ${payload.bookingId}: guest has no email`
      );
      return;
    }

    const emailRes = await supabase.functions.invoke('send-booking-confirmation', {
      body: { bookingId: payload.bookingId },
    });

    const data = emailRes.data as { success?: boolean; error?: string; skipReason?: string } | null;
    const isNoEmail =
      data?.skipReason === 'no_email' ||
      data?.error === 'no_email' ||
      /no_email/i.test(emailRes.error?.message ?? '');

    if (isNoEmail) {
      console.warn(
        `Skipping booking confirmation notice for ${payload.bookingId}: email function reported no_email`
      );
      return;
    }

    if (emailRes.error) {
      throw new Error(emailRes.error.message);
    }

    if (data && data.success === false) {
      throw new Error(data.error ?? 'Confirmation email failed');
    }
  }
}

export default BookingConfirmationService;
