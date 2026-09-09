import type {
  PropertySearchOnlineBoosts,
  PropertySearchScores,
  SearchOnlineWeights,
  SearchScoreWeights,
} from './types';
import type { AppParametersMap } from './types';
import { paramJson } from './paramHelpers';

const DEFAULT_OFFLINE_WEIGHTS: SearchScoreWeights = {
  quality: 0.25,
  engagement: 0.2,
  reputation: 0.3,
  freshness: 0.15,
  exploration: 0.1,
};

const DEFAULT_ONLINE_WEIGHTS: SearchOnlineWeights = {
  availability: 0.15,
  distance: 0.1,
};

export function getSearchScoreWeights(params: AppParametersMap): SearchScoreWeights {
  return paramJson(params, 'SEARCH_SCORE_WEIGHTS', DEFAULT_OFFLINE_WEIGHTS);
}

export function getSearchOnlineWeights(params: AppParametersMap): SearchOnlineWeights {
  return paramJson(params, 'SEARCH_ONLINE_WEIGHTS', DEFAULT_ONLINE_WEIGHTS);
}

export function mixOfflineScore(
  scores: PropertySearchScores,
  weights: SearchScoreWeights = DEFAULT_OFFLINE_WEIGHTS,
): number {
  if (typeof scores.offline_base_score === 'number') {
    return scores.offline_base_score;
  }

  return (
    (scores.quality_score ?? 0) * (weights.quality ?? 0) +
    (scores.engagement_score ?? 0) * (weights.engagement ?? 0) +
    (scores.reputation_score ?? 0) * (weights.reputation ?? 0) +
    (scores.freshness_score ?? 0) * (weights.freshness ?? 0) +
    (scores.exploration_boost ?? 0) * (weights.exploration ?? 0)
  );
}

export function mixOnlineBoosts(
  boosts: PropertySearchOnlineBoosts,
  weights: SearchOnlineWeights = DEFAULT_ONLINE_WEIGHTS,
): number {
  return (
    (boosts.availability_score ?? 0) * (weights.availability ?? 0) +
    (boosts.distance_score ?? 0) * (weights.distance ?? 0)
  );
}

export function mixFinalScore(
  scores: PropertySearchScores,
  onlineBoosts: PropertySearchOnlineBoosts,
  params: AppParametersMap,
): number {
  const offlineWeights = getSearchScoreWeights(params);
  const onlineWeights = getSearchOnlineWeights(params);
  return mixOfflineScore(scores, offlineWeights) + mixOnlineBoosts(onlineBoosts, onlineWeights);
}
