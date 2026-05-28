import type { DailyFactorEntry } from './types';

export function resolveDemandFactor(
  listingId: string | undefined,
  dateIso: string,
  dailyFactors?: DailyFactorEntry[]
): number {
  if (!dailyFactors?.length || !listingId) return 1;
  const row = dailyFactors.find(f => f.date === dateIso);
  return row?.demandFactor ?? 1;
}
