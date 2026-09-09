import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Dropdown, DropdownItem, Label, Select } from 'flowbite-react';
import { ArrowLeft, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { PropertyFormStep1 } from './PropertyFormStep1';
import { PropertyFormStep2 } from './PropertyFormStep2';
import { PropertyFormStep3 } from './PropertyFormStep3';
import { PropertyFormStep4 } from './PropertyFormStep4';
import { PropertyFormStep4Sections } from './PropertyFormStep4Sections';
import PropertyService from '../../../services/PropertyService';
import { PropertyData, ListingType, PropertyType } from '../../../models/properties';
import PropertyListingService, { ListingIntentPayload } from '../../../services/PropertyListingService';
import PropertyExtensionService, { PropertyExtensionIntent } from '../../../services/PropertyExtensionService';
import { DisplayImage } from './ImageManager';
import { DisplayDocument } from './DocumentManager';
import { DisplayVideo } from './VideoManager';
import { usePropertyQuota } from '../../../hooks/usePropertyQuota';
import { useContactVerificationGate } from '../../../hooks/useContactVerificationGate';
import { CONTACT_VERIFICATION_REQUIRED_MESSAGE } from '../../../utils/contactVerification';
import { effectivePhotoCap } from '../../../utils/photoLimits';
import { SuccessDisplay } from '../../ui/SuccessDisplay';
import { ErrorDisplay } from '../../ui/ErrorDisplay';
import {
  propertyCreatePublishSchema,
  PropertyFormData,
  resolveCreationListingType,
} from '../../../models/properties/PropertyFormSchema';
import { getPropertyTypeLabelEs } from '../../../models/properties/propertyTypeLabels';
import { selectUserCompanies } from '../../../store/slices/userSlice';

const PERSONAL_OWNERSHIP = '__personal__';

function isManageableCompanyRole(role?: string | null): boolean {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  return r === 'admin' || r === 'manager' || r === '2' || r === '1';
}

export type PropertyCreationMode = 'user' | 'admin';

export interface ListingIntent {
  listingType: ListingType;
  publishNow: boolean;
}

export interface PropertyCreationResult {
  property: PropertyData;
  listingIntents: ListingIntent[];
}

export interface PropertyCreationInitialContext {
  mode: PropertyCreationMode;
  isAdmin: boolean;
  isAffiliatedUsingAgencyQuota?: boolean;
  /** Subscription types available to the current creator (personal or company). */
  availablePropertyTypes: PropertyType[];
  /** If the admin is creating on behalf of a specific user, their userId. */
  ownerUserId?: string;
  /** Prefill ownership to a company the creator manages. */
  companyId?: string;
}

export const propertyCreationFormSchema = propertyCreatePublishSchema;

export type PropertyCreationFormData = PropertyFormData;

interface PropertyCreationWizardProps {
  initialContext: PropertyCreationInitialContext;
  onComplete?: (result: PropertyCreationResult) => void;
  onClose?: () => void;
}

export function PropertyCreationWizard({
  initialContext,
  onComplete,
  onClose,
}: PropertyCreationWizardProps) {
  const queryClient = useQueryClient();

  const [view, setView] = useState<'form' | 'success' | 'error'>('form');
  const [currentStep, setCurrentStep] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const [displayDocuments, setDisplayDocuments] = useState<DisplayDocument[]>([]);
  const [displayVideos, setDisplayVideos] = useState<DisplayVideo[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [propertyTypeLocked, setPropertyTypeLocked] = useState(false);
  const userCompanies = useSelector(selectUserCompanies);
  const manageableCompanies = useMemo(
    () => (userCompanies ?? []).filter(c => isManageableCompanyRole(c.role)),
    [userCompanies]
  );
  const [ownershipKey, setOwnershipKey] = useState<string>(
    initialContext.companyId && manageableCompanies.some(c => c.id === initialContext.companyId)
      ? initialContext.companyId
      : PERSONAL_OWNERSHIP
  );
  const selectedCompanyId = ownershipKey === PERSONAL_OWNERSHIP ? null : ownershipKey;

  const {
    canCreateProperty,
    isAtPublishedLimit,
    totalLimit,
    publishedLimit,
    maxPhotosPerProperty,
  } = usePropertyQuota(selectedCompanyId);
  const { needsVerification } = useContactVerificationGate();

  const methods = useForm<PropertyCreationFormData>({
    resolver: zodResolver(propertyCreationFormSchema as any),
    mode: 'onTouched',
    defaultValues: {
      // Ensure location is always defined when the wizard is used directly
      location: { lat: -34.9011, lng: -56.1645 },
      contentSections: [],
      propertyPolicies: [],
      rentPricePeriod: 'PerNight',
      realEstateOfferMode: 'sale',
      isActive: true,
      blockedForBooking: false,
    } as any,
  });

  const { handleSubmit, register, setValue, watch } = methods;
  const watchedPropertyType = watch('propertyType');
  const watchedRealEstateOfferMode = watch('realEstateOfferMode');

  useEffect(() => {
    const inferred = resolveCreationListingType({
      propertyType: watchedPropertyType as PropertyType | undefined,
      realEstateOfferMode: watchedRealEstateOfferMode,
    });
    if (inferred) {
      setValue('listingType', inferred, { shouldValidate: false });
    }
  }, [watchedPropertyType, watchedRealEstateOfferMode, setValue]);

  const stepCount = 5;

  const handleNext = () => {
    setCurrentStep(prev => {
      if (prev === 1) setPropertyTypeLocked(true);
      return Math.min(prev + 1, stepCount);
    });
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmitInternal = async (formData: PropertyCreationFormData) => {
    try {
      setIsSubmitting(true);
      setApiError(null);

      if (!initialContext.isAdmin && needsVerification) {
        throw new Error(CONTACT_VERIFICATION_REQUIRED_MESSAGE);
      }

      if (!canCreateProperty) {
        throw new Error(`Your plan limits have reached. You cannot create more than ${totalLimit} properties.`);
      }

      const publishNow = formData.isActive === true;

      if (publishNow && isAtPublishedLimit) {
        throw new Error(`Your plan limits have reached. You cannot publish more than ${publishedLimit} properties.`);
      }

      const photoCap = effectivePhotoCap(maxPhotosPerProperty);
      if (displayImages.length > photoCap) {
        throw new Error(`Photo limit exceeded. Your plan allows a maximum of ${photoCap} photos per property.`);
      }

      const effectiveFormData: any = {
        ...formData,
        isPropertyVisible: publishNow,
        isActive: publishNow,
      };

      let created: PropertyData;
      if (initialContext.mode === 'admin' && initialContext.ownerUserId) {
        created = await PropertyService.createPropertyForOwner(
          initialContext.ownerUserId,
          effectiveFormData,
          displayImages,
          displayDocuments
        );
      } else {
        created = await PropertyService.createProperty(
          effectiveFormData,
          displayImages,
          displayDocuments,
          selectedCompanyId
        );
      }

      queryClient.invalidateQueries({ queryKey: ['properties'] });

      const effectivePropertyType: PropertyType =
        (formData.propertyType as PropertyType) || initialContext.availablePropertyTypes[0];

      const mainListingType: ListingType | undefined =
        (formData.listingType as ListingType | undefined) ??
        resolveCreationListingType({
          propertyType: effectivePropertyType,
          realEstateOfferMode: formData.realEstateOfferMode,
        });

      const listingIntents: ListingIntent[] = mainListingType
        ? [
            {
              listingType: mainListingType,
              publishNow,
            },
          ]
        : [];

      const extensionIntents: PropertyExtensionIntent[] = [
        {
          propertyId: created.id,
          propertyType: effectivePropertyType,
          isPrimary: true,
        },
      ];

      const listingPayloads: ListingIntentPayload[] = listingIntents.map(intent => ({
        propertyId: created.id,
        listingType: intent.listingType,
        publishNow: intent.publishNow,
        isFeatured: true,
      }));

      // Fire-and-forget placeholder calls; no DB changes here.
      void PropertyExtensionService.createExtensionsForProperty(extensionIntents);
      void PropertyListingService.createListingsForProperty(listingPayloads);

      onComplete?.({
        property: created,
        listingIntents,
      });

      setView('success');
    } catch (error: any) {
      setApiError(error.message || 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
      setView('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <Card className="min-h-full">
        {view === 'form' && (
          <>
            <div className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center">
                {currentStep > 1 && (
                  <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} />
                  </button>
                )}
                <h1 className="text-xl font-semibold">
                  Nueva Propiedad - Paso {currentStep} de {stepCount}
                </h1>
              </div>
              {onClose && (
                <button onClick={onClose} className="p-2 hover:bg-primary-400/20 rounded-full">
                  <X size={20} />
                </button>
              )}
            </div>
            <div className="px-6 flex space-x-1">
              {Array.from({ length: stepCount }, (_, i) => i + 1).map(step => (
                <div
                  key={step}
                  className={`flex-1 h-1 rounded-full ${step <= currentStep ? 'bg-primary-400' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            <div className="p-6">
              {currentStep === 1 && !initialContext.isAdmin && manageableCompanies.length > 0 && (
                <div className="mb-6 border border-gray-200 rounded-lg mx-auto max-w-md p-4">
                  <Label htmlFor="ownership" className="mb-2 block text-sm font-semibold">
                    Titularidad
                  </Label>
                  <Select
                    id="ownership"
                    value={ownershipKey}
                    onChange={e => setOwnershipKey(e.target.value)}
                  >
                    <option value={PERSONAL_OWNERSHIP}>Personal (mi plan)</option>
                    {manageableCompanies.map(company => (
                      <option key={company.id} value={company.id}>
                        Empresa: {company.name}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-2 text-xs text-gray-500">
                    Los límites de creación y publicación siguen el plan del titular elegido.
                  </p>
                </div>
              )}

              {/* ContextoUsuario: simple property type selector based on available types */}
              {currentStep === 1 && (
                <div className="mb-6 border border-gray-200 rounded-lg mx-auto max-w-xs p-4">
                  <h2 className="text-sm font-semibold mb-2">Tipo de propiedad</h2>
                  {propertyTypeLocked ? (
                    <p className="text-sm text-gray-700">
                      {getPropertyTypeLabelEs(watchedPropertyType as PropertyType | undefined)}
                    </p>
                  ) : initialContext.availablePropertyTypes.length > 1 ||
                    initialContext.isAdmin ||
                    initialContext.isAffiliatedUsingAgencyQuota ? (
                    <>
                      <input type="hidden" {...register('propertyType')} />
                      <Dropdown
                        inline
                        arrowIcon={false}
                        label={
                          <div className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm hover:bg-gray-50">
                            <span>{getPropertyTypeLabelEs(watchedPropertyType as PropertyType | undefined)}</span>
                            <span className="ml-2 text-xs text-gray-400">▼</span>
                          </div>
                        }
                      >
                        {initialContext.availablePropertyTypes.map(pt => (
                          <DropdownItem
                            key={pt}
                            onClick={() =>
                              setValue('propertyType', pt, {
                                shouldValidate: true,
                                shouldDirty: true,
                              })
                            }
                          >
                            {getPropertyTypeLabelEs(pt)}
                          </DropdownItem>
                        ))}
                      </Dropdown>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {getPropertyTypeLabelEs(initialContext.availablePropertyTypes[0])}
                    </p>
                  )}
                </div>
              )}
              {currentStep > 1 && watchedPropertyType && (
                <div className="mb-6">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    Tipo de propiedad: {getPropertyTypeLabelEs(watchedPropertyType as PropertyType)}
                  </span>
                </div>
              )}

              {currentStep === 1 && (
                <PropertyFormStep1 onNext={handleNext} />
              )}
              {currentStep === 2 && (
                <PropertyFormStep2
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {currentStep === 3 && (
                <PropertyFormStep3
                  onNext={handleNext}
                  onBack={handleBack}
                  displayImages={displayImages}
                  setDisplayImages={setDisplayImages}
                  displayVideos={displayVideos}
                  setDisplayVideos={setDisplayVideos}
                  displayDocuments={displayDocuments}
                  setDisplayDocuments={setDisplayDocuments}
                  maxPhotosPerProperty={maxPhotosPerProperty}
                />
              )}
              {currentStep === 4 && (
                <PropertyFormStep4Sections
                  onNext={handleNext}
                  onBack={handleBack}
                  displayImages={displayImages}
                />
              )}
              {currentStep === 5 && (
                <PropertyFormStep4
                  onSubmit={handleSubmit(handleSubmitInternal)}
                  onBack={handleBack}
                  isSubmitting={isSubmitting}
                />
              )}
            </div>
          </>
        )}

        {view === 'success' && (
          <SuccessDisplay
            title="¡Registro de propiedad exitoso!"
            message="La propiedad ha sido registrada correctamente."
            redirectUrl="/dashboard/properties"
          />
        )}

        {view === 'error' && apiError && (
          <ErrorDisplay
            title="Error en el registro de propiedad"
            message={apiError}
            buttonText="Intentar de nuevo"
            onRetry={() => setView('form')}
          />
        )}
      </Card>
    </FormProvider>
  );
}

