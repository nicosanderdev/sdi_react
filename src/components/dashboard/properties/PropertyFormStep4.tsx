import React from 'react';
import { Button, Checkbox, Label, Radio } from 'flowbite-react';
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
  const { register, watch, setValue } = useFormContext<PropertyCreationFormData>();
  const publishMode = watch('publishMode');
  const listingTypes = watch('listingTypes') || [];

  const toggleListingType = (type: 'SummerRent' | 'EventVenue' | 'AnnualRent' | 'RealEstate') => {
    if (listingTypes.includes(type as any)) {
      setValue(
        'listingTypes',
        listingTypes.filter((t: any) => t !== type)
      );
    } else {
      setValue('listingTypes', [...listingTypes, type as any]);
    }
  };

  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto">
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

          <div className="mt-4 space-y-2">
            <Label className="font-medium">Tipos de listado a crear</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['RealEstate', 'AnnualRent', 'SummerRent', 'EventVenue'].map((lt) => (
                <label key={lt} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={listingTypes.includes(lt as any)}
                    onChange={() =>
                      toggleListingType(lt as 'SummerRent' | 'EventVenue' | 'AnnualRent' | 'RealEstate')
                    }
                  />
                  <span>{lt}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Documents Section */}
        <DocumentManager
          displayDocuments={displayDocuments}
          onDocumentsChange={setDisplayDocuments}
        />

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