import type { AppParametersMap, PriceRoundingMode } from './types';

export function getRoundingMode(params: AppParametersMap): PriceRoundingMode {
  const raw = String(params.PRICE_ROUNDING_MODE ?? 'tens').replace(/"/g, '');
  if (raw === 'none' || raw === 'ending_99') return raw;
  return 'tens';
}

export function commercialRound(amount: number, mode: PriceRoundingMode): number {
  if (mode === 'tens') return Math.round(amount / 10) * 10;
  if (mode === 'ending_99') {
    if (amount <= 0) return 0;
    return Math.floor(amount / 100) * 100 + 99;
  }
  return Math.round(amount * 100) / 100;
}

export function clampPrice(amount: number, min?: number | null, max?: number | null): number {
  let v = amount;
  if (min != null && v < min) v = min;
  if (max != null && v > max) v = max;
  return v;
}
