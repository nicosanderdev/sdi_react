import type { AmenityLanguage } from './Amenity';
import {
  LOCALIZED_LANGUAGES,
  pruneLocalizedText,
  pickLocalizedText,
  type LocalizedTextByLanguage,
} from './localizedText';

export type { AmenityLanguage };

export const AMENITY_LANGUAGES = LOCALIZED_LANGUAGES as AmenityLanguage[];
export { LOCALIZED_LANGUAGE_LABELS as AMENITY_LANGUAGE_LABELS } from './localizedText';

export type AmenityDescriptionsByLanguage = Partial<Record<AmenityLanguage, string>>;

/** Form state: amenity template key -> per-language optional custom description */
export type AmenityDescriptionsFormState = Record<string, AmenityDescriptionsByLanguage | undefined>;

export interface AmenityLinkForRpc {
  key: string;
  descriptions: AmenityDescriptionsByLanguage;
}

function pruneDescriptions(
  descriptions?: AmenityDescriptionsByLanguage
): AmenityDescriptionsByLanguage {
  return pruneLocalizedText(descriptions) as AmenityDescriptionsByLanguage;
}

/** Build RPC payload for replace_estate_property_amenities */
export function buildAmenityLinksForRpc(
  amenityKeys: string[] | undefined,
  amenityDescriptions?: AmenityDescriptionsFormState
): AmenityLinkForRpc[] {
  const keys = [...new Set(amenityKeys ?? [])].filter(Boolean);
  return keys.map(key => ({
    key,
    descriptions: pruneDescriptions(amenityDescriptions?.[key]),
  }));
}

export interface AmenityEditorRow {
  key?: string;
  descriptions?: AmenityDescriptionsByLanguage;
}

/** Map editor RPC rows (raw custom copy only) into form state */
export function amenityEditorFromDb(rows: AmenityEditorRow[] | undefined): {
  keys: string[];
  descriptions: AmenityDescriptionsFormState;
} {
  const keys: string[] = [];
  const descriptions: AmenityDescriptionsFormState = {};
  for (const row of rows ?? []) {
    const key = row.key?.trim();
    if (!key) continue;
    if (!keys.includes(key)) keys.push(key);
    const pruned = pruneDescriptions(row.descriptions);
    if (Object.keys(pruned).length > 0) {
      descriptions[key] = pruned;
    }
  }
  return { keys, descriptions };
}

export function pickAmenityDescription(
  descriptions: AmenityDescriptionsByLanguage | LocalizedTextByLanguage | undefined,
  preferredLocale?: string
): string | undefined {
  return pickLocalizedText(descriptions as LocalizedTextByLanguage | undefined, preferredLocale);
}
