export const DEFAULT_LISTING_CURRENCY = 'UYU' as const;

export const ADMIN_LISTING_CURRENCIES = ['UYU', 'USD', 'BRL'] as const;

export type AdminListingCurrency = (typeof ADMIN_LISTING_CURRENCIES)[number];

export type ListingCurrencyCode = 'USD' | 'UYU' | 'BRL' | 'EUR' | 'GBP';

export function isUyuCurrencyCode(code: string | null | undefined): boolean {
  return String(code ?? '').trim().toUpperCase() === 'UYU';
}
