import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface OtpFallbackBody {
  otpRequestId: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendSmsFallback(phone: string): Promise<{ ok: boolean; error?: string }> {
  const smsWebhookUrl = Deno.env.get('SMS_FALLBACK_WEBHOOK_URL');
  if (!smsWebhookUrl) {
    return { ok: false, error: 'SMS fallback provider is not configured' };
  }

  const response = await fetch(smsWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      message: 'Your booking verification code is still valid. Please use your latest code.',
    }),
  });

  if (!response.ok) {
    return { ok: false, error: `SMS provider returned ${response.status}` };
  }

  return { ok: true };
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

    const body = (await req.json()) as OtpFallbackBody;
    const otpRequestId = body.otpRequestId?.trim();
    if (!otpRequestId) {
      return jsonResponse({ success: false, error: 'otpRequestId is required' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: otpRequest, error: otpError } = await supabaseAdmin
      .from('otp_requests')
      .select('id, phone, verified, expires_at, sms_status, fallback_required_at')
      .eq('id', otpRequestId)
      .single();

    if (otpError || !otpRequest) {
      return jsonResponse({ success: false, error: 'OTP request not found' }, 404);
    }

    if (otpRequest.verified) {
      return jsonResponse({ success: true, skipped: true, reason: 'already_verified' });
    }
    if (new Date(otpRequest.expires_at as string).getTime() <= Date.now()) {
      return jsonResponse({ success: true, skipped: true, reason: 'otp_expired' });
    }
    if ((otpRequest.sms_status as string) !== 'not_sent') {
      return jsonResponse({ success: true, skipped: true, reason: 'sms_already_processed' });
    }
    if (otpRequest.fallback_required_at && new Date(otpRequest.fallback_required_at as string).getTime() > Date.now()) {
      return jsonResponse({ success: true, skipped: true, reason: 'fallback_delay_not_reached' });
    }

    const smsResult = await sendSmsFallback(String(otpRequest.phone));
    await supabaseAdmin
      .from('otp_requests')
      .update({
        sms_status: smsResult.ok ? 'sent' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', otpRequestId);

    if (!smsResult.ok) {
      return jsonResponse({ success: false, error: smsResult.error ?? 'SMS fallback failed' }, 502);
    }

    return jsonResponse({ success: true, channel: 'sms_fallback' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ success: false, error: message }, 500);
  }
});
