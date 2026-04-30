import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Label, TextInput, Checkbox } from 'flowbite-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';

export function RealEstateExtensionForm() {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext<PropertyFormData>();
  const hasCommonExpenses = watch('hasCommonExpenses');

  return (
    <div className="mt-8 border-t border-gray-200 pt-6 space-y-6">
      <h3 className="text-lg font-semibold">Detalles adicionales para venta / alquiler anual</h3>

      <div className="grid grid-cols-1 gap-1">
        <div className="flex items-center min-h-[42px]">
          <Checkbox id="allowsFinancing" {...register('allowsFinancing')} />
          <Label htmlFor="allowsFinancing" className="ml-2">
            Acepta financiación
          </Label>
        </div>
        <div className="flex items-center min-h-[42px]">
          <Checkbox id="isNewConstruction" {...register('isNewConstruction')} />
          <Label htmlFor="isNewConstruction" className="ml-2">
            Es construcción nueva
          </Label>
        </div>
        <div className="flex items-center min-h-[42px]">
          <Checkbox id="hasMortgage" {...register('hasMortgage')} />
          <Label htmlFor="hasMortgage" className="ml-2">
            Tiene hipoteca
          </Label>
        </div>
        <div className="flex items-center min-h-[42px]">
          <Checkbox id="allowsPets" {...register('allowsPets')} />
          <Label htmlFor="allowsPets" className="ml-2">
            Permite mascotas
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center min-h-[42px]">
            <Checkbox id="hasCommonExpenses" {...register('hasCommonExpenses')} />
            <Label htmlFor="hasCommonExpenses" className="ml-2">
              Tiene gastos comunes
            </Label>
          </div>
        </div>
        <div>
          {hasCommonExpenses && (
            <>
              <div className="mb-2 block">
                <Label htmlFor="commonExpensesValue">Valor gastos comunes</Label>
              </div>
              <TextInput id="commonExpensesValue" {...register('commonExpensesValue')} />
              {errors.commonExpensesValue && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.commonExpensesValue.message as string}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center min-h-[42px]">
            <Checkbox id="requiresGuarantee" {...register('requiresGuarantee')} />
            <Label htmlFor="requiresGuarantee" className="ml-2">
              Requiere garantía
            </Label>
          </div>
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
          <Label htmlFor="minContractMonths">Meses mínimos de contrato</Label>
        </div>
        <TextInput id="minContractMonths" type="number" min="0" {...register('minContractMonths')} />
        {errors.minContractMonths && (
          <p className="text-red-500 text-sm mt-1">
            {errors.minContractMonths.message as string}
          </p>
        )}
      </div>
    </div>
  );
}

