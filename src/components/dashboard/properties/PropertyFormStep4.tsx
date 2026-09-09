import React from 'react';
import { Button } from 'flowbite-react';
import { ListingInformationForm } from './ListingInformationForm';

interface PropertyFormStep4Props {
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

export function PropertyFormStep4({ onSubmit, onBack, isSubmitting }: PropertyFormStep4Props) {
  return (
    <form onSubmit={onSubmit} className="max-w-4xl mx-auto">
      <div className="space-y-8">
        <ListingInformationForm />

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Si el aviso no se publica, se guardará como borrador.
        </p>

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
