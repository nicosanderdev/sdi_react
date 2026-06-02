import { fetchAppParameters, clearAppParametersCache } from '../pricing/fetchParameters';
import type { GuestSiteListingType } from '../../types/guestReviewContract';
import type { AppParametersMap } from './types';

export { clearAppParametersCache as clearSearchParametersCache };

export async function fetchSearchParameters(
  siteScope: GuestSiteListingType | 'global' = 'global',
): Promise<AppParametersMap> {
  return fetchAppParameters(siteScope);
}
