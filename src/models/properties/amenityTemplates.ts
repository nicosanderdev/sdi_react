import type { PropertyType } from './PropertyData';
import type { LocalizedTextByLanguage } from './localizedText';
import { pickLocalizedText } from './localizedText';
import type { PolicyTemplateSlot } from './contentTemplates';
import { parsePolicySlots } from './contentTemplates';

export interface AmenityTemplate {
  key: string;
  localizedName: LocalizedTextByLanguage;
  localizedDescription: LocalizedTextByLanguage;
  iconId?: string;
  propertyTypes: PropertyType[];
  slots: PolicyTemplateSlot[];
  archived: boolean;
  displayOrder: number;
}

export function mapAmenityTemplateRow(row: Record<string, unknown>): AmenityTemplate {
  const propertyTypes = (row.PropertyTypes ?? row.property_types ?? row.propertyTypes) as unknown;
  return {
    key: String(row.Key ?? row.key ?? ''),
    localizedName: (row.LocalizedName ?? row.localized_name ?? row.localizedName ?? {}) as LocalizedTextByLanguage,
    localizedDescription: (row.LocalizedDescription ??
      row.localized_description ??
      row.localizedDescription ??
      {}) as LocalizedTextByLanguage,
    iconId: (row.IconId ?? row.icon_id ?? row.iconId) as string | undefined,
    propertyTypes: Array.isArray(propertyTypes) ? (propertyTypes as PropertyType[]) : [],
    slots: parsePolicySlots(row.Slots ?? row.slots),
    archived: row.Archived === true || row.archived === true,
    displayOrder: Number(row.DisplayOrder ?? row.display_order ?? row.displayOrder ?? 0),
  };
}

export function amenityTemplateAppliesTo(template: AmenityTemplate, propertyType: PropertyType): boolean {
  return template.propertyTypes.includes(propertyType);
}

export function amenityTemplateName(template: AmenityTemplate, locale = 'es'): string {
  return pickLocalizedText(template.localizedName, locale) ?? template.key;
}

export function amenityTemplateDescription(
  template: AmenityTemplate,
  locale = 'es'
): string | undefined {
  return pickLocalizedText(template.localizedDescription, locale);
}

export function groupAmenityTemplatesForPicker(
  templates: AmenityTemplate[],
  activeTypes: PropertyType[]
): {
  shared: AmenityTemplate[];
  byType: { type: PropertyType; templates: AmenityTemplate[] }[];
} {
  const active = new Set(activeTypes);
  const applicable = templates
    .filter(t => !t.archived && t.propertyTypes.some(pt => active.has(pt)))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.key.localeCompare(b.key));

  const intersectionCount = (t: AmenityTemplate) => t.propertyTypes.filter(pt => active.has(pt)).length;
  const shared = applicable.filter(t => intersectionCount(t) > 1);
  const byType = activeTypes.map(type => ({
    type,
    templates: applicable.filter(t => t.propertyTypes.includes(type) && intersectionCount(t) === 1),
  }));

  return { shared, byType };
}
