import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Button, Checkbox, Label, Select, TextInput } from 'flowbite-react';
import type { PropertyCreationFormData } from './PropertyCreationWizard';
import type { ListingType } from '../../../models/properties/PropertyData';

export function ListingInformationForm() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<PropertyCreationFormData>();

  const listingType = watch('listingType');
  const hasCommonExpenses = watch('hasCommonExpenses');

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Información del aviso</h3>
        <p className="text-sm text-gray-500">
          Configura cómo se mostrará esta propiedad en los listados: tipo de aviso, precios,
          visibilidad y estado.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="listingType">Tipo de aviso</Label>
          </div>
          <Select id="listingType" {...register('listingType' as keyof PropertyCreationFormData)}>
            <option value="">Selecciona una opción</option>
            <option value="RealEstate">Venta</option>
            <option value="AnnualRent">Alquiler anual</option>
            <option value="SummerRent">Alquiler de temporada</option>
            <option value="EventVenue">Eventos</option>
          </Select>
          {errors.listingType && (
            <p className="text-red-500 text-sm mt-1">
              {errors.listingType.message as string}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="availableFrom">Disponible desde</Label>
          </div>
          <TextInput
            id="availableFrom"
            type="date"
            {...register('availableFrom')}
          />
          {errors.availableFrom && (
            <p className="text-red-500 text-sm mt-1">
              {errors.availableFrom.message as string}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="capacity">Capacidad (personas)</Label>
          </div>
          <TextInput
            id="capacity"
            type="number"
            min="1"
            {...register('capacity', { valueAsNumber: true })}
          />
          {errors.capacity && (
            <p className="text-red-500 text-sm mt-1">
              {errors.capacity.message as string}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        <div>
          <div className="mb-2 block">
            <Label htmlFor="salePrice">Precio de venta</Label>
          </div>
          <TextInput
            id="salePrice"
            type="number"
            min="0"
            step="0.01"
            {...register('salePrice')}
          />
          {errors.salePrice && (
            <p className="text-red-500 text-sm mt-1">
              {errors.salePrice.message as string}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="rentPrice">
              Precio de alquiler {listingType === 'AnnualRent' ? '(mensual)' : '(por noche / evento)'}
            </Label>
          </div>
          <TextInput
            id="rentPrice"
            type="number"
            min="0"
            step="0.01"
            {...register('rentPrice')}
          />
          {errors.rentPrice && (
            <p className="text-red-500 text-sm mt-1">
              {errors.rentPrice.message as string}
            </p>
          )}
        </div>

        <div className="flex items-center mt-6">
          <Checkbox id="isPriceVisible" {...register('isPriceVisible')} />
          <Label htmlFor="isPriceVisible" className="ml-2">
            Mostrar precio en el aviso
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <div className="flex items-center">
            <Checkbox id="hasCommonExpenses" {...register('hasCommonExpenses')} />
            <Label htmlFor="hasCommonExpenses" className="ml-2">
              Tiene gastos comunes
            </Label>
          </div>
          <TextInput
            id="commonExpensesValue"
            type="number"
            min="0"
            step="0.01"
            disabled={!hasCommonExpenses}
            {...register('commonExpensesValue')}
          />
          {errors.commonExpensesValue && (
            <p className="text-red-500 text-sm mt-1">
              {errors.commonExpensesValue.message as string}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center">
            <Checkbox id="isElectricityIncluded" {...register('isElectricityIncluded')} />
            <Label htmlFor="isElectricityIncluded" className="ml-2">
              Incluye electricidad
            </Label>
          </div>
          <div className="flex items-center">
            <Checkbox id="isWaterIncluded" {...register('isWaterIncluded')} />
            <Label htmlFor="isWaterIncluded" className="ml-2">
              Incluye agua
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <div className="mb-2 block">
              <Label htmlFor="status">Estado del aviso</Label>
            </div>
            <Select id="status" {...register('status')}>
              <option value="">Selecciona una opción</option>
              <option value="sale">En venta</option>
              <option value="rent">En alquiler</option>
              <option value="reserved">Reservado</option>
              <option value="sold">Vendido</option>
              <option value="unavailable">No disponible</option>
            </Select>
            {errors.status && (
              <p className="text-red-500 text-sm mt-1">
                {errors.status.message as string}
              </p>
            )}
          </div>
          <div className="flex items-center">
            <Checkbox id="isActive" {...register('isActive')} />
            <Label htmlFor="isActive" className="ml-2">
              Aviso activo
            </Label>
          </div>
          <div className="flex items-center">
            <Checkbox id="isPropertyVisible" {...register('isPropertyVisible')} />
            <Label htmlFor="isPropertyVisible" className="ml-2">
              Mostrar propiedad en el sitio
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}

