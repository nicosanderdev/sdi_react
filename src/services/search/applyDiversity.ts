import type { RankedSearchItem, SearchDiversityRules } from './types';
import type { AppParametersMap } from './types';
import { paramJson } from './paramHelpers';

const DEFAULT_DIVERSITY: SearchDiversityRules = {
  maxPerOwner: 2,
  maxPerCity: 5,
  geoGridKm: 2,
  maxPerCell: 3,
};

export function getSearchDiversityRules(params: AppParametersMap): SearchDiversityRules {
  return paramJson(params, 'SEARCH_DIVERSITY_RULES', DEFAULT_DIVERSITY);
}

/** Approximate lat/lng grid cell key (km-scale). */
function geoCellKey(lat: number, lng: number, gridKm: number): string {
  const latDeg = gridKm / 111;
  const lngDeg = gridKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const latCell = Math.floor(lat / latDeg);
  const lngCell = Math.floor(lng / lngDeg);
  return `${latCell}:${lngCell}`;
}

/**
 * Greedy re-rank: walk candidates in score order and pick those that fit diversity caps.
 */
export function applyDiversity(
  items: RankedSearchItem[],
  params: AppParametersMap,
): RankedSearchItem[] {
  const rules = getSearchDiversityRules(params);
  const maxPerOwner = rules.maxPerOwner ?? 2;
  const maxPerCity = rules.maxPerCity ?? 5;
  const maxPerCell = rules.maxPerCell ?? 3;
  const gridKm = rules.geoGridKm ?? 2;

  const sorted = [...items].sort((a, b) => b.finalScore - a.finalScore);
  const result: RankedSearchItem[] = [];
  const ownerCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const cellCounts = new Map<string, number>();

  for (const item of sorted) {
    const ownerId = item.ownerId ?? '';
    const city = (item.city ?? '').toLowerCase();
    const cell =
      item.lat != null && item.lng != null
        ? geoCellKey(item.lat, item.lng, gridKm)
        : '';

    if (ownerId && (ownerCounts.get(ownerId) ?? 0) >= maxPerOwner) continue;
    if (city && (cityCounts.get(city) ?? 0) >= maxPerCity) continue;
    if (cell && (cellCounts.get(cell) ?? 0) >= maxPerCell) continue;

    result.push(item);
    if (ownerId) ownerCounts.set(ownerId, (ownerCounts.get(ownerId) ?? 0) + 1);
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    if (cell) cellCounts.set(cell, (cellCounts.get(cell) ?? 0) + 1);
  }

  return result;
}
