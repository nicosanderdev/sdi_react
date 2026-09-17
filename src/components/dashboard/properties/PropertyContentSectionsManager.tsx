import { useCallback, useEffect, useMemo } from 'react';
import { Button, Label, Select } from 'flowbite-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { DisplayImage } from './ImageManager';
import type { PropertyFormData, PropertyContentSectionFormData } from '../../../models/properties/PropertyFormSchema';
import type { PropertyType } from '../../../models/properties';
import { getPropertyTypeLabelEs } from '../../../models/properties/propertyTypeLabels';
import { LocalizedTitleDescriptionFields } from './LocalizedTextFields';
import { resolveAssetUrl } from '../../../utils/resolveAssetUrl';
import { usePropertySectionTemplates } from '../../../hooks/usePropertyContentTemplates';
import {
  isNonEmptyString,
  sectionTemplateAppliesTo,
  type PropertySectionTemplate,
} from '../../../models/properties/contentTemplates';
import { pickLocalizedText } from '../../../models/properties/localizedText';

type LayoutType = PropertyContentSectionFormData['layoutType'];
type DisplayVariant = PropertyContentSectionFormData['displayVariant'];

const LAYOUT_OPTIONS_BY_PROPERTY_TYPE: Record<PropertyType, LayoutType[]> = {
  RealEstate: ['split', 'stacked'],
  SummerRent: ['carousel', 'split', 'stacked'],
  EventVenue: ['carousel', 'split'],
};

const DISPLAY_VARIANT_OPTIONS_BY_LAYOUT: Record<LayoutType, DisplayVariant[]> = {
  split: ['default', 'compact'],
  carousel: ['default', 'hero'],
  stacked: ['default', 'compact'],
};

const LAYOUT_LABEL_ES: Record<LayoutType, string> = {
  split: 'Dividido',
  carousel: 'Carrusel',
  stacked: 'Apilado',
};

const DISPLAY_LABEL_ES: Record<DisplayVariant, string> = {
  default: 'Predeterminado',
  compact: 'Compacto',
  hero: 'Destacado',
};

interface PropertyContentSectionsManagerProps {
  displayImages: DisplayImage[];
  allowedPropertyTypes?: PropertyType[];
  canWriteCustom?: boolean;
}

