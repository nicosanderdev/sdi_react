import type { RankedSearchItem, SearchRandomnessConfig } from './types';
import type { AppParametersMap } from './types';
import { paramJson } from './paramHelpers';

const DEFAULT_RANDOMNESS: SearchRandomnessConfig = {
  enabled: true,
  strength: 0.08,
  seedTtlMinutes: 30,
};

/** Deterministic 0..1 from seed + property id. */
export function hashSeedProperty(seed: string, propertyId: string): number {
  let h = 2166136261;
  const s = `${seed}:${propertyId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function getSearchRandomnessConfig(params: AppParametersMap): SearchRandomnessConfig {
  return paramJson(params, 'SEARCH_RANDOMNESS', DEFAULT_RANDOMNESS);
}

/**
 * Adds small seeded noise to finalScore for exploration. Does not mutate input order
 * until caller re-sorts.
 */
export function applyRandomness(
  items: RankedSearchItem[],
  sessionSeed: string,
  params: AppParametersMap,
): RankedSearchItem[] {
  const config = getSearchRandomnessConfig(params);
  if (config.enabled === false) {
    return items;
  }

  const strength = config.strength ?? 0.08;

  return items.map((item) => {
    const noise = (hashSeedProperty(sessionSeed, item.estatePropertyId) - 0.5) * 2 * strength * 100;
    return {
      ...item,
      finalScore: item.finalScore + noise,
    };
  });
}

const SESSION_SEED_KEY = 'portal_search_session_seed';
const SESSION_SEED_AT_KEY = 'portal_search_session_seed_at';

export function getOrCreateSessionSeed(params: AppParametersMap): string {
  if (typeof sessionStorage === 'undefined') {
    return `ephemeral-${Date.now()}`;
  }

  const config = getSearchRandomnessConfig(params);
  const ttlMs = (config.seedTtlMinutes ?? 30) * 60 * 1000;
  const existing = sessionStorage.getItem(SESSION_SEED_KEY);
  const at = Number(sessionStorage.getItem(SESSION_SEED_AT_KEY) ?? 0);

  if (existing && Date.now() - at < ttlMs) {
    return existing;
  }

  const seed = crypto.randomUUID();
  sessionStorage.setItem(SESSION_SEED_KEY, seed);
  sessionStorage.setItem(SESSION_SEED_AT_KEY, String(Date.now()));
  return seed;
}
