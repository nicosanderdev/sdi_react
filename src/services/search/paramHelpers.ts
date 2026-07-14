import type { AppParametersMap } from './types';

export function paramNumber(
  params: AppParametersMap,
  key: string,
  fallback: number,
): number {
  const v = params[key];
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

export function paramJson<T extends object>(
  params: AppParametersMap,
  key: string,
  fallback: T,
): T {
  const v = params[key];
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as T;
  }
  return fallback;
}

export function paramBoolean(
  params: AppParametersMap,
  key: string,
  fallback: boolean,
): boolean {
  const v = params[key];
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}
