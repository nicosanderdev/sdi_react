import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Label, TextInput } from 'flowbite-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';

export function SummerRentExtensionForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext<PropertyFormData>();

  return (
    <div className="mt-8 border-t border-gray-200 pt-6 space-y-6">
      <h3 className="text-lg font-semibold">Parámetros de alquiler de temporada</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="minStayDays">Estadía mínima (días)</Label>
          </div>
          <TextInput
            id="minStayDays"
            type="number"
            min="0"
            {...register('minStayDays')}
          />
          {errors.minStayDays && (
            <p className="text-red-500 text-sm mt-1">{errors.minStayDays.message as string}</p>
          )}
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="maxStayDays">Estadía máxima (días)</Label>
          </div>
          <TextInput
            id="maxStayDays"
            type="number"
            min="0"
            {...register('maxStayDays')}
          />
          {errors.maxStayDays && (
            <p className="text-red-500 text-sm mt-1">{errors.maxStayDays.message as string}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="leadTimeDays">Anticipación mínima para reserva (días)</Label>
          </div>
          <TextInput
            id="leadTimeDays"
            type="number"
            min="0"
            {...register('leadTimeDays')}
          />
          {errors.leadTimeDays && (
            <p className="text-red-500 text-sm mt-1">{errors.leadTimeDays.message as string}</p>
          )}
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="bufferDays">Días de buffer entre reservas</Label>
          </div>
          <TextInput
            id="bufferDays"
            type="number"
            min="0"
            {...register('bufferDays')}
          />
          {errors.bufferDays && (
            <p className="text-red-500 text-sm mt-1">{errors.bufferDays.message as string}</p>
          )}
        </div>
      </div>
    </div>
  );
}

