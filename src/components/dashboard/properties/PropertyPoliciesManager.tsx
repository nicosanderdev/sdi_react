import { useEffect, useMemo } from 'react';
import { Button, Label, Select, TextInput } from 'flowbite-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';
import type { ListingType } from '../../../models/properties/PropertyData';
import { resolveCreationListingType } from '../../../models/properties/PropertyFormSchema';
import { getListingTypeLabelEs } from '../../../models/properties/propertyTypeLabels';
import { LocalizedTitleDescriptionFields } from './LocalizedTextFields';
import { usePropertyPolicyTemplates } from '../../../hooks/usePropertyContentTemplates';
import {
  isNonEmptyString,
  missingRequiredPolicySlots,
  policyTemplateAppliesTo,
  resolvedPolicyDescription,
  resolvedPolicyTitle,
  type PropertyPolicyTemplate,
} from '../../../models/properties/contentTemplates';
import { pickLocalizedText } from '../../../models/properties/localizedText';

const ALL_LISTING_TYPES: ListingType[] = ['SummerRent', 'EventVenue', 'AnnualRent', 'RealEstate'];

interface PropertyPoliciesManagerProps {
  allowedListingTypes?: ListingType[];
  canWriteCustom?: boolean;
}

export function PropertyPoliciesManager({
  allowedListingTypes,
  canWriteCustom = false,
}: PropertyPoliciesManagerProps) {
  const { control, watch, setValue, getValues } = useFormContext<PropertyFormData>();
  const { fields, append, remove, move, replace } = useFieldArray({
    control,
    name: 'propertyPolicies',
  });
  const { data: templates = [] } = usePropertyPolicyTemplates();

  const propertyType = watch('propertyType');
  const realEstateOfferMode = watch('realEstateOfferMode');
  const defaultListingType =
    resolveCreationListingType({ propertyType, realEstateOfferMode }) ??
    allowedListingTypes?.[0] ??
    'SummerRent';

  const listingOptions = allowedListingTypes?.length ? allowedListingTypes : ALL_LISTING_TYPES;
  const activeTemplates = useMemo(
    () => templates.filter(t => !t.archived && listingOptions.some(lt => policyTemplateAppliesTo(t, lt))),
    [templates, listingOptions]
  );
  const templateByKey = useMemo(
    () => new Map(templates.map(t => [t.key, t])),
    [templates]
  );

  useEffect(() => {
    const allowed = new Set(listingOptions);
    const current = getValues('propertyPolicies') ?? [];
    let changed = false;
    const next = current.filter(row => {
      if (!allowed.has(row.listingType)) {
        changed = true;
        return false;
      }
      return true;
    });

    const templateKeys = [...new Set(next.map(r => r.templateKey).filter(isNonEmptyString))];
    for (const key of templateKeys) {
      const tmpl = templateByKey.get(key);
      if (!tmpl) continue;
      const source = next.find(r => r.templateKey === key);
      for (const lt of listingOptions) {
        if (!policyTemplateAppliesTo(tmpl, lt)) continue;
        if (next.some(r => r.templateKey === key && r.listingType === lt)) continue;
        next.push({
          listingType: lt,
          templateKey: key,
          slotValues: { ...(source?.slotValues ?? {}) },
          title: {},
          description: {},
        });
        changed = true;
      }
    }

    if (changed) replace(next);
  }, [listingOptions.join('|'), templateByKey, getValues, replace]);

  const addTemplate = (template: PropertyPolicyTemplate) => {
    const current = getValues('propertyPolicies') ?? [];
    const matchingTypes = listingOptions.filter(lt => policyTemplateAppliesTo(template, lt));
    if (matchingTypes.length === 0) return;

    const withoutGroup = template.exclusionGroup
      ? current.filter(row => {
          if (!row.templateKey || !matchingTypes.includes(row.listingType)) return true;
          const other = templateByKey.get(row.templateKey);
          return other?.exclusionGroup !== template.exclusionGroup;
        })
      : current;

    const next = [...withoutGroup];
    for (const lt of matchingTypes) {
      if (next.some(r => r.templateKey === template.key && r.listingType === lt)) continue;
      next.push({
        listingType: lt,
        templateKey: template.key,
        slotValues: {},
        title: {},
        description: {},
      });
    }
    replace(next);
  };

  const addCustom = () => {
    append({
      listingType: defaultListingType,
      templateKey: null,
      slotValues: {},
      title: {},
      description: {},
    });
  };

  const setSlotForTemplate = (templateKey: string, slotName: string, value: string) => {
    const current = getValues('propertyPolicies') ?? [];
    current.forEach((row, index) => {
      if (row.templateKey !== templateKey) return;
      setValue(
        `propertyPolicies.${index}.slotValues`,
        { ...(row.slotValues ?? {}), [slotName]: value },
        { shouldDirty: true, shouldValidate: true }
      );
    });
  };

  const usedTemplateKeys = new Set(
    (watch('propertyPolicies') ?? []).map(r => r.templateKey).filter(isNonEmptyString)
  );

  return (
    <div className="p-4 md:p-6 border rounded-lg border-gray-200 dark:border-gray-700 space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Políticas de la propiedad</h3>
        <p className="text-sm text-gray-500">
          Elegí reglas habituales. El texto público está traducido; solo completás horarios cuando aplica.
        </p>
      </div>

      {activeTemplates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeTemplates.map(template => {
            const already = usedTemplateKeys.has(template.key);
            const blockedByGroup =
              !!template.exclusionGroup &&
              [...usedTemplateKeys].some(key => {
                if (key === template.key) return false;
                return templateByKey.get(key)?.exclusionGroup === template.exclusionGroup;
              });
            return (
              <Button
                key={template.key}
                type="button"
                size="xs"
                color={already ? 'light' : 'blue'}
                disabled={already}
                onClick={() => addTemplate(template)}
                title={
                  blockedByGroup
                    ? 'Quitá la política de mascotas opuesta para poder agregar esta.'
                    : undefined
                }
              >
                {pickLocalizedText(template.localizedTitle, 'es')}
              </Button>
            );
          })}
        </div>
      )}

      {canWriteCustom && (
        <Button type="button" color="light" onClick={addCustom}>
          Agregar política personalizada
        </Button>
      )}

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
          Opcional: agregá políticas como silencio, mascotas o normas de la casa.
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const policy = watch(`propertyPolicies.${index}`);
          const template = policy?.templateKey ? templateByKey.get(policy.templateKey) : undefined;
          const isCustom = !policy?.templateKey;
          const canEditCustom = isCustom && canWriteCustom;
          const missingSlots = template ? missingRequiredPolicySlots(template, policy?.slotValues) : [];
          const title =
            resolvedPolicyTitle(template, policy?.slotValues, policy?.title, 'es') ??
            `Política ${index + 1}`;
          const description = resolvedPolicyDescription(
            template,
            policy?.slotValues,
            policy?.description,
            'es'
          );

          return (
            <div
              key={field.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 border-dashed p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="font-medium">{title}</h4>
                <div className="flex items-center gap-2">
                  <Button
                    size="xs"
                    color="light"
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronUp size={14} />
                  </Button>
                  <Button
                    size="xs"
                    color="light"
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronDown size={14} />
                  </Button>
                  <Button size="xs" color="failure" type="button" onClick={() => remove(index)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Tipo de publicación: {getListingTypeLabelEs(policy?.listingType ?? defaultListingType)}
              </p>

              {template && template.slots.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {template.slots.map(slot => (
                    <div key={slot.name}>
                      <Label htmlFor={`policy-${index}-${slot.name}`}>
                        {slotLabel(slot.name)}
                        {slot.required ? ' *' : ''}
                      </Label>
                      <TextInput
                        id={`policy-${index}-${slot.name}`}
                        type={slot.type === 'time' ? 'time' : 'text'}
                        className="mt-1"
                        value={policy?.slotValues?.[slot.name] ?? ''}
                        onChange={e => setSlotForTemplate(template.key, slot.name, e.target.value)}
                      />
                    </div>
                  ))}
                  {missingSlots.length > 0 && (
                    <p className="sm:col-span-2 text-sm text-red-600">Completá los horarios requeridos.</p>
                  )}
                </div>
              )}

              {template && description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{description}</p>
              )}

              {isCustom && !canEditCustom && (
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {pickLocalizedText(policy?.title, 'es')}
                  {pickLocalizedText(policy?.description, 'es')
                    ? `\n${pickLocalizedText(policy?.description, 'es')}`
                    : ''}
                </p>
              )}

              {canEditCustom && (
                <>
                  <div className="max-w-xs">
                    <Label htmlFor={`propertyPolicies.${index}.listingType`}>Tipo de publicación</Label>
                    <Select
                      id={`propertyPolicies.${index}.listingType`}
                      className="mt-2"
                      value={policy?.listingType ?? defaultListingType}
                      onChange={e =>
                        setValue(`propertyPolicies.${index}.listingType`, e.target.value as ListingType, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      {listingOptions.map(lt => (
                        <option key={lt} value={lt}>
                          {getListingTypeLabelEs(lt)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <LocalizedTitleDescriptionFields
                    idPrefix={`policy-${index}`}
                    title={policy?.title ?? {}}
                    description={policy?.description ?? {}}
                    onTitleChange={next =>
                      setValue(`propertyPolicies.${index}.title`, next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    onDescriptionChange={next =>
                      setValue(`propertyPolicies.${index}.description`, next, {
                        shouldDirty: true,
                      })
                    }
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function slotLabel(name: string): string {
  if (name === 'from') return 'Desde';
  if (name === 'to') return 'Hasta';
  if (name === 'checkInTime') return 'Check-in';
  if (name === 'checkOutTime') return 'Check-out';
  return name;
}
