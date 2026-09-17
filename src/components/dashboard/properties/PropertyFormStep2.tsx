import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { PropertyFormData } from '../../../models/properties/PropertyFormSchema';
import {
  distinctAmenityPropertyTypesForListings,
  getPropertyTypeLabelEs,
  getPropertyTypeShortLabelEs,
} from '../../../models/properties/propertyTypeLabels';
import type { ListingType, PropertyType } from '../../../models/properties/PropertyData';
import { Button, Label, Select, TextInput, Checkbox } from 'flowbite-react';
import { RealEstateExtensionForm } from './RealEstateExtensionForm';
import { SummerRentExtensionForm } from './SummerRentExtensionForm';
import { EventVenueExtensionForm } from './EventVenueExtensionForm';
import { AmenityDescriptionsSection } from './AmenityDescriptionsSection';
import { useAmenityTemplates } from '../../../hooks/usePropertyContentTemplates';
import {
  amenityTemplateAppliesTo,
  amenityTemplateName,
  groupAmenityTemplatesForPicker,
} from '../../../models/properties/amenityTemplates';

const ALL_EXTENSION_KINDS: PropertyType[] = ['RealEstate', 'SummerRent', 'EventVenue'];

function fallbackListingTypes(base?: PropertyType): ListingType[] {
  if (base === 'SummerRent') return ['SummerRent'];
  if (base === 'EventVenue') return ['EventVenue'];
  return ['RealEstate'];
}

interface PropertyFormStep2Props {
  onNext: () => void;
  onBack: () => void;
  editMode?: boolean;
  basePropertyType?: PropertyType;
  /** Distinct listing types from API (non-deleted listings). */
  activeListingTypes?: ListingType[];
  canWriteCustom?: boolean;
}

