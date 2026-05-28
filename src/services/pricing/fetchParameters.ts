import { supabase } from '../../config/supabase';
import type { AppParametersMap } from './types';
import type { GuestSiteListingType } from '../../types/guestReviewContract';

let cache: { scope: string; at: number; data: AppParametersMap } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchAppParameters(
  siteScope: GuestSiteListingType | 'global' = 'global'
): Promise<AppParametersMap> {
  const scope = siteScope ?? 'global';
  if (cache && cache.scope === scope && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const { data, error } = await supabase.rpc('get_app_parameters', {
    p_site_scope: scope,
  });

  if (error) throw error;

  const map = (data ?? {}) as AppParametersMap;
  cache = { scope, at: Date.now(), data: map };
  return map;
}

export function clearAppParametersCache(): void {
  cache = null;
}

export async function fetchListingDailyFactors(
  listingId: string,
  from: string,
  to: string
): Promise<import('./types').DailyFactorEntry[]> {
  const { data, error } = await supabase.rpc('get_listing_daily_factors', {
    p_listing_id: listingId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return (data ?? []) as import('./types').DailyFactorEntry[];
}