export function PropertyContentSectionsManager({
  displayImages,
  allowedPropertyTypes,
  canWriteCustom = false,
}: PropertyContentSectionsManagerProps) {
  const { control, register, watch, setValue, getValues } = useFormContext<PropertyFormData>();
  const { fields, append, remove, move, replace } = useFieldArray({
    control,
    name: 'contentSections',
  });
  const { data: templates = [] } = usePropertySectionTemplates();

  const rootPropertyType = (watch('propertyType') ?? 'RealEstate') as PropertyType;
  const additionalExtensionType = watch('additionalExtensionType');
  const sectionValues = watch('contentSections') ?? [];

  const typeOptions = useMemo(() => {
    const set = new Set<PropertyType>(allowedPropertyTypes?.length ? allowedPropertyTypes : [rootPropertyType]);
    if (additionalExtensionType) set.add(additionalExtensionType);
    return Array.from(set);
  }, [allowedPropertyTypes, rootPropertyType, additionalExtensionType]);

  const templateByKey = useMemo(() => new Map(templates.map(t => [t.key, t])), [templates]);
  const activeTemplates = useMemo(
    () => templates.filter(t => !t.archived && typeOptions.some(pt => sectionTemplateAppliesTo(t, pt))),
    [templates, typeOptions]
  );

  const enforceLayoutConstraints = useCallback(
    (index: number, propertyType: PropertyType, nextLayout?: LayoutType) => {
      const validLayouts = LAYOUT_OPTIONS_BY_PROPERTY_TYPE[propertyType];
      const row = getValues(`contentSections.${index}`);
      const currentLayout =
        nextLayout ?? (row?.layoutType as LayoutType | undefined) ?? validLayouts[0] ?? 'split';
      const layout = validLayouts.includes(currentLayout) ? currentLayout : validLayouts[0];
      setValue(`contentSections.${index}.layoutType`, layout, { shouldDirty: true, shouldValidate: true });

      const validVariants = DISPLAY_VARIANT_OPTIONS_BY_LAYOUT[layout];
      const currentVariant = row?.displayVariant as DisplayVariant | undefined;
      if (!currentVariant || !validVariants.includes(currentVariant)) {
        setValue(`contentSections.${index}.displayVariant`, validVariants[0], {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
    [getValues, setValue]
  );

  useEffect(() => {
    const allowed = new Set(typeOptions);
    const current = getValues('contentSections') ?? [];
    let changed = false;
    const next = current.filter(row => {
      if (row.propertyType && !allowed.has(row.propertyType)) {
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
      for (const pt of typeOptions) {
        if (!sectionTemplateAppliesTo(tmpl, pt)) continue;
        if (next.some(r => r.templateKey === key && r.propertyType === pt)) continue;
        const defaultLayout = clampLayout(pt, tmpl.defaultLayoutType);
        next.push({
          templateKey: key,
          propertyType: pt,
          localizedName: {},
          localizedDescription: {},
          layoutType: defaultLayout,
          displayVariant: clampVariant(defaultLayout, tmpl.defaultDisplayVariant),
          imageKeys: [...(source?.imageKeys ?? [])],
        });
        changed = true;
      }
    }

    if (changed) replace(next);
  }, [typeOptions.join('|'), templateByKey, getValues, replace]);

  const addTemplate = (template: PropertySectionTemplate) => {
    const matchingTypes = typeOptions.filter(pt => sectionTemplateAppliesTo(template, pt));
    const current = getValues('contentSections') ?? [];
    const next = [...current];
    for (const pt of matchingTypes) {
      if (next.some(r => r.templateKey === template.key && r.propertyType === pt)) continue;
      const defaultLayout = clampLayout(pt, template.defaultLayoutType);
      next.push({
        templateKey: template.key,
        propertyType: pt,
        localizedName: {},
        localizedDescription: {},
        layoutType: defaultLayout,
        displayVariant: clampVariant(defaultLayout, template.defaultDisplayVariant),
        imageKeys: [],
      });
    }
    replace(next);
  };

  const addCustom = () => {
    const pt = typeOptions[0] ?? rootPropertyType;
    const defaultLayoutType = LAYOUT_OPTIONS_BY_PROPERTY_TYPE[pt][0] ?? 'split';
    append({
      templateKey: null,
      localizedName: {},
      localizedDescription: {},
      propertyType: pt,
      layoutType: defaultLayoutType,
      displayVariant: DISPLAY_VARIANT_OPTIONS_BY_LAYOUT[defaultLayoutType][0] ?? 'default',
      imageKeys: [],
    });
  };

  const toggleSectionImage = (sectionIndex: number, imageKey: string) => {
    const keys = (getValues(`contentSections.${sectionIndex}.imageKeys`) ?? []) as string[];
    const next = keys.includes(imageKey) ? keys.filter(k => k !== imageKey) : [...keys, imageKey];
    setValue(`contentSections.${sectionIndex}.imageKeys`, next, { shouldDirty: true, shouldValidate: true });
  };

  const usedTemplateKeys = new Set(sectionValues.map(s => s.templateKey).filter(isNonEmptyString));

  return (
    <div className="p-4 md:p-6 border rounded-lg border-gray-200 dark:border-gray-700 space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Secciones de contenido</h3>
        <p className="text-sm text-gray-500">
          Elegí bloques con título traducido y asignales fotos de la propiedad.
        </p>
      </div>

      {activeTemplates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeTemplates.map(template => {
            const already = usedTemplateKeys.has(template.key);
            return (
              <Button
                key={template.key}
                type="button"
                size="xs"
                color={already ? 'light' : 'blue'}
                disabled={already}
                onClick={() => addTemplate(template)}
              >
                {pickLocalizedText(template.localizedName, 'es')}
              </Button>
            );
          })}
        </div>
      )}

      {canWriteCustom && (
        <Button type="button" color="light" onClick={addCustom}>
          Agregar sección personalizada
        </Button>
      )}

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
          Opcional: agregá galerías como exteriores, distribución o decoración.
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const section = sectionValues[index];
          const propertyType = (section?.propertyType ?? rootPropertyType) as PropertyType;
          const template = section?.templateKey ? templateByKey.get(section.templateKey) : undefined;
          const isCustom = !section?.templateKey;
          const canEditCustom = isCustom && canWriteCustom;
          const layoutOptions = LAYOUT_OPTIONS_BY_PROPERTY_TYPE[propertyType];
          const variantOptions = DISPLAY_VARIANT_OPTIONS_BY_LAYOUT[(section?.layoutType as LayoutType) ?? layoutOptions[0]];
          const imageKeys = section?.imageKeys ?? [];
          const title =
            pickLocalizedText(template?.localizedName, 'es') ??
            pickLocalizedText(section?.localizedName, 'es') ??
            `Sección ${index + 1}`;

          return (
            <div
              key={field.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 border-dashed p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
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

              <p className="text-xs text-gray-500">{getPropertyTypeLabelEs(propertyType)}</p>

              {canEditCustom && (
                <>
                  {typeOptions.length > 1 && (
                    <div className="max-w-xs">
                      <Label htmlFor={`contentSections.${index}.propertyType`}>Tipo de propiedad</Label>
                      <Select
                        id={`contentSections.${index}.propertyType`}
                        className="mt-2"
                        value={propertyType}
                        onChange={e => {
                          const nextType = e.target.value as PropertyType;
                          setValue(`contentSections.${index}.propertyType`, nextType, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          enforceLayoutConstraints(index, nextType);
                        }}
                      >
                        {typeOptions.map(pt => (
                          <option key={pt} value={pt}>
                            {getPropertyTypeLabelEs(pt)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <LocalizedTitleDescriptionFields
                    idPrefix={`section-${index}`}
                    title={section?.localizedName ?? {}}
                    description={section?.localizedDescription ?? {}}
                    titleMaxLength={120}
                    descriptionMaxLength={500}
                    onTitleChange={next =>
                      setValue(`contentSections.${index}.localizedName`, next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    onDescriptionChange={next =>
                      setValue(`contentSections.${index}.localizedDescription`, next, {
                        shouldDirty: true,
                      })
                    }
                  />
                </>
              )}

              {isCustom && !canEditCustom && (
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {pickLocalizedText(section?.localizedName, 'es')}
                  {pickLocalizedText(section?.localizedDescription, 'es')
                    ? `\n${pickLocalizedText(section?.localizedDescription, 'es')}`
                    : ''}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`contentSections.${index}.layoutType`}>Disposición</Label>
                  <Select
                    id={`contentSections.${index}.layoutType`}
                    className="mt-2"
                    {...register(`contentSections.${index}.layoutType`, {
                      onChange: e =>
                        enforceLayoutConstraints(index, propertyType, e.target.value as LayoutType),
                    })}
                  >
                    {layoutOptions.map(layout => (
                      <option key={layout} value={layout}>
                        {LAYOUT_LABEL_ES[layout]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`contentSections.${index}.displayVariant`}>Diseño</Label>
                  <Select
                    id={`contentSections.${index}.displayVariant`}
                    className="mt-2"
                    {...register(`contentSections.${index}.displayVariant`)}
                  >
                    {variantOptions.map(variant => (
                      <option key={variant} value={variant}>
                        {DISPLAY_LABEL_ES[variant]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label>Imágenes de la sección</Label>
                {displayImages.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Subí imágenes en el paso anterior (medios) para poder asignarlas a esta sección.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {displayImages.map(image => {
                      const selected = imageKeys.includes(image.key);
                      return (
                        <button
                          key={image.key}
                          type="button"
                          onClick={() => toggleSectionImage(index, image.key)}
                          className={`relative h-16 w-16 overflow-hidden rounded-md border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                            selected
                              ? 'border-primary-500 ring-2 ring-primary-300 dark:ring-primary-600'
                              : 'border-gray-200 opacity-80 hover:opacity-100 dark:border-gray-600'
                          }`}
                          title={image.alt || image.key}
                        >
                          <img
                            src={resolveAssetUrl(image.previewUrl)}
                            alt={image.alt || ''}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
                {section?.templateKey && imageKeys.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">Elegí al menos una imagen.</p>
                )}
                {displayImages.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Tocá una miniatura para incluirla o quitarla de la sección.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function clampLayout(propertyType: PropertyType, layout: LayoutType): LayoutType {
  const valid = LAYOUT_OPTIONS_BY_PROPERTY_TYPE[propertyType];
  return valid.includes(layout) ? layout : valid[0];
}

function clampVariant(layout: LayoutType, variant: DisplayVariant): DisplayVariant {
  const valid = DISPLAY_VARIANT_OPTIONS_BY_LAYOUT[layout];
  return valid.includes(variant) ? variant : valid[0];
}
