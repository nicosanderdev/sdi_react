export const OTP_TTL_SECONDS = 5 * 60;

export function generateOtpCode(): string {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(random[0] % 1_000_000).padStart(6, '0');
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function makeOtpHash(otpCode: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hash = await sha256Hex(`${salt}:${otpCode}`);
  return `${salt}$${hash}`;
}

export function getClientIp(req: Request, bodyIp?: string | null): string | null {
  if (bodyIp && bodyIp.trim().length > 0) {
    return bodyIp.trim();
  }
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (!forwardedFor) return null;
  const firstIp = forwardedFor.split(',')[0]?.trim();
  return firstIp?.length ? firstIp : null;
}

export const MEMBER_PHONE_PREFIXES = ['+598', '+55', '+54'] as const;

export function isAllowedMemberPhonePrefix(prefix: string): boolean {
  return (MEMBER_PHONE_PREFIXES as readonly string[]).includes(prefix.trim());
}

export function getVerificationFromEmail(): string {
  return (
    Deno.env.get('VERIFICATION_FROM_EMAIL')
    || 'Holiday Trips <bookings@holidaytrips.com>'
  );
}

export interface MemberOtpMockLogParams {
  channel: 'whatsapp' | 'email';
  to: string;
  otpRequestId: string;
  otpCode: string;
  expiresAt: string;
}

export function logMemberOtpMockMessage(params: MemberOtpMockLogParams): void {
  console.log([
    '========== MEMBER CONTACT OTP (mock) ==========',
    `channel: ${params.channel}`,
    `to: ${params.to}`,
    `otpRequestId: ${params.otpRequestId}`,
    `code: ${params.otpCode}`,
    `expiresAt: ${params.expiresAt}`,
    '===============================================',
  ].join('\n'));
}
