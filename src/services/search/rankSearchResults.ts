import type {
  PortalSearchResultItem,
  RankedSearchItem,
  SearchRankOptions,
} from './types';
import { mixFinalScore } from './mixScores';
import { applyDiversity } from './applyDiversity';
import { applyRandomness } from './applyRandomness';

/**
 * Client-side ranking pipeline: mix scores → diversity → randomness → sort.
 */
export function rankSearchResults(
  items: PortalSearchResultItem[],
  options: SearchRankOptions,
): RankedSearchItem[] {
  const { params, sessionSeed } = options;

  const withScores: RankedSearchItem[] = items.map((item) => ({
    ...item,
    finalScore: mixFinalScore(item.scores, item.onlineBoosts, params),
  }));

  const diversified = applyDiversity(withScores, params);
  const randomized = applyRandomness(diversified, sessionSeed, params);

  return randomized.sort((a, b) => b.finalScore - a.finalScore);
}

export function paginateRankedResults<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number } {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    total: items.length,
    page: safePage,
    pageSize: safeSize,
  };
}
