import { useFormContext } from 'react-hook-form';
import { Checkbox, Label, Select, TextInput, Textarea } from 'flowbite-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';
import { resolveCreationListingType } from '../../../models/properties/PropertyFormSchema';
import type { PropertyType } from '../../../models/properties/PropertyData';

const checkboxBool = {
  setValueAs: (v: unknown) => v === true || v === 'on',
};

export function ListingInformationForm() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<PropertyFormData>();

  const propertyType = watch('propertyType') as PropertyType | undefined;
  const realEstateOfferMode = watch('realEstateOfferMode');
  const effectiveListingType = resolveCreationListingType({
    propertyType,
    realEstateOfferMode,
  });
  const isSaleListing = effectiveListingType === 'RealEstate';

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Información del aviso</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Título y descripción del aviso (también editables aquí antes de publicar), disponibilidad,
          precio y opciones de visibilidad. El tipo de aviso se toma del tipo de propiedad elegido en
          el paso 1.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label htmlFor="listing-title-aviso">Título del aviso</Label>
          <TextInput
            id="listing-title-aviso"
            {...register('title')}
            placeholder="Título que verán en el listado"
          />
          {errors.title && (
            <p className="text-red-500 text-sm mt-1">{errors.title.message as string}</p>
          )}
        </div>
        <div>
          <Label htmlFor="listing-description-aviso">Descripción del aviso</Label>
          <Textarea
            id="listing-description-aviso"
            rows={4}
            {...register('description')}
            placeholder="Descripción breve para el listado"
          />
          {errors.description && (
            <p className="text-red-500 text-sm mt-1">{errors.description.message as string}</p>
          )}
        </div>
      </div>

      {propertyType === 'RealEstate' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-2 block">
              <Label htmlFor="realEstateOfferMode">Venta o alquiler</Label>
            </div>
            <Select id="realEstateOfferMode" {...register('realEstateOfferMode')}>
              <option value="sale">Venta</option>
              <option value="annual_rent">Alquiler (anual)</option>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="availableFrom">Disponible desde</Label>
          </div>
          <TextInput id="availableFrom" type="date" {...register('availableFrom')} />
          {errors.availableFrom && (
            <p className="text-red-500 text-sm mt-1">
              {errors.availableFrom.message as string}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="mb-2 block">
              <Label htmlFor="currency">Moneda</Label>
            </div>
            <Select id="currency" {...register('currency')}>
              <option value="">Selecciona una opción</option>
              <option value="USD">USD</option>
              <option value="UYU">UYU</option>
              <option value="BRL">BRL</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </Select>
            {errors.currency && (
              <p className="text-red-500 text-sm mt-1">
                {errors.currency.message as string}
              </p>
            )}
          </div>

          {isSaleListing ? (
            <div>
              <div className="mb-2 block">
                <Label htmlFor="salePrice">Precio</Label>
              </div>
              <TextInput id="salePrice" type="number" min="0" step="0.01" {...register('salePrice')} />
              {errors.salePrice && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.salePrice.message as string}
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-2 block">
                <Label htmlFor="rentPrice">Precio</Label>
              </div>
              <TextInput id="rentPrice" type="number" min="0" step="0.01" {...register('rentPrice')} />
              {errors.rentPrice && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.rentPrice.message as string}
                </p>
              )}
            </div>
          )}

          {isSaleListing ? (
            <div className="hidden md:block" aria-hidden />
          ) : (
            <div>
              <div className="mb-2 block">
                <Label htmlFor="rentPricePeriod">Tipo de precio de alquiler</Label>
              </div>
              <Select id="rentPricePeriod" {...register('rentPricePeriod')}>
                <option value="PerNight">Por noche / evento</option>
                <option value="PerMonth">Mensual</option>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Usa &quot;Mensual&quot; para alquiler mensual; &quot;Por noche / evento&quot; para temporada o eventos.
              </p>
              {errors.rentPricePeriod && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.rentPricePeriod.message as string}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center min-h-[42px]">
            <Checkbox id="isPriceVisible" {...register('isPriceVisible', checkboxBool)} />
            <Label htmlFor="isPriceVisible" className="ml-2">
              Mostrar precio
            </Label>
          </div>
          <div className="flex items-center min-h-[42px]">
            <Checkbox id="isActive" {...register('isActive', checkboxBool)} />
            <Label htmlFor="isActive" className="ml-2">
              Publicar ahora
            </Label>
          </div>
          <div className="flex items-center min-h-[42px]">
            <Checkbox id="blockedForBooking" {...register('blockedForBooking', checkboxBool)} />
            <Label htmlFor="blockedForBooking" className="ml-2">
              Bloquear reservas
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
