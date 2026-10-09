import type { ListingType, PropertyType } from './PropertyData';
import {
  type LocalizedTextByLanguage,
  interpolateLocalizedText,
  pickLocalizedText,
} from './localizedText';
import type { PropertySectionDisplayVariant, PropertySectionLayoutType } from './propertyContentSections';

export type PolicySlotType = 'time' | 'integer' | 'enum';

export interface PolicyTemplateSlot {
  name: string;
  type: PolicySlotType;
  required?: boolean;
}

export interface PropertyPolicyTemplate {
  key: string;
  listingTypes: ListingType[];
  exclusionGroup?: string | null;
  localizedTitle: LocalizedTextByLanguage;
  localizedDescription: LocalizedTextByLanguage;
  slots: PolicyTemplateSlot[];
  archived: boolean;
  displayOrder: number;
}

export interface PropertySectionTemplate {
  key: string;
  propertyTypes: PropertyType[];
  localizedName: LocalizedTextByLanguage;
  defaultLayoutType: PropertySectionLayoutType;
  defaultDisplayVariant: PropertySectionDisplayVariant;
  archived: boolean;
  displayOrder: number;
}

export function parsePolicySlots(raw: unknown): PolicyTemplateSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: PolicyTemplateSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name : '';
    if (!name) continue;
    const type = rec.type === 'integer' || rec.type === 'enum' ? rec.type : 'time';
    out.push({
      name,
      type,
      required: rec.required === true,
    });
  }
  return out;
}

export function mapPolicyTemplateRow(row: Record<string, unknown>): PropertyPolicyTemplate {
  return {
    key: String(row.key ?? ''),
    listingTypes: Array.isArray(row.listing_types) ? (row.listing_types as ListingType[]) : [],
    exclusionGroup: (row.exclusion_group as string | null) ?? null,
    localizedTitle: (row.localized_title as LocalizedTextByLanguage) ?? {},
    localizedDescription: (row.localized_description as LocalizedTextByLanguage) ?? {},
    slots: parsePolicySlots(row.slots),
    archived: row.archived === true,
    displayOrder: Number(row.display_order ?? 0),
  };
}

export function mapSectionTemplateRow(row: Record<string, unknown>): PropertySectionTemplate {
  const layout = row.default_layout_type;
  const variant = row.default_display_variant;
  return {
    key: String(row.key ?? ''),
    propertyTypes: Array.isArray(row.property_types) ? (row.property_types as PropertyType[]) : [],
    localizedName: (row.localized_name as LocalizedTextByLanguage) ?? {},
    defaultLayoutType: layout === 'carousel' || layout === 'stacked' ? layout : 'split',
    defaultDisplayVariant: variant === 'compact' || variant === 'hero' ? variant : 'default',
    archived: row.archived === true,
    displayOrder: Number(row.display_order ?? 0),
  };
}

export function policyTemplateAppliesTo(
  template: PropertyPolicyTemplate,
  listingType: ListingType
): boolean {
  return template.listingTypes.includes(listingType);
}

export function sectionTemplateAppliesTo(
  template: PropertySectionTemplate,
  propertyType: PropertyType
): boolean {
  return template.propertyTypes.includes(propertyType);
}

export function resolvedPolicyTitle(
  template: PropertyPolicyTemplate | undefined,
  slots: Record<string, string> | undefined,
  fallback?: LocalizedTextByLanguage,
  locale?: string
): string | undefined {
  const source = template
    ? interpolateLocalizedText(template.localizedTitle, slots)
    : fallback;
  return pickLocalizedText(source, locale);
}

export function resolvedPolicyDescription(
  template: PropertyPolicyTemplate | undefined,
  slots: Record<string, string> | undefined,
  fallback?: LocalizedTextByLanguage,
  locale?: string
): string | undefined {
  const source = template
    ? interpolateLocalizedText(template.localizedDescription, slots)
    : fallback;
  return pickLocalizedText(source, locale);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isHhmmTime(value: string | undefined): boolean {
  return !!value && TIME_RE.test(value);
}

export function missingRequiredPolicySlots(
  template: PropertyPolicyTemplate,
  slots: Record<string, string> | undefined
): string[] {
  const values = slots ?? {};
  return template.slots
    .filter(slot => slot.required)
    .filter(slot => !String(values[slot.name] ?? '').trim())
    .map(slot => slot.name);
}
