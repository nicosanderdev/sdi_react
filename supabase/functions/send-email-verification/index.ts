import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authenticateUser,
  createUnauthorizedResponse,
} from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  generateOtpCode,
  getClientIp,
  getVerificationFromEmail,
  logMemberOtpMockMessage,
  makeOtpHash,
  OTP_TTL_SECONDS,
} from '../_shared/otp.ts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildVerificationHtml(code: string): string {
  return `
    <h2>Verificá tu correo electrónico</h2>
    <p>Tu código de verificación es:</p>
    <p style="font-size: 24px; letter-spacing: 4px;"><strong>${code}</strong></p>
    <p>Este código vence en 5 minutos.</p>
    <p>Si no solicitaste este código, podés ignorar este mensaje.</p>
  `;
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
    const body = (await req.json()) as { email?: string; newEmail?: string };
    let email = (body.email ?? body.newEmail ?? '').trim().toLowerCase();

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!email) {
      const { data: member, error: memberError } = await supabaseAdmin
        .from('Members')
        .select('Email')
        .eq('UserId', authResult.user.id)
        .eq('IsDeleted', false)
        .single();
      if (memberError || !member?.Email) {
        return jsonResponse({ error: 'Email is required' }, 400);
      }
      email = String(member.Email).trim().toLowerCase();
    }

    if (!EMAIL_REGEX.test(email)) {
      return jsonResponse({ error: 'Introduce un correo válido.' }, 400);
    }

    const requestIp = getClientIp(req);
    const { data: rateLimitData, error: rateLimitError } = await supabaseAdmin.rpc(
      'check_and_increment_otp_rate_limit',
      {
        p_phone: email,
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
      .eq('purpose', 'member_email')
      .eq('verified', false);

    const { data: otpInsert, error: otpInsertError } = await supabaseAdmin
      .from('otp_requests')
      .insert({
        purpose: 'member_email',
        user_id: userId,
        email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0,
        max_attempts: 5,
        verified: false,
        request_ip: requestIp,
        provider: 'resend',
        whatsapp_status: 'not_sent',
        sms_status: 'not_sent',
      })
      .select('id')
      .single();

    if (otpInsertError || !otpInsert) {
      console.error('send-email-verification insert failed:', otpInsertError);
      return jsonResponse({ error: 'Failed to generate verification code' }, 500);
    }

    const otpRequestId = otpInsert.id as string;
    const sendEmailsEnabled = Deno.env.get('SEND_EMAILS_ENABLED') === 'true';
    const fromEmail = getVerificationFromEmail();
    const subject = 'Código de verificación';
    const html = buildVerificationHtml(otpCode);

    if (!sendEmailsEnabled) {
      logMemberOtpMockMessage({
        channel: 'email',
        to: email,
        otpRequestId,
        otpCode,
        expiresAt,
      });
      return jsonResponse({
        message: 'Verification code sent successfully',
        email,
        mode: 'dry-run',
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return jsonResponse({ error: 'Email service not configured' }, 500);
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const resendError = await resendResponse.text();
      console.error('Resend API error:', resendError);
      return jsonResponse({ error: 'Could not send the verification email' }, 502);
    }

    return jsonResponse({
      message: 'Verification code sent successfully',
      email,
    });
  } catch (error) {
    console.error('Error in send-email-verification:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
