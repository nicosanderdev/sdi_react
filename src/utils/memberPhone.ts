export const MEMBER_PHONE_PREFIXES = [
  { country: 'UY', prefix: '+598', label: 'UY +598' },
  { country: 'BR', prefix: '+55', label: 'BR +55' },
  { country: 'AR', prefix: '+54', label: 'AR +54' },
] as const;

export const DEFAULT_MEMBER_PHONE_PREFIX = '+598';

export type MemberPhonePrefix = (typeof MEMBER_PHONE_PREFIXES)[number]['prefix'];

export function isAllowedMemberPhonePrefix(prefix: string): boolean {
  return MEMBER_PHONE_PREFIXES.some((item) => item.prefix === prefix.trim());
}

export function formatMemberPhoneDisplay(
  prefix?: string | null,
  phone?: string | null
): string {
  const local = (phone ?? '').trim();
  const dial = (prefix ?? '').trim();
  if (!local && !dial) return '';
  if (!dial) return local;
  if (!local) return dial;
  return `${dial} ${local}`;
}
