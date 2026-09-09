import { useFormContext } from 'react-hook-form';
import { Label, TextInput, Textarea } from 'flowbite-react';
import type { PropertyFormData } from '../../../models/properties/PropertyFormSchema';

/**
 * Listing title and description (aviso) — shared by create publication step and edit final step.
 */
export function PropertyListingCopyFields() {
  const {
    register,
    formState: { errors },
  } = useFormContext<PropertyFormData>();

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <Label htmlFor="title">Título del aviso</Label>
        <TextInput
          id="title"
          {...register('title')}
          placeholder="Título que verán en el listado"
        />
        {errors.title && (
          <p className="text-red-500 text-sm mt-1">{errors.title.message as string}</p>
        )}
      </div>
      <div>
        <Label htmlFor="description">Descripción del aviso</Label>
        <Textarea
          id="description"
          rows={4}
          {...register('description')}
          placeholder="Descripción breve para el listado"
        />
        {errors.description && (
          <p className="text-red-500 text-sm mt-1">{errors.description.message as string}</p>
        )}
      </div>
    </div>
  );
}
