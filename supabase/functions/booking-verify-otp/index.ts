import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface VerifyOtpBody {
  holdId: string;
  phone: string;
  code: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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

    const body = (await req.json()) as VerifyOtpBody;
    const holdId = body.holdId?.trim();
    const phone = body.phone?.trim();
    const code = body.code?.trim();
    if (!holdId || !phone || !code) {
      return jsonResponse({ success: false, error: 'holdId, phone and code are required' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: verifyPayload, error: verifyError } = await supabaseAdmin.rpc('verify_booking_otp', {
      p_phone: phone,
      p_otp_code: code,
      p_hold_id: holdId,
    });

    if (verifyError) {
      return jsonResponse({ success: false, error: 'OTP verification failed' }, 500);
    }

    const payload = verifyPayload as { success?: boolean; error?: string; attempts_left?: number } | null;
    if (!payload?.success) {
      return jsonResponse({
        success: false,
        error: payload?.error ?? 'Invalid OTP code',
        attemptsLeft: payload?.attempts_left ?? 0,
      }, 400);
    }

    return jsonResponse({ success: true, message: 'OTP verified' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ success: false, error: message }, 500);
  }
});

