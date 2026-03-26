import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Label, TextInput, Checkbox } from 'flowbite-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';

export function EventVenueExtensionForm() {
  const {
    register,
    formState: { errors },
  } = useFormContext<PropertyFormData>();

  return (
    <div className="mt-8 border-t border-gray-200 pt-6 space-y-6">
      <h3 className="text-lg font-semibold">Configuración para salón de eventos</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="maxGuests">Capacidad máxima de invitados</Label>
          </div>
          <TextInput
            id="maxGuests"
            type="number"
            min="0"
            {...register('maxGuests')}
          />
          {errors.maxGuests && (
            <p className="text-red-500 text-sm mt-1">{errors.maxGuests.message as string}</p>
          )}
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="closingHour">Hora de cierre</Label>
          </div>
          <TextInput id="closingHour" type="time" {...register('closingHour')} />
          {errors.closingHour && (
            <p className="text-red-500 text-sm mt-1">{errors.closingHour.message as string}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="mb-2 block">
            <Label htmlFor="hasCatering">Incluye servicio de catering</Label>
          </div>
          <Checkbox id="hasCatering" {...register('hasCatering')} />
        </div>

        <div>
          <div className="mb-2 block">
            <Label htmlFor="hasSoundSystem">Incluye equipo de sonido</Label>
          </div>
          <Checkbox id="hasSoundSystem" {...register('hasSoundSystem')} />
        </div>
      </div>

      <div>
        <div className="mb-2 block">
          <Label htmlFor="allowedEventsDescription">Eventos permitidos</Label>
        </div>
        <TextInput
          id="allowedEventsDescription"
          placeholder="Ej: casamientos, cumpleaños, conferencias..."
          {...register('allowedEventsDescription')}
        />
        {errors.allowedEventsDescription && (
          <p className="text-red-500 text-sm mt-1">
            {errors.allowedEventsDescription.message as string}
          </p>
        )}
      </div>
    </div>
  );
}

