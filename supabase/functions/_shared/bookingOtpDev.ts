const LOCAL_SUPABASE_HOSTS = new Set(['127.0.0.1', 'localhost', 'kong']);

export function isLocalSupabaseRuntime(): boolean {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  try {
    const host = new URL(url).hostname;
    return LOCAL_SUPABASE_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * Skip Meta/SMS and log the OTP to the edge function console.
 * - Local Supabase: on by default (unless BOOKING_OTP_LIVE_ENABLED=true)
 * - Hosted (staging/prod): only when BOOKING_OTP_MOCK=true
 */
export function shouldUseBookingOtpMock(): boolean {
  if (Deno.env.get('BOOKING_OTP_MOCK') === 'true') {
    return true;
  }
  return isLocalSupabaseRuntime() && Deno.env.get('BOOKING_OTP_LIVE_ENABLED') !== 'true';
}

export interface BookingOtpMockLogParams {
  phone: string;
  holdId: string;
  otpRequestId: string;
  otpCode: string;
  expiresAt: string;
}

export function logBookingOtpMockMessage(params: BookingOtpMockLogParams): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
  const verifyUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/booking-verify-otp`;

  console.log([
    '========== BOOKING OTP (mock WhatsApp) ==========',
    `phone: ${params.phone}`,
    `holdId: ${params.holdId}`,
    `otpRequestId: ${params.otpRequestId}`,
    `code: ${params.otpCode}`,
    `expiresAt: ${params.expiresAt}`,
    `verify: POST ${verifyUrl}`,
    `body: { "holdId": "${params.holdId}", "phone": "${params.phone}", "code": "<code above>" }`,
    '================================================',
  ].join('\n'));
}
