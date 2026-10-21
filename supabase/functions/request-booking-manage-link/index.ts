import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { hasGuestManageBase, buildGuestManageTokenUrl } from '../_shared/guestManageUrl.ts';
import { buildManageLinkEmail, manageLinkClientResult } from '../_shared/manageLinkRequest.ts';

const GUEST_LISTING_TYPES = new Set(['SummerRent', 'EventVenue']);
const FROM_EMAIL = 'Holiday Trips <bookings@holidaytrips.com>';

interface RequestBody {
  reservationCode?: string;
  email?: string;
  listingType?: string;
}

interface ReissueRow {
  matched?: boolean;
  token?: string;
  email?: string;
  reservation_code?: string;
  listing_type?: string;
  property_title?: string | null;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clientResponse(input: { rateLimited: boolean; failed: boolean }): Response {
  const result = manageLinkClientResult(input);
  return jsonResponse(result.body, result.status);
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const firstIp = forwardedFor?.split(',')[0]?.trim();
  return firstIp?.length ? firstIp : 'unknown';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return clientResponse({ rateLimited: false, failed: true });
    }

    let body: RequestBody = {};
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      body = {};
    }

    const reservationCode = body.reservationCode?.trim() ?? '';
    const email = body.email?.trim() ?? '';
    const listingType = body.listingType?.trim() ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: rateData, error: rateError } = await supabase.rpc(
      'check_and_increment_manage_link_rate_limit',
      { p_code: reservationCode, p_ip: getClientIp(req) },
    );
    if (rateError) {
      console.error('Manage link rate limit failed:', rateError.message);
      return clientResponse({ rateLimited: false, failed: true });
    }

    const allowed = Boolean((rateData as { allowed?: boolean } | null)?.allowed);
    if (!allowed) {
      return clientResponse({ rateLimited: true, failed: false });
    }

    if (!GUEST_LISTING_TYPES.has(listingType)) {
      return clientResponse({ rateLimited: false, failed: false });
    }

    if (!hasGuestManageBase(listingType)) {
      console.error('Guest manage base URL is not configured for', listingType);
      return clientResponse({ rateLimited: false, failed: true });
    }

    const { data: reissueData, error: reissueError } = await supabase.rpc(
      'reissue_booking_manage_link',
      {
        p_reservation_code: reservationCode,
        p_listing_type: listingType,
        p_email: email,
      },
    );
    if (reissueError) {
      console.error('Manage link reissue failed:', reissueError.message);
      return clientResponse({ rateLimited: false, failed: true });
    }

    const reissue = (reissueData ?? {}) as ReissueRow;
    if (!reissue.matched || !reissue.token || !reissue.email || !reissue.reservation_code) {
      return clientResponse({ rateLimited: false, failed: false });
    }

    const manageUrl = buildGuestManageTokenUrl(
      reissue.token,
      reissue.listing_type ?? listingType,
    );
    if (!manageUrl) {
      console.error('Could not build manage token URL');
      return clientResponse({ rateLimited: false, failed: true });
    }

    const message = buildManageLinkEmail({
      reservationCode: reissue.reservation_code,
      manageUrl,
      propertyTitle: reissue.property_title,
    });

    if (Deno.env.get('SEND_EMAILS_ENABLED') !== 'true') {
      console.log('Dry-run manage link email:', {
        mode: 'dry-run',
        to: reissue.email,
        subject: message.subject,
        htmlLength: message.html.length,
      });
      return clientResponse({ rateLimited: false, failed: false });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return clientResponse({ rateLimited: false, failed: true });
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [reissue.email],
        subject: message.subject,
        html: message.html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Failed to send manage link email:', errorData);
      return clientResponse({ rateLimited: false, failed: true });
    }

    return clientResponse({ rateLimited: false, failed: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('request-booking-manage-link:', message);
    return clientResponse({ rateLimited: false, failed: true });
  }
});
