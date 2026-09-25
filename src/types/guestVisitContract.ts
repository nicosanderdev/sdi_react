/**
 * RPC contracts for guest-site visit tracking (property views + page views).
 * Backend: supabase/migrations/20260922180000_guest_site_visits.sql
 * Consumer: SummerRent / EventVenue guest apps (not wired in sdi_react UI).
 * Handoff: docs/handoffs/guest-site-visits-tracking.md
 */

/** Listing types that have a public guest site and record visits. */
export type GuestTrackedListingType = 'SummerRent' | 'EventVenue';

export const GUEST_TRACKED_LISTING_TYPES: readonly GuestTrackedListingType[] = [
  'SummerRent',
  'EventVenue',
] as const;

export function isGuestTrackedListingType(value: string): value is GuestTrackedListingType {
  return (GUEST_TRACKED_LISTING_TYPES as readonly string[]).includes(value);
}

/** Stable page keys shared by both guest sites. */
export type GuestPageKey =
  | 'home'
  | 'search'
  | 'about'
  | 'how_it_works'
  | 'contact'
  | 'property_detail';

export const GUEST_PAGE_KEYS: readonly GuestPageKey[] = [
  'home',
  'search',
  'about',
  'how_it_works',
  'contact',
  'property_detail',
] as const;

/** Site pages that are not a property detail view. */
export const GUEST_CONTENT_PAGE_KEYS = [
  'home',
  'search',
  'about',
  'how_it_works',
  'contact',
] as const satisfies readonly GuestPageKey[];

export type GuestContentPageKey = (typeof GUEST_CONTENT_PAGE_KEYS)[number];

export const GUEST_CONTENT_PAGE_LABELS_ES: Record<GuestContentPageKey, string> = {
  home: 'Inicio',
  search: 'Búsqueda',
  about: 'Acerca de',
  how_it_works: 'Cómo funciona',
  contact: 'Contacto',
};

/** Classified traffic buckets stored by record_guest_visit. */
export type GuestTrafficSource =
  | 'direct'
  | 'organic'
  | 'social'
  | 'referral'
  | 'paid'
  | 'email';

export const GUEST_TRAFFIC_SOURCES: readonly GuestTrafficSource[] = [
  'direct',
  'organic',
  'social',
  'referral',
  'paid',
  'email',
] as const;

export const GUEST_TRAFFIC_SOURCE_LABELS_ES: Record<GuestTrafficSource, string> = {
  direct: 'Directo',
  organic: 'Orgánico',
  social: 'Social',
  referral: 'Referido',
  paid: 'Pagado',
  email: 'Email',
};

export function getGuestTrafficSourceLabelEs(source: string): string {
  return GUEST_TRAFFIC_SOURCE_LABELS_ES[source as GuestTrafficSource] ?? source;
}

/** Filter value for dashboards: null / empty / 'all' / 'todos' = every tracked site. */
export type GuestListingFilter = GuestTrackedListingType | null | 'all' | 'todos';

export interface RecordGuestVisitParams {
  p_session_id: string;
  p_listing_type: GuestTrackedListingType;
  p_page_key: GuestPageKey;
  /** Required when page_key is property_detail; must be null/empty otherwise. */
  p_property_id: string | null;
  /** Hostname only (no path, port, or protocol). */
  p_page_host: string;
  p_referrer_host: string | null;
  p_utm_source: string | null;
  p_utm_medium: string | null;
  p_utm_campaign: string | null;
}

export interface RecordGuestVisitResult {
  success: boolean;
  counted_page?: boolean;
  counted_property?: boolean;
  error?: string;
}

export interface AdminGuestVisitTopViewed {
  rank: number;
  propertyId: string;
  listingType: GuestTrackedListingType;
  name: string;
  visits: number;
}

export interface AdminGuestVisitTopConversion {
  rank: number;
  propertyId: string;
  listingType: GuestTrackedListingType;
  name: string;
  visits: number;
  holds: number;
  rate: number;
}

export interface AdminGuestVisitOverview {
  period: string;
  listingType: GuestTrackedListingType | null;
  propertyViews: number;
  pageViews: number;
  holds: number;
  conversionRate: number | null;
  traffic: Partial<Record<GuestTrafficSource, number>>;
  topViewed: AdminGuestVisitTopViewed[];
  topConversion: AdminGuestVisitTopConversion[];
}

export interface AdminGuestVisitTimeseriesPoint {
  date: string;
  property_views: number;
  page_views: number;
}

export interface PropertyVisitBySite {
  listingType: GuestTrackedListingType;
  visitCount: number;
  holds: number;
  conversion: string;
}

/** Suggested localStorage key for the cross-tab guest session id. */
export const GUEST_SESSION_STORAGE_KEY = 'encartelera_guest_session_id';
