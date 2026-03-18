// PropertyFormStep3.tsx - CORRECTED VERSION
import React from 'react';
import { Button } from 'flowbite-react';
import { useFormContext } from 'react-hook-form';
import { ImageManager } from './ImageManager';
import { VideoManager } from './VideoManager';
import { DocumentManager, DisplayDocument } from './DocumentManager';
import { DisplayImage } from './ImageManager';
import { DisplayVideo } from './VideoManager';
import type { PropertyCreationFormData } from './PropertyCreationWizard';

interface PropertyFormStep3Props {
  onNext: () => void;
  onBack: () => void;
  displayImages: DisplayImage[];
  setDisplayImages: React.Dispatch<React.SetStateAction<DisplayImage[]>>;
  displayVideos: DisplayVideo[];
  setDisplayVideos: React.Dispatch<React.SetStateAction<DisplayVideo[]>>;
  displayDocuments: DisplayDocument[];
  setDisplayDocuments: React.Dispatch<React.SetStateAction<DisplayDocument[]>>;
}


export function PropertyFormStep3({ 
  onNext, 
  onBack, 
  displayImages, 
  setDisplayImages, 
  displayVideos, 
  setDisplayVideos,
  displayDocuments,
  setDisplayDocuments
}: PropertyFormStep3Props) {
  const { watch } = useFormContext<PropertyCreationFormData>();
  const propertyType = watch('propertyType');

  return (
    <div className="max-w-4xl mx-auto" id="onboarding-form-photos">
      <div className="space-y-6">
        {/* Images Section */}
        <ImageManager
          displayImages={displayImages}
          onImagesChange={setDisplayImages}
        />

        {/* Videos Section */}
        <VideoManager
          displayVideos={displayVideos}
          onVideosChange={setDisplayVideos}
        />

        {/* Documents Section - only for RealEstate properties */}
        {propertyType === 'RealEstate' && (
          <DocumentManager
            displayDocuments={displayDocuments}
            onDocumentsChange={setDisplayDocuments}
          />
        )}
        
        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button color="alternative" onClick={onBack}>
            Atrás
          </Button>
          <Button id="next-step-button" onClick={onNext}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}