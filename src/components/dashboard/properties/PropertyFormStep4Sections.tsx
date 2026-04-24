import { Button } from 'flowbite-react';
import type { DisplayImage } from './ImageManager';
import { PropertyContentSectionsManager } from './PropertyContentSectionsManager';

interface PropertyFormStep4SectionsProps {
  onNext?: () => void;
  onBack: () => void;
  displayImages: DisplayImage[];
  hideNextButton?: boolean;
}

/**
 * Dedicated step for dynamic content sections (after media, before listing/publish).
 */
export function PropertyFormStep4Sections({
  onNext,
  onBack,
  displayImages,
  hideNextButton = false,
}: PropertyFormStep4SectionsProps) {
  return (
    <div className="max-w-4xl mx-auto" id="onboarding-form-sections">
      <div className="space-y-6">
        <PropertyContentSectionsManager displayImages={displayImages} />

        <div className="flex justify-between pt-4">
          <Button color="alternative" onClick={onBack}>
            Atrás
          </Button>
          {!hideNextButton && onNext && (
            <Button id="next-step-button" onClick={onNext}>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
