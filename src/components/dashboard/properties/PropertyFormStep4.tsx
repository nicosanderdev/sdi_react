import React, { useState } from 'react';
import { Button, Label, Radio } from 'flowbite-react';
import { useFormContext } from 'react-hook-form';
import { DocumentManager } from './DocumentManager';
import { DisplayDocument } from './DocumentManager';
import type { PropertyCreationFormData } from './PropertyCreationWizard';

interface PropertyFormStep4Props {
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isSubmitting: boolean;
  displayDocuments: DisplayDocument[];
  setDisplayDocuments: React.Dispatch<React.SetStateAction<DisplayDocument[]>>;
}

export function PropertyFormStep4({ 
  onSubmit, 
  onBack, 
  isSubmitting,
  displayDocuments,
  setDisplayDocuments
}: PropertyFormStep4Props) {
  const { register, watch } = useFormContext<PropertyCreationFormData>();
  const publishMode = watch('publishMode');
  const propertyType = watch('propertyType');
  const [documentsError, setDocumentsError] = useState<string | null>(null);

  const handleSubmitWithValidation = (e: React.FormEvent) => {
    // Require documents for RealEstate-type properties, per flow definition.
    if (propertyType === 'RealEstate' && (!displayDocuments || displayDocuments.length === 0)) {
      e.preventDefault();
      setDocumentsError('Debes subir al menos un documento para propiedades de venta / alquiler anual.');
      return;
    }
    setDocumentsError(null);
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmitWithValidation} className="max-w-4xl mx-auto">
      <div className="space-y-8">
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

        {/* Documents Section */}
        <DocumentManager
          displayDocuments={displayDocuments}
          onDocumentsChange={setDisplayDocuments}
        />

        {documentsError && (
          <p className="text-red-500 text-sm mt-1">{documentsError}</p>
        )}

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