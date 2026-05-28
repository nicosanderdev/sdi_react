import type { AppParametersMap, SeasonCalendarEntry, SeasonTier } from './types';

function paramNumber(params: AppParametersMap, key: string, fallback: number): number {
  const v = params[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') return parseFloat(v);
  return fallback;
}

function dateInMmDdRange(date: Date, from: string, to: string): boolean {
  const mmdd = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  if (from <= to) return mmdd >= from && mmdd <= to;
  return mmdd >= from || mmdd <= to;
}

export function resolveSeasonTier(date: Date, params: AppParametersMap): SeasonTier {
  const calendar = params.SEASON_CALENDAR;
  if (!Array.isArray(calendar)) return 'mid';

  for (const entry of calendar as SeasonCalendarEntry[]) {
    if (entry?.from && entry?.to && dateInMmDdRange(date, entry.from, entry.to)) {
      const tier = String(entry.tier ?? 'mid').toLowerCase();
      if (tier === 'low' || tier === 'high') return tier;
      return 'mid';
    }
  }
  return 'mid';
}

export function resolveSeasonFactor(date: Date, params: AppParametersMap): number {
  const tier = resolveSeasonTier(date, params);
  if (tier === 'low') return paramNumber(params, 'SEASON_FACTOR_LOW', 0.9);
  if (tier === 'high') return paramNumber(params, 'SEASON_FACTOR_HIGH', 1.2);
  return paramNumber(params, 'SEASON_FACTOR_MID', 1);
}
