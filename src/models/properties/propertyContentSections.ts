import type { PropertyType } from './PropertyData';
import {
  type LocalizedTextByLanguage,
  pruneLocalizedText,
  pickLocalizedText,
  hasLocalizedText,
} from './localizedText';

export type PropertySectionLayoutType = 'split' | 'carousel' | 'stacked';
export type PropertySectionDisplayVariant = 'default' | 'compact' | 'hero';

export interface PropertyContentSectionFormRow {
  templateKey?: string | null;
  propertyType: PropertyType;
  localizedName: LocalizedTextByLanguage;
  localizedDescription: LocalizedTextByLanguage;
  layoutType: PropertySectionLayoutType;
  displayVariant: PropertySectionDisplayVariant;
  imageKeys: string[];
}

export interface PropertyContentSectionForRpc {
  templateKey?: string | null;
  propertyType: PropertyType;
  localizedName: LocalizedTextByLanguage;
  localizedDescription: LocalizedTextByLanguage;
  layoutType: PropertySectionLayoutType;
  displayVariant: PropertySectionDisplayVariant;
  propertyImageIds: string[];
  displayOrder?: number;
}

export function buildContentSectionsForRpc(
  sections: PropertyContentSectionFormRow[] | undefined,
  imageIdByKey: Record<string, string>
): PropertyContentSectionForRpc[] {
  if (!sections?.length) return [];
  const out: PropertyContentSectionForRpc[] = [];
  for (const [index, section] of sections.entries()) {
    const templateKey = section.templateKey?.trim() || null;
    const localizedName = pruneLocalizedText(section.localizedName);
    if (!templateKey && !hasLocalizedText(localizedName)) continue;

    const uniqueKeys = Array.from(new Set(section.imageKeys ?? []));
    const propertyImageIds: string[] = [];
    for (const key of uniqueKeys) {
      const id = imageIdByKey[key] ?? (/^[0-9a-f-]{36}$/i.test(key) ? key : '');
      if (id) propertyImageIds.push(id);
    }

    out.push({
      templateKey,
      propertyType: section.propertyType,
      localizedName: templateKey ? {} : localizedName,
      localizedDescription: templateKey ? {} : pruneLocalizedText(section.localizedDescription),
      layoutType: section.layoutType,
      displayVariant: section.displayVariant ?? 'default',
      propertyImageIds,
      displayOrder: index,
    });
  }
  return out;
}

export interface PropertyContentSectionFromDb {
  id?: string;
  templateKey?: string | null;
  propertyType?: PropertyType;
  localizedName?: LocalizedTextByLanguage;
  localizedDescription?: LocalizedTextByLanguage;
  layoutType?: PropertySectionLayoutType;
  layoutConfig?: { displayVariant?: PropertySectionDisplayVariant };
  displayOrder?: number;
  propertyImageIds?: string[];
}

export function contentSectionsFromDb(
  sections: PropertyContentSectionFromDb[],
  imageKeyById?: Record<string, string>
): PropertyContentSectionFormRow[] {
  return sections.map(s => {
    const displayVariant =
      (s.layoutConfig?.displayVariant as PropertySectionDisplayVariant | undefined) ?? 'default';
    const propertyImageIds = s.propertyImageIds ?? [];
    const imageKeys = imageKeyById
      ? propertyImageIds.map(id => imageKeyById[id] ?? id).filter((k): k is string => !!k)
      : propertyImageIds.map(id => String(id));

    return {
      templateKey: s.templateKey ?? null,
      propertyType: s.propertyType ?? 'RealEstate',
      localizedName: pruneLocalizedText(s.localizedName),
      localizedDescription: pruneLocalizedText(s.localizedDescription),
      layoutType: s.layoutType ?? 'split',
      displayVariant,
      imageKeys,
    };
  });
}

export function pickSectionName(
  section: { localizedName?: LocalizedTextByLanguage },
  preferredLocale?: string
): string | undefined {
  return pickLocalizedText(section.localizedName, preferredLocale);
}

export function pickSectionDescription(
  section: { localizedDescription?: LocalizedTextByLanguage },
  preferredLocale?: string
): string | undefined {
  return pickLocalizedText(section.localizedDescription, preferredLocale);
}

/** Legacy single-language fields → localized (Spanish default). */
export function localizedFromLegacyNameDescription(
  name?: string,
  description?: string
): { localizedName: LocalizedTextByLanguage; localizedDescription: LocalizedTextByLanguage } {
  const localizedName: LocalizedTextByLanguage = {};
  const localizedDescription: LocalizedTextByLanguage = {};
  const n = name?.trim();
  const d = description?.trim();
  if (n) localizedName.es = n;
  if (d) localizedDescription.es = d;
  return { localizedName, localizedDescription };
}
