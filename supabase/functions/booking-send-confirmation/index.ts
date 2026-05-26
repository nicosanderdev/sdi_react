import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ConfirmationBody {
  bookingId: string;
  phone: string;
  propertyTitle: string;
  checkIn: string;
  checkOut: string;
  reservationCode: string;
  manageUrl: string;
  hostName?: string | null;
  hostEmail?: string | null;
  hostPhone?: string | null;
}

interface HostContact {
  name: string | null;
  email: string | null;
  phone: string | null;
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

function buildMessage(body: ConfirmationBody, host: HostContact): string {
  const checkIn = formatShortDate(body.checkIn);
  const checkOut = formatShortDate(body.checkOut);
  const dateSegment =
    checkIn && checkOut ? `${checkIn}–${checkOut}` : `${body.checkIn} to ${body.checkOut}`.trim();

  return [
    `SDI Trips: Booking ${body.reservationCode} confirmed.`,
    `${body.propertyTitle} ${dateSegment}.`.trim(),
    buildHostSegment(host).trim(),
    `Manage: ${body.manageUrl}`,
  ]
    .filter(Boolean)
    .join(' ');
}

async function loadHostContact(
  supabaseAdmin: ReturnType<typeof createClient>,
  bookingId: string,
  body: ConfirmationBody
): Promise<HostContact> {
  if (body.hostName || body.hostEmail || body.hostPhone) {
    return {
      name: body.hostName ?? null,
      email: body.hostEmail ?? null,
      phone: body.hostPhone ?? null,
    };
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('Bookings')
    .select('EstatePropertyId')
    .eq('Id', bookingId)
    .eq('IsDeleted', false)
    .maybeSingle();

  if (bookingError || !booking?.EstatePropertyId) {
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
    if (!body.bookingId || !body.phone || !body.reservationCode || !body.manageUrl) {
      return jsonResponse({ success: false, error: 'Missing required fields' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const host = await loadHostContact(supabaseAdmin, body.bookingId, body);
    const message = buildMessage(body, host);

    // Contract placeholder:
    // For SMS or WhatsApp, wire a provider API call here.
    // Example providers: Twilio, MessageBird, 360dialog, Meta Cloud API.
    // Keep this function as a stable abstraction for notification dispatch.

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
      // Non-blocking by design
      console.warn('Failed to write confirmation audit row:', auditError.message);
    }

    return jsonResponse({
      success: true,
      channel: 'sms_placeholder',
      message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ success: false, error: message }, 500);
  }
});
