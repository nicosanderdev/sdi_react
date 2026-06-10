import type { ListingType } from './PropertyData';
import {
  type LocalizedTextByLanguage,
  pruneLocalizedText,
  pickLocalizedText,
  LOCALIZED_LANGUAGES,
} from './localizedText';

export interface PropertyPolicyFormRow {
  listingType: ListingType;
  title: LocalizedTextByLanguage;
  description: LocalizedTextByLanguage;
}

export interface PropertyPolicyForRpc {
  listingType: ListingType;
  title: LocalizedTextByLanguage;
  description: LocalizedTextByLanguage;
  displayOrder?: number;
}

export function buildPoliciesForRpc(rows: PropertyPolicyFormRow[] | undefined): PropertyPolicyForRpc[] {
  if (!rows?.length) return [];
  return rows
    .map((row, index) => {
      const title = pruneLocalizedText(row.title);
      const description = pruneLocalizedText(row.description);
      if (Object.keys(title).length === 0 && Object.keys(description).length === 0) {
        return null;
      }
      return {
        listingType: row.listingType,
        title,
        description,
        displayOrder: index,
      };
    })
    .filter((r): r is PropertyPolicyForRpc => r !== null);
}

export interface PropertyPolicyFromDb {
  id?: string;
  listingType: ListingType;
  title?: LocalizedTextByLanguage;
  description?: LocalizedTextByLanguage;
  displayOrder?: number;
}

export function propertyPoliciesFromDb(policies: PropertyPolicyFromDb[]): PropertyPolicyFormRow[] {
  return policies.map(p => ({
    listingType: p.listingType,
    title: pruneLocalizedText(p.title),
    description: pruneLocalizedText(p.description),
  }));
}

export function pickPolicyTitle(
  policy: { title?: LocalizedTextByLanguage },
  preferredLocale?: string
): string | undefined {
  return pickLocalizedText(policy.title, preferredLocale);
}

export function pickPolicyDescription(
  policy: { description?: LocalizedTextByLanguage },
  preferredLocale?: string
): string | undefined {
  return pickLocalizedText(policy.description, preferredLocale);
}

export { LOCALIZED_LANGUAGES };
