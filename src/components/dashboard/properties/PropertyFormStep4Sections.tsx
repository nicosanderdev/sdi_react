import type { ReactNode } from 'react';
import { Button } from 'flowbite-react';
import type { DisplayImage } from './ImageManager';
import { PropertyContentSectionsManager } from './PropertyContentSectionsManager';
import { PropertyPoliciesManager } from './PropertyPoliciesManager';
import type { ListingType, PropertyType } from '../../../models/properties/PropertyData';

interface PropertyFormStep4SectionsProps {
  onNext?: () => void;
  onBack: () => void;
  displayImages: DisplayImage[];
  hideNextButton?: boolean;
  footerExtra?: ReactNode;
  allowedListingTypes?: ListingType[];
  allowedPropertyTypes?: PropertyType[];
  canWriteCustom?: boolean;
}

export function PropertyFormStep4Sections({
  onNext,
  onBack,
  displayImages,
  hideNextButton = false,
  footerExtra,
  allowedListingTypes,
  allowedPropertyTypes,
  canWriteCustom = false,
}: PropertyFormStep4SectionsProps) {
  return (
    <div className="max-w-4xl mx-auto w-full" id="onboarding-form-sections">
      <div className="space-y-6">
        <PropertyContentSectionsManager
          displayImages={displayImages}
          allowedPropertyTypes={allowedPropertyTypes}
          canWriteCustom={canWriteCustom}
        />
        <PropertyPoliciesManager
          allowedListingTypes={allowedListingTypes}
          canWriteCustom={canWriteCustom}
        />

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
