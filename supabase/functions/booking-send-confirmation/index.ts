/**
 * Booking confirmed/cancelled WhatsApp text sender.
 *
 * Callers are disconnected: Meta does not allow custom (non-template) text for
 * this use case. Kept in the repo until an approved template exists.
 * Live notifications go through send-booking-confirmation / send-booking-cancellation (email).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildGuestManageUrl } from '../_shared/guestManageUrl.ts';
import { sendWhatsappViaMeta } from '../_shared/whatsapp.ts';

interface ConfirmationBody {
  bookingId: string;
  phone: string;
  propertyTitle: string;
  checkIn: string;
  checkOut: string;
  reservationCode?: string;
  /** Optional; preferred URL is built server-side from booking ListingType. */
  manageUrl?: string;
  /** Defaults to confirmed. */
  eventType?: 'confirmed' | 'cancelled';
  hostName?: string | null;
  hostEmail?: string | null;
  hostPhone?: string | null;
}

interface HostContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

interface BookingLookup {
  EstatePropertyId: string | null;
  ReservationCode: string | null;
  ListingType: string | null;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function formatShortDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildHostSegment(host: HostContact): string {
  const parts = [host.name, host.phone, host.email].filter(Boolean);
  if (parts.length === 0) return '';
  return ` Host: ${parts.join(', ')}.`;
}

function buildMessage(
  body: ConfirmationBody,
  host: HostContact,
  reservationCode: string,
  manageUrl: string | null
): string {
  const checkIn = formatShortDate(body.checkIn);
  const checkOut = formatShortDate(body.checkOut);
  const dateSegment =
    checkIn && checkOut ? `${checkIn}–${checkOut}` : `${body.checkIn} to ${body.checkOut}`.trim();
  const eventType = body.eventType === 'cancelled' ? 'cancelled' : 'confirmed';

  if (eventType === 'cancelled') {
    return [
      `SDI Trips: Booking ${reservationCode} cancelled.`,
      `${body.propertyTitle} ${dateSegment}.`.trim(),
      manageUrl ? `Details: ${manageUrl}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    `SDI Trips: Booking ${reservationCode} confirmed.`,
    `${body.propertyTitle} ${dateSegment}.`.trim(),
    buildHostSegment(host).trim(),
    manageUrl ? `Manage: ${manageUrl}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

// deno-lint-ignore no-explicit-any
async function loadBooking(
  supabaseAdmin: any,
  bookingId: string
): Promise<BookingLookup | null> {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('Bookings')
    .select('EstatePropertyId, ReservationCode, ListingType')
    .eq('Id', bookingId)
    .eq('IsDeleted', false)
    .maybeSingle();

  if (bookingError || !booking) {
    return null;
  }

  return booking as BookingLookup;
}

async function loadHostContact(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  booking: BookingLookup,
  body: ConfirmationBody
): Promise<HostContact> {
  if (body.hostName || body.hostEmail || body.hostPhone) {
    return {
      name: body.hostName ?? null,
      email: body.hostEmail ?? null,
      phone: body.hostPhone ?? null,
    };
  }

  if (!booking.EstatePropertyId) {
    return { name: null, email: null, phone: null };
  }

  const { data: hostContact, error: hostError } = await supabaseAdmin.rpc(
    'resolve_host_contact_for_property',
    { p_estate_property_id: booking.EstatePropertyId }
  );

  if (hostError || !hostContact) {
    return { name: null, email: null, phone: null };
  }

  return {
    name: (hostContact as HostContact).name ?? null,
    email: (hostContact as HostContact).email ?? null,
    phone: (hostContact as HostContact).phone ?? null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ success: false, error: 'Missing server environment variables' }, 500);
    }

    const body = (await req.json()) as ConfirmationBody;
    if (!body.bookingId || !body.phone) {
      return jsonResponse({ success: false, error: 'Missing required fields' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const booking = await loadBooking(supabaseAdmin, body.bookingId);
    if (!booking) {
      return jsonResponse({ success: false, error: 'Booking not found' }, 404);
    }

    const reservationCode =
      booking.ReservationCode?.trim() ||
      body.reservationCode?.trim() ||
      '';
    if (!reservationCode) {
      return jsonResponse({ success: false, error: 'Missing reservation code' }, 400);
    }

    const manageUrl =
      buildGuestManageUrl(booking.ReservationCode ?? reservationCode, booking.ListingType) ??
      body.manageUrl?.trim() ??
      null;

    const host = await loadHostContact(supabaseAdmin, booking, body);
    const message = buildMessage(body, host, reservationCode, manageUrl);

    const waResult = await sendWhatsappViaMeta(body.phone, message);
    if (!waResult.ok) {
      return jsonResponse({
        success: false,
        error: waResult.error ?? 'WhatsApp delivery failed',
      }, 502);
    }

    const { error: auditError } = await supabaseAdmin
      .from('booking_rate_limits')
      .insert({
        scope: 'booking_confirmation_message',
        key: body.bookingId,
        hits: 1,
        window_start: new Date().toISOString(),
        window_end: new Date(Date.now() + 60_000).toISOString(),
      });

    if (auditError) {
      console.warn('Failed to write confirmation audit row:', auditError.message);
    }

    return jsonResponse({
      success: true,
      channel: 'whatsapp',
      mode: waResult.mode ?? 'live',
      messageId: waResult.messageId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ success: false, error: message }, 500);
  }
});
