import type { ReactNode } from 'react';
import { Button } from 'flowbite-react';
import type { DisplayImage } from './ImageManager';
import { PropertyContentSectionsManager } from './PropertyContentSectionsManager';
import { PropertyPoliciesManager } from './PropertyPoliciesManager';

interface PropertyFormStep4SectionsProps {
  onNext?: () => void;
  onBack: () => void;
  displayImages: DisplayImage[];
  hideNextButton?: boolean;
  /** Renders on the right of the footer row (e.g. edit wizard save actions). Same max-width as content. */
  footerExtra?: ReactNode;
  /** Edit flow: restrict policy listing types to active modalities. */
  allowedListingTypes?: import('../../../models/properties/PropertyData').ListingType[];
}

/**
 * Dedicated step for dynamic content sections (after media, before listing/publish).
 */
export function PropertyFormStep4Sections({
  onNext,
  onBack,
  displayImages,
  hideNextButton = false,
  footerExtra,
  allowedListingTypes,
}: PropertyFormStep4SectionsProps) {
  return (
    <div className="max-w-4xl mx-auto w-full" id="onboarding-form-sections">
      <div className="space-y-6">
        <PropertyContentSectionsManager displayImages={displayImages} />
        <PropertyPoliciesManager allowedListingTypes={allowedListingTypes} />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <Button color="alternative" onClick={onBack}>
            Atrás
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!hideNextButton && onNext && (
              <Button id="next-step-button" onClick={onNext}>
                Siguiente
              </Button>
            )}
            {footerExtra}
          </div>
        </div>
      </div>
    </div>
  );
}
