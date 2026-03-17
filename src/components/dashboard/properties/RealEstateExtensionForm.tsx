import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Label, TextInput, Checkbox } from 'flowbite-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';

export function RealEstateExtensionForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext<PropertyFormData>();

  return (
    <div className="mt-8 border-t border-gray-200 pt-6 space-y-6">
      <h3 className="text-lg font-semibold">Detalles adicionales para venta / alquiler anual</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="allowsFinancing">Acepta financiación</Label>
          </div>
          <Checkbox id="allowsFinancing" {...register('allowsFinancing')} />
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="isNewConstruction">Es construcción nueva</Label>
          </div>
          <Checkbox id="isNewConstruction" {...register('isNewConstruction')} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="hasMortgage">Tiene hipoteca</Label>
          </div>
          <Checkbox id="hasMortgage" {...register('hasMortgage')} />
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="hoaFees">Gastos comunes mensuales (HOA)</Label>
          </div>
          <TextInput
            id="hoaFees"
            type="number"
            min="0"
            step="0.01"
            {...register('hoaFees')}
          />
          {errors.hoaFees && (
            <p className="text-red-500 text-sm mt-1">{errors.hoaFees.message as string}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="minContractMonths">Meses mínimos de contrato</Label>
          </div>
          <TextInput
            id="minContractMonths"
            type="number"
            min="0"
            {...register('minContractMonths')}
          />
          {errors.minContractMonths && (
            <p className="text-red-500 text-sm mt-1">
              {errors.minContractMonths.message as string}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="requiresGuarantee">Requiere garantía</Label>
          </div>
          <Checkbox id="requiresGuarantee" {...register('requiresGuarantee')} />
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="guaranteeType">Tipo de garantía aceptada</Label>
          </div>
          <TextInput id="guaranteeType" {...register('guaranteeType')} />
          {errors.guaranteeType && (
            <p className="text-red-500 text-sm mt-1">
              {errors.guaranteeType.message as string}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 block">
          <Label htmlFor="allowsPets">Permite mascotas</Label>
        </div>
        <Checkbox id="allowsPets" {...register('allowsPets')} />
      </div>
    </div>
  );
}

