import React from 'react';
import { useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { PropertyFormData } from '../../../models/properties/PropertyFormSchema';
import { Button, Label, Select, TextInput, Textarea, Checkbox } from 'flowbite-react';
import PropertyService from '../../../services/PropertyService';
import { Amenity } from '../../../models/properties/Amenity';
import { RealEstateExtensionForm } from './RealEstateExtensionForm';
import { SummerRentExtensionForm } from './SummerRentExtensionForm';
import { EventVenueExtensionForm } from './EventVenueExtensionForm';

interface PropertyFormStep2Props {
  onNext: () => void;
  onBack: () => void;
}

export function PropertyFormStep2({
  onNext,
  onBack
}: PropertyFormStep2Props) {
  const { register, formState: { errors }, watch, trigger, setValue } = useFormContext<PropertyFormData>();
  const selectedAmenities = watch('amenities') || [];
  const propertyType = watch('propertyType');

  const { data: allAmenities, isLoading: isLoadingAmenities } = useQuery({
    queryKey: ['amenities', propertyType],
    queryFn: () => PropertyService.getAmenities(),
    enabled: !!propertyType,
  });

  const handleAmenityChange = (amenityId: string, isChecked: boolean) => {
    if (isChecked) {
      setValue('amenities', [...selectedAmenities, amenityId]);
    } else {
      setValue('amenities', selectedAmenities.filter(id => id !== amenityId));
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseFieldsToValidate: (keyof PropertyFormData)[] = [
      'title',
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

  return (
    <form onSubmit={handleNext} className="max-w-2xl mx-auto" id="onboarding-form-details">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Información Principal</h3>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="title">
                Título de la Publicación*
              </Label>
            </div>
            <TextInput
              id="title"
              {...register('title')}
              placeholder="Ej: Apartamento moderno en el centro"/>
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
          </div>
          <div className="mt-4">
            <div className="mb-2 block">
              <Label htmlFor="description">Descripción</Label>
            </div>
            <Textarea
              id="description"
              {...register('description')}
              rows={4}
              placeholder="Añada una descripción detallada de la propiedad..."
            />
            {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
          </div>
        </div>

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
            {propertyType && (
              <span className="text-xs text-gray-500">
                Para tipo de propiedad: <span className="font-medium">{propertyType}</span>
              </span>
            )}
          </div>
          {!propertyType && (
            <div className="text-center py-4">
              <div className="text-gray-500">
                Selecciona un tipo de propiedad en el Paso 1 para ver los servicios disponibles.
              </div>
            </div>
          )}
          {propertyType && isLoadingAmenities && (
            <div className="text-center py-4">
              <div className="text-gray-500">Cargando servicios...</div>
            </div>
          )}
          {propertyType && !isLoadingAmenities && allAmenities && allAmenities.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {allAmenities.map((amenity: Amenity) => (
                <div key={amenity.id} className="flex items-center">
                  <Checkbox
                    id={`amenity-${amenity.id}`}
                    checked={selectedAmenities.includes(amenity.id)}
                    onChange={e => handleAmenityChange(amenity.id, e.target.checked)}
                  />
                  <Label htmlFor={`amenity-${amenity.id}`} className="ml-2">
                    {amenity.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
          {propertyType && !isLoadingAmenities && (!allAmenities || allAmenities.length === 0) && (
            <div className="text-center py-4">
              <div className="text-gray-500">No hay servicios disponibles</div>
            </div>
          )}
        </div>

        {/* Extension-specific fields based on selected propertyType */}
        {propertyType === 'RealEstate' && <RealEstateExtensionForm />}
        {propertyType === 'SummerRent' && <SummerRentExtensionForm />}
        {propertyType === 'EventVenue' && <EventVenueExtensionForm />}

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