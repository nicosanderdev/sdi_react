// PropertyFormStep3.tsx - CORRECTED VERSION
import React from 'react';
import { Button } from 'flowbite-react';
import { ImageManager } from './ImageManager';
import { VideoManager } from './VideoManager';
import { DisplayImage } from './ImageManager';
import { DisplayVideo } from './VideoManager';

interface PropertyFormStep3Props {
  onNext: () => void;
  onBack: () => void;
  displayImages: DisplayImage[];
  setDisplayImages: React.Dispatch<React.SetStateAction<DisplayImage[]>>;
  displayVideos: DisplayVideo[];
  setDisplayVideos: React.Dispatch<React.SetStateAction<DisplayVideo[]>>;
}


export function PropertyFormStep3({ 
  onNext, 
  onBack, 
  displayImages, 
  setDisplayImages, 
  displayVideos, 
  setDisplayVideos 
}: PropertyFormStep3Props) {

  return (
    <div className="max-w-4xl mx-auto">
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
        
        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button color="alternative" onClick={onBack}>
            Atrás
          </Button>
          <Button onClick={onNext}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}