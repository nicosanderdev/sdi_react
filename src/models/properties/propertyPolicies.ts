import type { ListingType } from './PropertyData';
import {
  type LocalizedTextByLanguage,
  pruneLocalizedText,
  pickLocalizedText,
} from './localizedText';

export interface PropertyPolicyFormRow {
  listingType: ListingType;
  templateKey?: string | null;
  slotValues?: Record<string, string>;
  title: LocalizedTextByLanguage;
  description: LocalizedTextByLanguage;
}

export interface PropertyPolicyForRpc {
  listingType: ListingType;
  templateKey?: string | null;
  slotValues?: Record<string, string>;
  title: LocalizedTextByLanguage;
  description: LocalizedTextByLanguage;
  displayOrder?: number;
}

export function buildPoliciesForRpc(rows: PropertyPolicyFormRow[] | undefined): PropertyPolicyForRpc[] {
  if (!rows?.length) return [];
  const out: PropertyPolicyForRpc[] = [];
  for (const [index, row] of rows.entries()) {
    const templateKey = row.templateKey?.trim() || null;
    if (templateKey) {
      out.push({
        listingType: row.listingType,
        templateKey,
        slotValues: row.slotValues ?? {},
        title: {},
        description: {},
        displayOrder: index,
      });
      continue;
    }
    const title = pruneLocalizedText(row.title);
    const description = pruneLocalizedText(row.description);
    if (Object.keys(title).length === 0 && Object.keys(description).length === 0) {
      continue;
    }
    out.push({
      listingType: row.listingType,
      templateKey: null,
      slotValues: {},
      title,
      description,
      displayOrder: index,
    });
  }
  return out;
}

export interface PropertyPolicyFromDb {
  id?: string;
  listingType: ListingType;
  templateKey?: string | null;
  slotValues?: Record<string, string>;
  title?: LocalizedTextByLanguage;
  description?: LocalizedTextByLanguage;
  displayOrder?: number;
}

export function propertyPoliciesFromDb(policies: PropertyPolicyFromDb[]): PropertyPolicyFormRow[] {
  return policies.map(p => ({
    listingType: p.listingType,
    templateKey: p.templateKey ?? null,
    slotValues: p.slotValues ?? {},
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
