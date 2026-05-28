import type { AppParametersMap, SpecialDateEntry } from './types';

function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function resolveSpecialDayFactor(date: Date, params: AppParametersMap): number {
  const entries = params.SPECIAL_DATES;
  if (!Array.isArray(entries)) return 1;

  const day = parseUtcDate(date.toISOString().slice(0, 10));

  for (const entry of entries as SpecialDateEntry[]) {
    if (!entry?.start) continue;
    const start = parseUtcDate(entry.start);
    const end = parseUtcDate(entry.end ?? entry.start);
    if (day >= start && day <= end) {
      return typeof entry.multiplier === 'number' ? entry.multiplier : 1;
    }
  }
  return 1;
}
