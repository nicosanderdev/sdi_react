import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ConfirmationBody {
  bookingId: string;
  phone: string;
  propertyTitle: string;
  checkIn: string;
  checkOut: string;
  reservationCode: string;
  manageUrl: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildMessage(body: ConfirmationBody): string {
  return [
    `Your booking is confirmed for ${body.propertyTitle}.`,
    `Dates: ${body.checkIn} to ${body.checkOut}.`,
    `Reservation code: ${body.reservationCode}.`,
    `Manage booking: ${body.manageUrl}`,
  ].join(' ');
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

    const message = buildMessage(body);
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

