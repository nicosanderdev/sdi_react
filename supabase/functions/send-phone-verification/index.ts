import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authenticateUser,
  createUnauthorizedResponse,
} from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { normalizeMemberPhone } from '../_shared/mercadoPago.ts';
import {
  generateOtpCode,
  getClientIp,
  isAllowedMemberPhonePrefix,
  logMemberOtpMockMessage,
  makeOtpHash,
  OTP_TTL_SECONDS,
} from '../_shared/otp.ts';
import { sendWhatsappTemplateViaMeta, shouldUseWhatsappMock } from '../_shared/whatsapp.ts';

const OTP_WHATSAPP_TEMPLATE_NAME = 'informacion_reserva';
const OTP_WHATSAPP_TEMPLATE_LANGUAGE = 'es';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await authenticateUser(req);
  if (authResult.error || !authResult.user) {
    return createUnauthorizedResponse(authResult.error ?? 'Authentication failed');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing server environment variables' }, 500);
  }

  try {
    const body = (await req.json()) as {
      phonePrefix?: string;
      phone?: string;
      newPhone?: string;
    };
    const phonePrefix = (body.phonePrefix ?? '').trim();
    const phoneLocal = (body.phone ?? body.newPhone ?? '').trim();

    if (!phonePrefix || !phoneLocal) {
      return jsonResponse({ error: 'Phone prefix and number are required' }, 400);
    }
    if (!isAllowedMemberPhonePrefix(phonePrefix)) {
      return jsonResponse({ error: 'Phone prefix must be +598, +55, or +54' }, 400);
    }

    const e164 = normalizeMemberPhone(phoneLocal, phonePrefix);
    if (!e164) {
      return jsonResponse({ error: 'Phone must be a valid number for the selected country' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const requestIp = getClientIp(req);
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc(
      'check_and_increment_otp_rate_limit',
      {
        p_phone: e164,
        p_ip: requestIp,
        p_phone_max_hits: 3,
        p_ip_max_hits: 20,
        p_window_minutes: 10,
      }
    );
    if (rateLimitError) {
      return jsonResponse({ error: 'Could not evaluate rate limits' }, 500);
    }
    if (!Boolean((rateLimitData as { allowed?: boolean } | null)?.allowed)) {
      return jsonResponse({ error: 'Too many verification requests. Try again later.' }, 429);
    }

    const otpCode = generateOtpCode();
    const otpHash = await makeOtpHash(otpCode);
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();
    const userId = authResult.user.id;

    await supabaseAdmin
      .from('otp_requests')
      .update({
        expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('purpose', 'member_phone')
      .eq('verified', false);

    const { data: otpInsert, error: otpInsertError } = await supabaseAdmin
      .from('otp_requests')
      .insert({
        purpose: 'member_phone',
        user_id: userId,
        phone: e164,
        phone_prefix: phonePrefix,
        phone_local: phoneLocal,
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
      console.error('send-phone-verification insert failed:', otpInsertError);
      return jsonResponse({ error: 'Failed to generate verification code' }, 500);
    }

    const otpRequestId = otpInsert.id as string;

    if (shouldUseWhatsappMock()) {
      logMemberOtpMockMessage({
        channel: 'whatsapp',
        to: e164,
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

      return jsonResponse({
        message: 'Verification code sent successfully',
        phone: phoneLocal,
        phonePrefix,
        mode: 'dry-run',
      });
    }

    const waResult = await sendWhatsappTemplateViaMeta(e164, {
      name: OTP_WHATSAPP_TEMPLATE_NAME,
      languageCode: OTP_WHATSAPP_TEMPLATE_LANGUAGE,
      bodyParameters: [otpCode],
    });
    if (!waResult.ok) {
      console.error('send-phone-verification WhatsApp failed:', waResult.error);
      await supabaseAdmin
        .from('otp_requests')
        .update({
          whatsapp_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', otpRequestId);
      return jsonResponse({ error: 'Could not send the verification code via WhatsApp' }, 502);
    }

    await supabaseAdmin
      .from('otp_requests')
      .update({
        whatsapp_status: 'sent',
        whatsapp_message_id: waResult.messageId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', otpRequestId);

    return jsonResponse({
      message: 'Verification code sent successfully',
      phone: phoneLocal,
      phonePrefix,
    });
  } catch (error) {
    console.error('Error in send-phone-verification:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
