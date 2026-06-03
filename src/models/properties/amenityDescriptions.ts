import type { AmenityLanguage } from './Amenity';
import {
  LOCALIZED_LANGUAGES,
  LOCALIZED_LANGUAGE_LABELS,
  pruneLocalizedText,
  pickLocalizedText,
} from './localizedText';

export type { AmenityLanguage };

export const AMENITY_LANGUAGES = LOCALIZED_LANGUAGES as AmenityLanguage[];
export const AMENITY_LANGUAGE_LABELS = LOCALIZED_LANGUAGE_LABELS as Record<AmenityLanguage, string>;

export type AmenityDescriptionsByLanguage = Partial<Record<AmenityLanguage, string>>;

/** Form state: amenityId -> per-language optional description */
export type AmenityDescriptionsFormState = Record<string, AmenityDescriptionsByLanguage>;

export interface AmenityLinkForRpc {
  amenityId: string;
  descriptions: AmenityDescriptionsByLanguage;
}

function pruneDescriptions(
  descriptions?: AmenityDescriptionsByLanguage
): AmenityDescriptionsByLanguage {
  return pruneLocalizedText(descriptions) as AmenityDescriptionsByLanguage;
}

/** Build RPC payload for create_estate_property / update_estate_property */
export function buildAmenityLinksForRpc(
  amenityIds: string[] | undefined,
  amenityDescriptions?: AmenityDescriptionsFormState
): AmenityLinkForRpc[] {
  const ids = amenityIds ?? [];
  return ids.map(amenityId => ({
    amenityId,
    descriptions: pruneDescriptions(amenityDescriptions?.[amenityId]),
  }));
}

/** Map loaded amenities (with descriptions) into form state */
export function amenityDescriptionsFromAmenities(
  amenities: { id: string; descriptions?: AmenityDescriptionsByLanguage }[]
): AmenityDescriptionsFormState {
  const out: AmenityDescriptionsFormState = {};
  for (const a of amenities) {
    const pruned = pruneDescriptions(a.descriptions);
    if (Object.keys(pruned).length > 0) {
      out[a.id] = pruned;
    }
  }
  return out;
}

export function pickAmenityDescription(
  descriptions: AmenityDescriptionsByLanguage | undefined,
  preferredLocale?: string
): string | undefined {
  return pickLocalizedText(descriptions, preferredLocale);
}
