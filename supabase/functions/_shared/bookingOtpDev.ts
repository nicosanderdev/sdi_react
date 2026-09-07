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

/**
 * Print the booking manage token to edge function logs.
 * Local always; hosted when BOOKING_OTP_MOCK=true or a guest manage base URL contains "staging".
 */
export function shouldLogBookingManageToken(): boolean {
  if (Deno.env.get('BOOKING_OTP_MOCK') === 'true') {
    return true;
  }
  if (isLocalSupabaseRuntime()) {
    return true;
  }
  const bases = [
    Deno.env.get('GUEST_BOOKING_MANAGE_BASE_URL_MAIN') ?? '',
    Deno.env.get('GUEST_BOOKING_MANAGE_BASE_URL_ALT') ?? '',
    Deno.env.get('GUEST_BOOKING_MANAGE_BASE_URL') ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return bases.includes('staging');
}

export interface BookingManageTokenLogParams {
  bookingId: string;
  reservationCode?: string | null;
  listingType?: string | null;
  token: string;
  expiresAt?: string | null;
  manageUrl?: string | null;
}

export function logBookingManageTokenDevMessage(params: BookingManageTokenLogParams): void {
  const payUrl = Deno.env.get('SUPABASE_URL') ?? 'http://127.0.0.1:54321';
  console.log([
    '========== BOOKING MANAGE TOKEN ==========',
    `booking_id: ${params.bookingId}`,
    `reservation_code: ${params.reservationCode ?? ''}`,
    `listing_type: ${params.listingType ?? ''}`,
    `token: ${params.token}`,
    `expires_at: ${params.expiresAt ?? ''}`,
    `manage_url: ${params.manageUrl ?? ''}`,
    `pay: POST ${payUrl.replace(/\/$/, '')}/functions/v1/mercado-pago-create-preference`,
    `body: { "manageToken": "${params.token}" }`,
    '==========================================',
  ].join('\n'));
}