export function PropertyFormStep2({
  onNext,
  onBack,
  editMode = false,
  basePropertyType,
  activeListingTypes = [],
  canWriteCustom = false,
}: PropertyFormStep2Props) {
  const { register, formState: { errors }, watch, trigger, setValue, getValues } = useFormContext<PropertyFormData>();
  const selectedAmenities = watch('amenities') || [];
  const amenityDescriptions = watch('amenityDescriptions');
  const propertyType = watch('propertyType');
  const additionalExtensionType = watch('additionalExtensionType');
  const { data: amenityTemplates = [], isFetching: isLoadingAmenities } = useAmenityTemplates();

  const listingTypesForAmenities = useMemo((): ListingType[] => {
    if (editMode) {
      if (activeListingTypes.length) return activeListingTypes;
      return fallbackListingTypes(basePropertyType);
    }
    if (!propertyType) return [];
    if (propertyType === 'SummerRent') return ['SummerRent'];
    if (propertyType === 'EventVenue') return ['EventVenue'];
    return ['RealEstate'];
  }, [editMode, activeListingTypes, basePropertyType, propertyType]);

  const amenityPropertyTypes = useMemo(() => {
    const types = distinctAmenityPropertyTypesForListings(listingTypesForAmenities);
    if (additionalExtensionType && !types.includes(additionalExtensionType)) {
      return [...types, additionalExtensionType];
    }
    return types;
  }, [listingTypesForAmenities, additionalExtensionType]);

  const groupedAmenities = useMemo(
    () => groupAmenityTemplatesForPicker(amenityTemplates, amenityPropertyTypes),
    [amenityTemplates, amenityPropertyTypes]
  );

  const templatesByKey = useMemo(
    () => new Map(amenityTemplates.map(t => [t.key, t])),
    [amenityTemplates]
  );

  useEffect(() => {
    if (!amenityTemplates.length) return;
    const allowed = new Set(
      amenityTemplates
        .filter(t => !t.archived && amenityPropertyTypes.some(pt => amenityTemplateAppliesTo(t, pt)))
        .map(t => t.key)
    );
    const current = getValues('amenities') ?? [];
    const next = current.filter(key => allowed.has(key));
    if (next.length !== current.length) {
      setValue('amenities', next, { shouldDirty: true });
    }
    const descriptions = getValues('amenityDescriptions');
    if (descriptions) {
      const pruned = { ...descriptions };
      let changed = false;
      for (const key of Object.keys(pruned)) {
        if (!next.includes(key)) {
          delete pruned[key];
          changed = true;
        }
      }
      if (changed) {
        setValue('amenityDescriptions', Object.keys(pruned).length > 0 ? pruned : undefined, {
          shouldDirty: true,
        });
      }
    }
  }, [amenityTemplates, amenityPropertyTypes, getValues, setValue]);

  const handleAmenityChange = (amenityKey: string, isChecked: boolean) => {
    if (isChecked) {
      setValue('amenities', Array.from(new Set([...selectedAmenities, amenityKey])));
    } else {
      setValue('amenities', selectedAmenities.filter(id => id !== amenityKey));
      if (amenityDescriptions?.[amenityKey]) {
        const next = { ...amenityDescriptions };
        delete next[amenityKey];
        setValue(
          'amenityDescriptions',
          Object.keys(next).length > 0 ? next : undefined,
          { shouldDirty: true }
        );
      }
    }
  };

  const extensionKindsOrdered = useMemo(
    () => distinctAmenityPropertyTypesForListings(listingTypesForAmenities),
    [listingTypesForAmenities]
  );

  const missingExtensionKinds = useMemo(
    () => ALL_EXTENSION_KINDS.filter(k => !extensionKindsOrdered.includes(k)),
    [extensionKindsOrdered]
  );

  type ExtensionPanel = PropertyType | 'add';
  const [extensionPanel, setExtensionPanel] = useState<ExtensionPanel>(
    () => extensionKindsOrdered[0] ?? 'add'
  );

  useEffect(() => {
    if (!editMode) return;
    if (extensionPanel === 'add') return;
    if (extensionKindsOrdered.includes(extensionPanel)) return;
    setExtensionPanel(extensionKindsOrdered[0] ?? 'add');
  }, [editMode, extensionKindsOrdered, extensionPanel]);

  useEffect(() => {
    if (!editMode || extensionPanel === 'add') return;
    setValue('additionalExtensionType', undefined);
  }, [editMode, extensionPanel, setValue]);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseFieldsToValidate: (keyof PropertyFormData)[] = [
      'areaValue',
      'areaUnit',
      'bedrooms',
      'bathrooms',
      'garageSpaces',
    ];

    const isValid = await trigger(baseFieldsToValidate);
    if (isValid) {
      onNext();
    }
  };

  const renderExtensionForm = (kind: PropertyType) => {
    if (kind === 'RealEstate') return <RealEstateExtensionForm />;
    if (kind === 'SummerRent') return <SummerRentExtensionForm />;
    return <EventVenueExtensionForm />;
  };

  return (
    <form onSubmit={handleNext} className="max-w-2xl mx-auto" id="onboarding-form-details">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Información Principal</h3>
          <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 block">
              <Label htmlFor="areaValue">
                Área Total*
              </Label>
            </div>
            <TextInput
              id="areaValue"
              type="number"
              min="1"
              {...register('areaValue')}
            />
            {errors.areaValue && <p className="text-red-500 text-sm mt-1">{errors.areaValue.message}</p>}
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="areaUnit">
                Unidad de Área*
              </Label>
            </div>
            <Select
              id="areaUnit"
              {...register('areaUnit')}
            >
              <option value="">Seleccione</option>
              <option value="m²">m²</option>
              <option value="ft²">ft²</option>
              <option value="acres">acres</option>
              <option value="hectares">hectáreas</option>
            </Select>
            {errors.areaUnit && <p className="text-red-500 text-sm mt-1">{errors.areaUnit.message}</p>}
          </div>
        </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold mb-2">Detalles y Características</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="mb-2 block">
                <Label htmlFor="bedrooms">
                  Dormitorios*
                </Label>
              </div>
              <TextInput id="bedrooms" type="number" min="0" {...register('bedrooms')} />
              {errors.bedrooms && <p className="text-red-500 text-sm mt-1">{errors.bedrooms.message}</p>}
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="bathrooms">
                  Baños*
                </Label>
              </div>
              <TextInput id="bathrooms" type="number" min="0" step="0.5" {...register('bathrooms')} />
              {errors.bathrooms && <p className="text-red-500 text-sm mt-1">{errors.bathrooms.message}</p>}
            </div>
            <div>
              <div className="mb-2 block">
                <Label htmlFor="garageSpaces">
                  Garaje (cocheras)
                </Label>
              </div>
              <TextInput
                id="garageSpaces"
                type="number"
                min="0"
                step="1"
                {...register('garageSpaces')}
              />
              {errors.garageSpaces && <p className="text-red-500 text-sm mt-1">{errors.garageSpaces.message}</p>}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-lg font-semibold">Servicios</h3>
            {!editMode && propertyType && (
              <span className="text-xs text-gray-500">
                Para tipo de propiedad:{' '}
                <span className="font-medium">{getPropertyTypeLabelEs(propertyType)}</span>
              </span>
            )}
          </div>
          {amenityPropertyTypes.length === 0 && (
            <div className="text-center py-4">
              <div className="text-gray-500">
                {!editMode
                  ? 'Selecciona un tipo de propiedad en el Paso 1 para ver los servicios disponibles.'
                  : 'No hay tipos de publicación para cargar servicios.'}
              </div>
            </div>
          )}
          {amenityPropertyTypes.length > 0 && isLoadingAmenities && (
            <div className="text-center py-4">
              <div className="text-gray-500">Cargando servicios...</div>
            </div>
          )}
          {amenityPropertyTypes.length > 0 && !isLoadingAmenities && (
            <>
              {groupedAmenities.shared.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">Servicios compartidos</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {groupedAmenities.shared.map(template => (
                      <div key={template.key} className="flex items-center">
                        <Checkbox
                          id={`amenity-${template.key}`}
                          checked={selectedAmenities.includes(template.key)}
                          onChange={e => handleAmenityChange(template.key, e.target.checked)}
                        />
                        <Label htmlFor={`amenity-${template.key}`} className="ml-2">
                          {amenityTemplateName(template)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {groupedAmenities.byType.map(({ type, templates }) => {
                if (!templates.length) return null;
                return (
                  <div key={type} className="mb-6 last:mb-0">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">
                      Servicios — {getPropertyTypeShortLabelEs(type)}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {templates.map(template => (
                        <div key={template.key} className="flex items-center">
                          <Checkbox
                            id={`amenity-${type}-${template.key}`}
                            checked={selectedAmenities.includes(template.key)}
                            onChange={e => handleAmenityChange(template.key, e.target.checked)}
                          />
                          <Label htmlFor={`amenity-${type}-${template.key}`} className="ml-2">
                            {amenityTemplateName(template)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {groupedAmenities.shared.length === 0 &&
                groupedAmenities.byType.every(g => g.templates.length === 0) && (
                  <div className="text-center py-4">
                    <div className="text-gray-500">No hay servicios disponibles</div>
                  </div>
                )}
            </>
          )}
        </div>

        <AmenityDescriptionsSection
          selectedKeys={selectedAmenities}
          templatesByKey={templatesByKey}
          canWriteCustom={canWriteCustom}
        />

        {!editMode && propertyType === 'RealEstate' && <RealEstateExtensionForm />}
        {!editMode && propertyType === 'SummerRent' && <SummerRentExtensionForm />}
        {!editMode && propertyType === 'EventVenue' && <EventVenueExtensionForm />}

        {editMode && (
          <div className="border-t border-gray-200 pt-6 space-y-4">
            <h3 className="text-lg font-semibold">Detalles por modalidad</h3>
            <p className="text-sm text-gray-600">
              Elegí una pestaña para revisar o editar la información de cada tipo de publicación activa.
            </p>
            <div className="flex flex-wrap gap-1 border-b border-gray-200">
              {extensionKindsOrdered.map(kind => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setExtensionPanel(kind)}
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
                    extensionPanel === kind
                      ? 'border border-b-0 border-gray-200 bg-white text-primary-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {getPropertyTypeShortLabelEs(kind)}
                </button>
              ))}
              {missingExtensionKinds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExtensionPanel('add')}
                  className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
                    extensionPanel === 'add'
                      ? 'border border-b-0 border-gray-200 bg-white text-primary-700'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Agregar modalidad
                </button>
              )}
            </div>

            {extensionPanel !== 'add' && renderExtensionForm(extensionPanel as PropertyType)}

            {extensionPanel === 'add' && (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-gray-600">Seleccioná el tipo de publicación adicional:</p>
                <div className="flex flex-col gap-2">
                  {missingExtensionKinds.map(kind => (
                    <label key={kind} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="additionalExtensionTypeRadio"
                        value={kind}
                        checked={additionalExtensionType === kind}
                        onChange={() => setValue('additionalExtensionType', kind)}
                      />
                      <span className="text-sm">{getPropertyTypeShortLabelEs(kind)}</span>
                    </label>
                  ))}
                </div>
                {additionalExtensionType === 'RealEstate' && <RealEstateExtensionForm />}
                {additionalExtensionType === 'SummerRent' && <SummerRentExtensionForm />}
                {additionalExtensionType === 'EventVenue' && <EventVenueExtensionForm />}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button color="alternative" onClick={onBack}>
            Atrás
          </Button>
          <Button id="next-step-button" type="submit">
            Siguiente
          </Button>
        </div>
      </div>
    </form>
  );
}
