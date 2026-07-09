import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { Button, Card } from 'flowbite-react';
import { PropertyFormStep1 } from './PropertyFormStep1';
import { PropertyFormStep2 } from './PropertyFormStep2';
import { PropertyFormStep3 } from './PropertyFormStep3';
import { PropertyFormStep4Sections } from './PropertyFormStep4Sections';
import { propertyFormSchema, PropertyFormData } from '../../../models/properties/PropertyFormSchema';
import propertyService from '../../../services/PropertyService';
import type { DisplayImage } from './ImageManager';
import type { DisplayDocument } from './DocumentManager';
import type { DisplayVideo } from './VideoManager';
import type { ListingType, PropertyType } from '../../../models/properties/PropertyData';
import { getActiveModalitiesLabelsEs, listingTypeToFormPropertyType } from '../../../models/properties/propertyTypeLabels';
import { amenityDescriptionsFromAmenities } from '../../../models/properties/amenityDescriptions';
import { resolveAssetUrl } from '../../../utils/resolveAssetUrl';

export function PropertyEditPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const [displayDocuments, setDisplayDocuments] = useState<DisplayDocument[]>([]);
  const [displayVideos, setDisplayVideos] = useState<DisplayVideo[]>([]);

  const methods = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema as any),
    mode: 'onTouched',
    defaultValues: {
      location: { lat: -34.9011, lng: -56.1645 },
      contentSections: [],
      propertyPolicies: [],
      hasGarage: false,
      isActive: true,
      blockedForBooking: false,
    } as any,
  });

  const { handleSubmit, reset, watch } = methods;

  const { data: property, isLoading, isError, error } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getOwnersPropertyById(propertyId!),
    enabled: !!propertyId,
  });

  const activeListingTypesForEdit = useMemo((): ListingType[] => {
    if (!property) return [];
    const fromProp = (property as any).activeListingTypes as ListingType[] | undefined;
    if (fromProp?.length) return fromProp;
    const single = (property as any).listingType as ListingType | undefined;
    if (single) return [single];
    return ['RealEstate'];
  }, [property]);

  useEffect(() => {
    if (!property) return;
    const lt = (property as any).listingType as ListingType | undefined;
    const inferredPropertyType: PropertyType = lt ? listingTypeToFormPropertyType(lt) : 'RealEstate';

    reset({
      streetName: (property as any).streetName ?? '',
      houseNumber: (property as any).houseNumber ?? '',
      neighborhood: (property as any).neighborhood ?? '',
      city: (property as any).city ?? '',
      state: (property as any).state ?? '',
      zipCode: (property as any).zipCode ?? '',
      country: (property as any).country ?? '',
      location: (property as any).location ?? { lat: -34.9011, lng: -56.1645 },
      title: (property as any).title ?? '',
      description: (property as any).description ?? '',
      propertyType: inferredPropertyType,
      listingType: lt,
      areaValue: (property as any).areaValue ?? 1,
      areaUnit: (property as any).areaUnit ?? 'm²',
      bedrooms: (property as any).bedrooms ?? 0,
      bathrooms: (property as any).bathrooms ?? 0,
      hasGarage: (property as any).hasGarage ?? false,
      garageSpaces: (property as any).garageSpaces ?? 0,
      amenities: ((property as any).amenities || []).map((a: any) => a.id),
      amenityDescriptions: amenityDescriptionsFromAmenities((property as any).amenities || []),
      contentSections: ((property as any).contentSections ?? []),
      propertyPolicies: ((property as any).propertyPolicies ?? []),
      additionalExtensionType: undefined,
      allowsFinancing: (property as any).allowsFinancing ?? false,
      isNewConstruction: (property as any).isNewConstruction ?? false,
      hasMortgage: (property as any).hasMortgage ?? false,
      hoaFees: (property as any).hoaFees,
      minContractMonths: (property as any).minContractMonths,
      requiresGuarantee: (property as any).requiresGuarantee ?? false,
      guaranteeType: (property as any).guaranteeType ?? '',
      allowsPets: (property as any).allowsPets ?? false,
      minStayDays: (property as any).minStayDays,
      maxStayDays: (property as any).maxStayDays,
      leadTimeDays: (property as any).leadTimeDays,
      bufferDays: (property as any).bufferDays,
      maxGuests: (property as any).maxGuests,
      hasCatering: (property as any).hasCatering ?? false,
      hasSoundSystem: (property as any).hasSoundSystem ?? false,
      closingHour: (property as any).closingHour ?? '',
      allowedEventsDescription: (property as any).allowedEventsDescription ?? '',
    } as any);

    setDisplayImages(
      ((property as any).propertyImages || []).map((img: any) => ({
        key: img.id,
        id: img.id,
        source: 'existing',
        previewUrl: resolveAssetUrl(img.url),
        alt: img.altText || '',
        isMain: !!img.isMain,
      }))
    );
    setDisplayDocuments(
      ((property as any).propertyDocuments || []).map((doc: any) => ({
        key: doc.id,
        id: doc.id,
        source: 'existing',
        url: resolveAssetUrl(doc.url),
        name: doc.name || '',
        fileName: doc.fileName || doc.name || '',
        fileType: 'pdf',
      }))
    );
    setDisplayVideos(
      ((property as any).propertyVideos || []).map((video: any) => ({
        key: video.id,
        id: video.id,
        source: 'existing',
        title: video.title || '',
        description: video.description || '',
        url: video.url || '',
      }))
    );
  }, [property, reset]);

  const onSubmit = async (formData: PropertyFormData) => {
    if (!propertyId) return;
    try {
      setIsSaving(true);
      setApiError(null);
      await propertyService.updatePropertyWizard(propertyId, formData, displayImages, displayDocuments);
      if (formData.additionalExtensionType) {
        await propertyService.addPropertyExtension(propertyId, formData.additionalExtensionType, formData);
      }
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      navigate('/dashboard/properties');
    } catch (e: any) {
      setApiError(e.message || 'No se pudieron guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!propertyId) return <div className="mt-8 text-center text-red-600">No se encontro la propiedad.</div>;
  if (isLoading) return <div className="mt-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (isError) return <div className="mt-8 text-center text-red-600">{(error as Error).message}</div>;

  const stepCount = 4;
  const propertyType = watch('propertyType');
  const modalityLabels = getActiveModalitiesLabelsEs(activeListingTypesForEdit);

  return (
    <FormProvider {...methods}>
      <Card className="min-h-full">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button onClick={() => setCurrentStep(s => Math.max(1, s - 1))} className="rounded-full p-2 hover:bg-gray-100">
                <ArrowLeft size={18} />
              </button>
            )}
            <h1 className="text-xl font-semibold">Editar propiedad - Paso {currentStep} de {stepCount}</h1>
          </div>
        </div>
        <div className="px-6 flex gap-1">
          {Array.from({ length: stepCount }, (_, i) => i + 1).map(step => (
            <div key={step} className={`h-1 flex-1 rounded-full ${step <= currentStep ? 'bg-primary-400' : 'bg-gray-200'}`} />
          ))}
        </div>
        <div className="p-6">
          {apiError && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{apiError}</div>}
          {modalityLabels.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Modalidades activas</p>
              <ul className="flex flex-wrap gap-2">
                {modalityLabels.map((label, i) => (
                  <li key={`${label}-${i}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-800">
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {currentStep === 1 && <PropertyFormStep1 onNext={() => setCurrentStep(2)} skipMapConfirmation />}
          {currentStep === 2 && (
            <PropertyFormStep2
              onBack={() => setCurrentStep(1)}
              onNext={() => setCurrentStep(3)}
              editMode
              basePropertyType={propertyType as PropertyType}
              activeListingTypes={activeListingTypesForEdit}
            />
          )}
          {currentStep === 3 && (
            <PropertyFormStep3
              onBack={() => setCurrentStep(2)}
              onNext={() => setCurrentStep(4)}
              displayImages={displayImages}
              setDisplayImages={setDisplayImages}
              displayVideos={displayVideos}
              setDisplayVideos={setDisplayVideos}
              displayDocuments={displayDocuments}
              setDisplayDocuments={setDisplayDocuments}
            />
          )}
          {currentStep === 4 && (
            <PropertyFormStep4Sections
              onBack={() => setCurrentStep(3)}
              displayImages={displayImages}
              allowedListingTypes={activeListingTypesForEdit}
              hideNextButton
              footerExtra={
                <>
                  <Button color="alternative" onClick={() => navigate(-1)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSubmit(onSubmit)} disabled={isSaving}>
                    <Save size={16} className="mr-2" />
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </>
              }
            />
          )}
        </div>
      </Card>
    </FormProvider>
  );
}
