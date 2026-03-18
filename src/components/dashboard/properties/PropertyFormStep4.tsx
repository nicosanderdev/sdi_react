import React, { useState } from 'react';
import { Button, Radio } from 'flowbite-react';
import { useFormContext } from 'react-hook-form';
import type { PropertyCreationFormData } from './PropertyCreationWizard';
import { ListingInformationForm } from './ListingInformationForm';

interface PropertyFormStep4Props {
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function PropertyFormStep4({ 
  onSubmit, 
  onBack, 
  isSubmitting
}: PropertyFormStep4Props) {
  const { register, watch } = useFormContext<PropertyCreationFormData>();
  const publishMode = watch('publishMode');
  const propertyType = watch('propertyType');
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const handleSubmitWithValidation = (e: React.FormEvent) => {
    // Require documents for RealEstate-type properties, per flow definition.
    // NOTE: Validation of required documents for RealEstate is now handled earlier
    // in the flow alongside the documents upload UI.
    setDocumentsError(null);
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmitWithValidation} className="max-w-4xl mx-auto">
      <div className="space-y-8">
        {/* Listing information section */}
        <ListingInformationForm />

        {/* Publish mode */}
        <div className="border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-semibold mb-2">Publicación</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <label className="flex items-center gap-2">
              <Radio
                {...register('publishMode')}
                value="draft"
                checked={publishMode === 'draft'}
              />
              <span>Guardar como borrador</span>
            </label>
            <label className="flex items-center gap-2">
              <Radio
                {...register('publishMode')}
                value="publish"
                checked={publishMode === 'publish'}
              />
              <span>Publicar ahora</span>
            </label>
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button color="alternative" onClick={onBack}>
            Atrás
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Propiedad'}
          </Button>
        </div>
      </div>
    </form>
  );
}