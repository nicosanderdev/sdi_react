import { useCallback, useEffect } from 'react';
import { Button, Label, Select, TextInput, Textarea } from 'flowbite-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { DisplayImage } from './ImageManager';
import type { PropertyFormData, PropertyContentSectionFormData } from '../../../models/properties/PropertyFormSchema';
import type { PropertyType } from '../../../models/properties';
import { getPropertyTypeLabelEs } from '../../../models/properties/propertyTypeLabels';

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

const SECTION_TEMPLATES: Partial<Record<PropertyType, Array<{ name: string; description: string }>>> = {
  SummerRent: [
    {
      name: 'Espacios exteriores',
      description: 'Describe patio, jardín, parrillero, piscina u otras zonas al aire libre.',
    },
    {
      name: 'Distribución de la vivienda',
      description: 'Resume cómo se distribuyen los ambientes y la circulación de la casa.',
    },
  ],
  EventVenue: [
    {
      name: 'Decoración',
      description: 'Cuenta el estilo de ambientación y opciones de decoración disponibles.',
    },
    {
      name: 'Catering / comida',
      description: 'Explica menús, opciones gastronómicas y modalidades de servicio.',
    },
    {
      name: 'DJ',
      description: 'Indica equipamiento, cabina, horarios y servicios de música para eventos.',
    },
  ],
};

interface PropertyContentSectionsManagerProps {
  displayImages: DisplayImage[];
}

export function PropertyContentSectionsManager({ displayImages }: PropertyContentSectionsManagerProps) {
  const { control, register, watch, setValue, getValues } = useFormContext<PropertyFormData>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'contentSections',
  });

  const rootPropertyType = (watch('propertyType') ?? 'RealEstate') as PropertyType;
  const sectionValues = watch('contentSections') ?? [];

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
    const n = fields.length;
    for (let i = 0; i < n; i += 1) {
      setValue(`contentSections.${i}.propertyType`, rootPropertyType, {
        shouldDirty: false,
        shouldValidate: true,
      });
      enforceLayoutConstraints(i, rootPropertyType);
    }
  }, [rootPropertyType, fields.length, setValue, enforceLayoutConstraints]);

  const handleAddSection = () => {
    append(createSectionDraft());
  };

  const createSectionDraft = (overrides?: Partial<Pick<PropertyContentSectionFormData, 'name' | 'description'>>) => {
    const defaultLayoutType = LAYOUT_OPTIONS_BY_PROPERTY_TYPE[rootPropertyType][0] ?? 'split';
    const defaultVariant = DISPLAY_VARIANT_OPTIONS_BY_LAYOUT[defaultLayoutType][0] ?? 'default';

    return {
      name: overrides?.name ?? '',
      description: overrides?.description ?? '',
      propertyType: rootPropertyType,
      layoutType: defaultLayoutType,
      displayVariant: defaultVariant,
      imageKeys: [],
    };
  };

  const handleAddTemplateSection = (template: { name: string; description: string }) => {
    append(createSectionDraft(template));
  };

  const toggleSectionImage = (sectionIndex: number, imageKey: string) => {
    const keys = (getValues(`contentSections.${sectionIndex}.imageKeys`) ?? []) as string[];
    const next = keys.includes(imageKey) ? keys.filter(k => k !== imageKey) : [...keys, imageKey];
    setValue(`contentSections.${sectionIndex}.imageKeys`, next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className="p-4 md:p-6 border rounded-lg border-gray-200 dark:border-gray-700 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Secciones de contenido</h3>
          <p className="text-sm text-gray-500">
            Configura secciones dinámicas para la página de detalle de la propiedad.
          </p>
        </div>
        <Button type="button" onClick={handleAddSection}>
          <Plus size={16} className="mr-2" />
          Agregar sección
        </Button>
      </div>

      {SECTION_TEMPLATES[rootPropertyType] && (
        <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Plantillas sugeridas (opcional)
          </p>
          <div className="flex flex-wrap gap-2">
            {SECTION_TEMPLATES[rootPropertyType]!.map(template => (
              <Button
                key={template.name}
                type="button"
                size="xs"
                color="light"
                onClick={() => handleAddTemplateSection(template)}
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {fields.length === 0 && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
          Aún no agregaste secciones. Usa "Agregar sección" para comenzar.
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const section = sectionValues[index];
          const propertyType = rootPropertyType;
          const layoutOptions = LAYOUT_OPTIONS_BY_PROPERTY_TYPE[propertyType];
          const currentLayout = (section?.layoutType ?? layoutOptions[0] ?? 'split') as LayoutType;
          const variantOptions = DISPLAY_VARIANT_OPTIONS_BY_LAYOUT[currentLayout];
          const imageKeys = (section?.imageKeys ?? []) as string[];

          return (
            <div
              key={field.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 border-dashed p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Sección {index + 1}</h4>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`contentSections.${index}.name`}>Nombre</Label>
                  <TextInput
                    id={`contentSections.${index}.name`}
                    placeholder="Ej: Sala principal"
                    className="mt-2"
                    {...register(`contentSections.${index}.name`)}
                  />
                </div>
                <div>
                  <Label>Tipo de propiedad</Label>
                  <TextInput
                    value={getPropertyTypeLabelEs(rootPropertyType)}
                    disabled
                    readOnly
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={`contentSections.${index}.description`}>Descripción</Label>
                <Textarea
                  id={`contentSections.${index}.description`}
                  rows={2}
                  placeholder="Describe brevemente esta sección."
                  className="mt-2"
                  {...register(`contentSections.${index}.description`)}
                />
              </div>

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
                    Sube imágenes en el paso anterior (medios) para poder asignarlas a esta sección.
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
                            src={image.previewUrl}
                            alt={image.alt || ''}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
                {displayImages.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">Toca una miniatura para incluirla o quitarla de la sección.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
