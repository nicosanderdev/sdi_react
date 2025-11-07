import React from 'react';
import { Button } from 'flowbite-react';
import { DocumentManager } from './DocumentManager';
import { DisplayDocument } from './DocumentManager';

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

  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto">
      <div className="space-y-8">
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