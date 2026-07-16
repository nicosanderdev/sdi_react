import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  logBookingOtpMockMessage,
  shouldUseBookingOtpMock,
} from '../_shared/bookingOtpDev.ts';
import { sendWhatsappViaMeta } from '../_shared/whatsapp.ts';

interface SendOtpBody {
  holdId: string;
  phone: string;
  ip?: string | null;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PHONE_E164_REGEX = /^\+[1-9]\d{7,14}$/;
const OTP_TTL_SECONDS = 5 * 60;

function getClientIp(req: Request, bodyIp?: string | null): string | null {
  if (bodyIp && bodyIp.trim().length > 0) {
    return bodyIp.trim();
  }
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (!forwardedFor) return null;
  const firstIp = forwardedFor.split(',')[0]?.trim();
  return firstIp?.length ? firstIp : null;
}

function generateOtpCode(): string {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(random[0] % 1_000_000).padStart(6, '0');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function makeOtpHash(otpCode: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hash = await sha256Hex(`${salt}:${otpCode}`);
  return `${salt}$${hash}`;
}

function buildOtpMessage(otpCode: string): string {
  return `Your booking verification code is ${otpCode}. It expires in 5 minutes.`;
}

async function sendSmsFallback(phone: string, otpCode: string): Promise<{ ok: boolean; error?: string }> {
  const smsWebhookUrl = Deno.env.get('SMS_FALLBACK_WEBHOOK_URL');
  if (!smsWebhookUrl) {
    return { ok: false, error: 'SMS fallback provider is not configured' };
  }

  const response = await fetch(smsWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      message: buildOtpMessage(otpCode),
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

    const body = (await req.json()) as SendOtpBody;
    const holdId = body.holdId?.trim();
    const phone = body.phone?.trim();
    if (!holdId || !phone) {
      return jsonResponse({ success: false, error: 'holdId and phone are required' }, 400);
    }
    if (!PHONE_E164_REGEX.test(phone)) {
      return jsonResponse({ success: false, error: 'Phone must use E.164 format' }, 400);
    }
    const requestIp = getClientIp(req, body.ip);

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: holdData, error: holdError } = await supabaseAdmin
      .from('booking_holds')
      .select('id, status, expires_at')
      .eq('id', holdId)
      .single();

    if (holdError || !holdData) {
      return jsonResponse({ success: false, error: 'Hold not found' }, 404);
    }

    if (holdData.status !== 'pending') {
      return jsonResponse({ success: false, error: 'Hold is not active' }, 409);
    }

    if (new Date(holdData.expires_at).getTime() <= Date.now()) {
      return jsonResponse({ success: false, error: 'Hold has expired' }, 409);
    }

    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc('check_and_increment_otp_rate_limit', {
      p_phone: phone,
      p_ip: requestIp,
      p_phone_max_hits: 3,
      p_ip_max_hits: 20,
      p_window_minutes: 10,
    });
    if (rateLimitError) {
      return jsonResponse({ success: false, error: 'Could not evaluate rate limits' }, 500);
    }

    const allowed = Boolean((rateLimitData as { allowed?: boolean } | null)?.allowed);
    if (!allowed) {
      const reason = ((rateLimitData as { reason?: string } | null)?.reason ?? 'Too many OTP requests');
      return jsonResponse({ success: false, error: reason }, 429);
    }

    const otpCode = generateOtpCode();
    const otpHash = await makeOtpHash(otpCode);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

    await supabaseAdmin
      .from('otp_requests')
      .update({
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('phone', phone)
      .eq('verified', false);

    const { data: otpInsert, error: otpInsertError } = await supabaseAdmin
      .from('otp_requests')
      .insert({
        hold_id: holdId,
        phone,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0,
        max_attempts: 5,
        verified: false,
        request_ip: requestIp,
        provider: 'meta',
        whatsapp_status: 'pending',
        sms_status: 'not_sent',
      })
      .select('id')
      .single();

    if (otpInsertError || !otpInsert) {
      return jsonResponse({ success: false, error: 'Could not create OTP request' }, 500);
    }

    const otpRequestId = otpInsert.id as string;

    if (shouldUseBookingOtpMock()) {
      logBookingOtpMockMessage({
        phone,
        holdId,
        otpRequestId,
        otpCode,
        expiresAt,
      });

      await supabaseAdmin
        .from('otp_requests')
        .update({
          whatsapp_status: 'sent',
          updated_at: new Date().toISOString(),
        })
        .eq('id', otpRequestId);

      await supabaseAdmin
        .from('booking_holds')
        .update({ phone, updated_at: new Date().toISOString() })
        .eq('id', holdId);

      return jsonResponse({
        success: true,
        channel: 'local_mock',
        otpRequestId,
        mode: 'dry-run',
      });
    }

    const waResult = await sendWhatsappViaMeta(phone, buildOtpMessage(otpCode));
    if (!waResult.ok) {
      const smsResult = await sendSmsFallback(phone, otpCode);
      await supabaseAdmin
        .from('otp_requests')
        .update({
          whatsapp_status: 'failed',
          sms_status: smsResult.ok ? 'sent' : 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', otpRequestId);

      if (!smsResult.ok) {
        return jsonResponse({ success: false, error: 'WhatsApp and SMS delivery both failed' }, 502);
      }

      return jsonResponse({
        success: true,
        channel: 'sms_fallback',
        otpRequestId,
      });
    }

    await supabaseAdmin
      .from('otp_requests')
      .update({
        whatsapp_status: 'sent',
        whatsapp_message_id: waResult.messageId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', otpRequestId);

    await supabaseAdmin
      .from('booking_holds')
      .update({ phone, updated_at: new Date().toISOString() })
      .eq('id', holdId);

    return jsonResponse({
      success: true,
      channel: 'whatsapp',
      otpRequestId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ success: false, error: message }, 500);
  }
});
