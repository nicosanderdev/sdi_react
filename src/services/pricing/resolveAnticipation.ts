import type { AppParametersMap } from './types';

function paramNumber(params: AppParametersMap, key: string, fallback: number): number {
  const v = params[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') return parseFloat(v);
  return fallback;
}

function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function resolveAnticipationFactor(
  checkIn: Date,
  params: AppParametersMap,
  searchDate: Date = new Date()
): number {
  const search = parseUtcDate(searchDate.toISOString().slice(0, 10));
  const checkInDay = parseUtcDate(checkIn.toISOString().slice(0, 10));
  const daysUntil = Math.floor((checkInDay.getTime() - search.getTime()) / 86400000);
  const minDays = paramNumber(params, 'ANTICIPATION_MIN_DAYS', 30);
  if (daysUntil >= minDays) {
    return paramNumber(params, 'ANTICIPATION_MULTIPLIER', 0.95);
  }
  return 1;
}
