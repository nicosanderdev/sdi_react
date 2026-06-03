import type { AmenityLanguage } from './Amenity';

export type { AmenityLanguage };

export const AMENITY_LANGUAGES: AmenityLanguage[] = ['es', 'en', 'pt'];

export const AMENITY_LANGUAGE_LABELS: Record<AmenityLanguage, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
};

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
  if (!descriptions) return {};
  const out: AmenityDescriptionsByLanguage = {};
  for (const lang of AMENITY_LANGUAGES) {
    const v = descriptions[lang]?.trim();
    if (v) out[lang] = v;
  }
  return out;
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
  if (!descriptions) return undefined;
  const pref = preferredLocale?.toLowerCase().slice(0, 2) as AmenityLanguage | undefined;
  const order: AmenityLanguage[] = [];
  if (pref && AMENITY_LANGUAGES.includes(pref)) order.push(pref);
  for (const lang of ['es', 'en', 'pt'] as AmenityLanguage[]) {
    if (!order.includes(lang)) order.push(lang);
  }
  for (const lang of order) {
    const v = descriptions[lang]?.trim();
    if (v) return v;
  }
  return undefined;
}
