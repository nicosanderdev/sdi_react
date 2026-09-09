import {
  logBookingManageTokenDevMessage,
  shouldLogBookingManageToken,
} from '../_shared/bookingOtpDev.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { buildGuestManageUrl } from '../_shared/guestManageUrl.ts';

interface LogBody {
  bookingId?: string;
  reservationCode?: string | null;
  listingType?: string | null;
  token?: string;
  expiresAt?: string | null;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  if (!shouldLogBookingManageToken()) {
    return jsonResponse({ success: true, logged: false });
  }

  try {
    const body = (await req.json()) as LogBody;
    const bookingId = body.bookingId?.trim();
    const token = body.token?.trim();
    if (!bookingId || !token) {
      return jsonResponse({ success: false, error: 'bookingId and token are required' }, 400);
    }

    const reservationCode = body.reservationCode?.trim() || null;
    const listingType = body.listingType?.trim() || null;

    logBookingManageTokenDevMessage({
      bookingId,
      reservationCode,
      listingType,
      token,
      expiresAt: body.expiresAt ?? null,
      manageUrl: buildGuestManageUrl(reservationCode, listingType),
    });

    return jsonResponse({ success: true, logged: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ success: false, error: message }, 500);
  }
});
