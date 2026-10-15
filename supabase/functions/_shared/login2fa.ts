import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeMemberPhone } from './mercadoPago.ts';
import {
  generateOtpCode,
  getClientIp,
  logMemberOtpMockMessage,
  makeOtpHash,
  OTP_TTL_SECONDS,
} from './otp.ts';
import { sendWhatsappTemplateViaMeta, shouldUseWhatsappMock } from './whatsapp.ts';

export const LOGIN_2FA_PURPOSE = 'login_2fa';
export const OTP_WHATSAPP_TEMPLATE_NAME = 'informacion_reserva_1';
export const OTP_WHATSAPP_TEMPLATE_LANGUAGE = 'es';

export interface Member2faRow {
  UserId: string;
  Phone: string | null;
  PhonePrefix: string | null;
  PhoneVerifiedAt: string | null;
  Email: string | null;
  twofactorenabled: boolean | null;
}

export function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing server environment variables');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getMemberForUser(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<Member2faRow | null> {
  const { data, error } = await supabaseAdmin
    .from('Members')
    .select('UserId, Phone, PhonePrefix, PhoneVerifiedAt, Email, twofactorenabled')
    .eq('UserId', userId)
    .eq('IsDeleted', false)
    .maybeSingle();

  if (error) {
    console.error('getMemberForUser failed:', error);
    return null;
  }
  return data as Member2faRow | null;
}

export function memberPhoneE164(member: Member2faRow): string | null {
  return normalizeMemberPhone(member.Phone, member.PhonePrefix);
}

export interface SendLogin2faResult {
  ok: boolean;
  challengeId?: string;
  error?: string;
  status?: number;
  mode?: 'live' | 'dry-run';
}

/**
 * Create a login_2fa otp_requests row and deliver the code via WhatsApp template.
 * Phone is always taken from the member row (never from the client).
 */
export async function sendLogin2faOtp(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  member: Member2faRow;
  req: Request;
  requirePhoneVerified?: boolean;
}): Promise<SendLogin2faResult> {
  const { supabaseAdmin, userId, member, req } = params;
  const requirePhoneVerified = params.requirePhoneVerified !== false;

  if (requirePhoneVerified && !member.PhoneVerifiedAt) {
    return {
      ok: false,
      error: 'Verificá tu teléfono antes de usar la autenticación en dos pasos.',
      status: 400,
    };
  }

  const e164 = memberPhoneE164(member);
  if (!e164) {
    return {
      ok: false,
      error: 'No hay un teléfono válido asociado a la cuenta.',
      status: 400,
    };
  }

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
    console.error('login_2fa rate limit failed:', rateLimitError);
    return { ok: false, error: 'Could not evaluate rate limits', status: 500 };
  }
  if (!Boolean((rateLimitData as { allowed?: boolean } | null)?.allowed)) {
    return {
      ok: false,
      error: 'Too many verification requests. Try again later.',
      status: 429,
    };
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
    .eq('user_id', userId)
    .eq('purpose', LOGIN_2FA_PURPOSE)
    .eq('verified', false);

  const { data: otpInsert, error: otpInsertError } = await supabaseAdmin
    .from('otp_requests')
    .insert({
      purpose: LOGIN_2FA_PURPOSE,
      user_id: userId,
      phone: e164,
      phone_prefix: member.PhonePrefix,
      phone_local: member.Phone,
      email: member.Email,
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
    console.error('login_2fa insert failed:', otpInsertError);
    return { ok: false, error: 'Failed to generate verification code', status: 500 };
  }

  const challengeId = otpInsert.id as string;

  if (shouldUseWhatsappMock()) {
    logMemberOtpMockMessage({
      channel: 'whatsapp',
      to: e164,
      otpRequestId: challengeId,
      otpCode,
      expiresAt,
    });
    await supabaseAdmin
      .from('otp_requests')
      .update({
        whatsapp_status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', challengeId);

    return { ok: true, challengeId, mode: 'dry-run' };
  }

  const waResult = await sendWhatsappTemplateViaMeta(e164, {
    name: OTP_WHATSAPP_TEMPLATE_NAME,
    languageCode: OTP_WHATSAPP_TEMPLATE_LANGUAGE,
    bodyParameters: [otpCode],
  });

  if (!waResult.ok) {
    console.error('login_2fa WhatsApp failed:', waResult.error);
    await supabaseAdmin
      .from('otp_requests')
      .update({
        whatsapp_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', challengeId);
    return {
      ok: false,
      error: waResult.error ?? 'Could not send the verification code via WhatsApp',
      status: 502,
    };
  }

  await supabaseAdmin
    .from('otp_requests')
    .update({
      whatsapp_status: 'sent',
      whatsapp_message_id: waResult.messageId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', challengeId);

  return { ok: true, challengeId, mode: 'live' };
}

export async function mintSessionForUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  email: string
): Promise<{ access_token: string; refresh_token: string } | { error: string }> {
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    console.error('generateLink for login_2fa failed:', linkError);
    return { error: 'Could not create session' };
  }

  const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });

  if (verifyError || !verifyData.session) {
    console.error('verifyOtp for login_2fa failed:', verifyError);
    return { error: 'Could not create session' };
  }

  if (verifyData.user?.id && verifyData.user.id !== userId) {
    console.error('mintSessionForUser user mismatch', { expected: userId, got: verifyData.user.id });
    return { error: 'Could not create session' };
  }

  return {
    access_token: verifyData.session.access_token,
    refresh_token: verifyData.session.refresh_token,
  };
}
