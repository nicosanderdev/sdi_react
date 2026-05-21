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

export function shouldUseBookingOtpMock(): boolean {
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
    '========== BOOKING OTP (local mock WhatsApp) ==========',
    `phone: ${params.phone}`,
    `holdId: ${params.holdId}`,
    `otpRequestId: ${params.otpRequestId}`,
    `code: ${params.otpCode}`,
    `expiresAt: ${params.expiresAt}`,
    `verify: POST ${verifyUrl}`,
    `body: { "holdId": "${params.holdId}", "phone": "${params.phone}", "code": "<code above>" }`,
    '======================================================',
  ].join('\n'));
}
