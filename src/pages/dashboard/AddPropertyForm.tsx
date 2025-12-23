import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ArrowLeft, X } from 'lucide-react';
import { PropertyFormStep1 } from '../../components/dashboard/properties/PropertyFormStep1';
import { PropertyFormStep2 } from '../../components/dashboard/properties/PropertyFormStep2';
import { PropertyFormStep3 } from '../../components/dashboard/properties/PropertyFormStep3';
import { PropertyFormStep4 } from '../../components/dashboard/properties/PropertyFormStep4';
import PropertyService from '../../services/PropertyService';
import { PropertyData } from '../../models/properties';
import { SuccessDisplay } from '../../components/ui/SuccessDisplay';
import { ErrorDisplay } from '../../components/ui/ErrorDisplay';
import { Card } from 'flowbite-react';
import { DisplayImage } from '../../components/dashboard/properties/ImageManager';
import { DisplayDocument } from '../../components/dashboard/properties/DocumentManager';
import { DisplayVideo } from '../../components/dashboard/properties/VideoManager';
import { usePropertyQuota } from '../../hooks/usePropertyQuota';
import { useSubscriptionNotifications } from '../../hooks/useSubscriptionNotifications';


const propertyStatusMap: { [key: string]: number } = {
  sale: 0, rent: 1, reserved: 2, sold: 3, unavailable: 4,
};
const areaUnitMap: { [key: string]: number } = {
  'm²': 0, 'ft²': 1, 'yd²': 2, 'acres': 3, 'hectares': 4, 'sq_km': 5, 'sq_mi': 6,
};
const currencyMap: { [key: string]: number } = {
  USD: 0, UYU: 1, BRL: 2, EUR: 3, GBP: 4,
};


const step1Fields: (keyof PropertyFormData)[] = ['streetName', 'houseNumber', 'city', 'state', 'zipCode', 'country', 'location'];
const step2Fields: (keyof PropertyFormData)[] = ['title', 'type', 'areaValue', 'areaUnit', 'bedrooms', 'bathrooms', 'hasGarage', 'garageSpaces'];
const step3Fields: (keyof PropertyFormData)[] = ['description', 'availableFrom', 'capacity', 'currency', 'salePrice', 'rentPrice', 'status', 'hasCommonExpenses', 'commonExpensesValue'];

export const propertyFormSchema = z.object({
  // ESTATE PROPERTY
  // address
  streetName: z.string().min(5, 'La dirección debe tener al menos 5 caracteres.'),
  houseNumber: z.string().min(1, 'El número de casa es requerido.'),
  neighborhood: z.string().optional(),
  city: z.string().min(1, 'La ciudad es requerida.'),
  state: z.string().min(1, 'El estado/provincia es requerido.'),
  zipCode: z.string().min(1, 'El código postal es requerido.'),
  country: z.string().min(1, 'El país es requerido.'),
  location: z.object({ lat: z.number(), lng: z.number() }).refine(val => val.lat !== -34.9011 || val.lng !== -56.1645, {
    message: "Por favor, confirma la ubicación en el mapa.",
  }),
  // description
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres.'),
  type: z.enum(['house', 'apartment', 'commercial', 'land', 'other'], {
    errorMap: () => ({ message: 'El tipo de propiedad es requerido.' }),
  }),
  areaValue: z.coerce.number().min(1, 'El área debe ser al menos 1.'),
  areaUnit: z.enum(['m²', 'ft²', 'yd²', 'acres', 'hectares', 'sq_km', 'sq_mi'], {
    errorMap: () => ({ message: 'La unidad de área es requerida.' }),
  }),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().min(0),
  hasGarage: z.boolean(),
  garageSpaces: z.coerce.number().int().min(0),

  // --- Values (Step 3) ---
  description: z.string().max(500, 'La descripción no puede exceder los 500 caracteres.').optional(),
  availableFrom: z.string().min(1, 'La fecha de disponibilidad es requerida.'),
  // price and status
  currency: z.enum(['USD', 'UYU', 'BRL', 'EUR', 'GBP']),
  salePrice: z.string().optional(),
  rentPrice: z.string().optional(),
  hasCommonExpenses: z.boolean(),
  commonExpensesValue: z.string().optional(),
  isElectricityIncluded: z.boolean(),
  isWaterIncluded: z.boolean(),
  isPriceVisible: z.boolean(),
  status: z.enum(['sale', 'rent', 'reserved', 'sold', 'unavailable']),
  isActive: z.boolean(),
  isPropertyVisible: z.boolean(),

  // --- Amenities ---
  amenities: z.array(z.string()).optional(),

}).refine((data) => data.salePrice || data.rentPrice, {
  message: 'Debes especificar un precio de venta o de alquiler.',
  path: ['salePrice'],
}).refine(data => !data.hasCommonExpenses || (data.hasCommonExpenses && data.commonExpensesValue), {
  message: 'Debes especificar el monto de los gastos comunes.',
  path: ['commonExpensesValue'],
});

export type PropertyFormData = z.infer<typeof propertyFormSchema>;

interface AddPropertyFormProps {
  onClose: () => void;
}

export function AddPropertyForm({ onClose }: AddPropertyFormProps) {
  const [apiError, setApiError] = useState<string | null>(null);
  const [view, setView] = useState<'initial' | 'form' | 'success' | 'error'>('form');
  const [currentStep, setCurrentStep] = useState(1);
  const [wasAutoDowngraded, setWasAutoDowngraded] = useState(false);
  const queryClient = useQueryClient();

  // Property quota management
  const {
    canCreateProperty,
    canPublishProperty,
    isAtPublishedLimit,
    totalLimit,
    publishedLimit,
    ownedCount,
    publishedCount,
    isLoading: isQuotaLoading
  } = usePropertyQuota();

  // Subscription notifications
  const { showWarningNotification } = useSubscriptionNotifications();

  // Check quota limits when component mounts
  useEffect(() => {
    if (!isQuotaLoading && !canCreateProperty) {
      setApiError(`Has alcanzado el límite máximo de ${totalLimit} propiedades. No puedes crear más propiedades.`);
      setView('error');
    }
  }, [isQuotaLoading, canCreateProperty, totalLimit]);

  // --- State Management for Images, Videos, and Documents ---
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const [displayDocuments, setDisplayDocuments] = useState<DisplayDocument[]>([]);
  const [displayVideos, setDisplayVideos] = useState<DisplayVideo[]>([]);
  const methods = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    mode: 'onTouched',
    defaultValues: {
      // --- Address (Step 1) ---
      streetName: '',
      houseNumber: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Uruguay',
      location: { lat: -34.9011, lng: -56.1645 }, // Montevideo

      // --- Description (Step 2) ---
      title: '',
      type: undefined,
      areaValue: 0,
      areaUnit: undefined,
      bedrooms: 1,
      bathrooms: 1,
      hasGarage: false,
      garageSpaces: 0,

      // --- Values (Step 3) ---
      description: '',
      availableFrom: new Date().toISOString().split('T')[0],
      currency: 'USD',
      salePrice: '',
      rentPrice: '',
      hasCommonExpenses: false,
      commonExpensesValue: '',
      isElectricityIncluded: false,
      isWaterIncluded: false,
      isPriceVisible: true,
      status: undefined,
      isActive: true,
      isPropertyVisible: true,

      // --- Amenities ---
      amenities: [],
    },
  });
  const { handleSubmit, trigger, formState: { isSubmitting } } = methods;

  const mutation = useMutation<PropertyData, Error, PropertyFormData>({
    mutationFn: async (data: PropertyFormData): Promise<PropertyData> => {
      setApiError(null);
      setWasAutoDowngraded(false);
      console.log("Form data received for submission:", data);

      // Check hard cap (10 total properties)
      if (!canCreateProperty) {
        throw new Error(`Has alcanzado el límite máximo de ${totalLimit} propiedades. No puedes crear más propiedades.`);
      }

      // Check if user wants to publish but is at published limit
      let modifiedData = { ...data };
      if (data.isPropertyVisible && isAtPublishedLimit) {
        // Auto-downgrade to private/draft
        modifiedData.isPropertyVisible = false;
        setWasAutoDowngraded(true);
        console.log("Auto-downgraded property to private due to published limit");
      }

      // Convert display images/videos to the format expected by PropertyService
      const processedImages = displayImages.map(img => ({
        ...img,
        altText: img.alt || '',
        isPublic: true
      }));

      const processedDocuments = displayDocuments.map(doc => ({
        ...doc,
        name: doc.name || '',
        fileName: doc.fileName || doc.name || '',
        isPublic: true
      }));

      return PropertyService.createProperty(modifiedData, processedImages, processedDocuments);
    },
    onSuccess: (data) => {
      console.log("Property created successfully:", data);
      setApiError(null);
      queryClient.invalidateQueries({ queryKey: ['properties'] });

      // Show warning if property was auto-downgraded
      if (wasAutoDowngraded) {
        showWarningNotification(
          'Propiedad creada como privada',
          `La propiedad "${data.title}" fue creada exitosamente pero se configuró como privada porque has alcanzado el límite de ${publishedLimit} propiedades publicadas de tu plan.`
        );
      }

      setView('success');
    },
    onError: (error: Error) => {
      setView('error');
      setApiError(error.message || 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
      console.error("Submission failed", error.message);
    }
  });

  const addProperty = mutation.mutate;
  const isLoading = mutation.isPending;
  const handleNext = async (fieldsToValidate: (keyof PropertyFormData)[]) => {
    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };
  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };
  const onSubmit = (formData: PropertyFormData) => {
    // Additional validation for quota limits (double-check before submission)
    if (!canCreateProperty) {
      setApiError(`Has alcanzado el límite máximo de ${totalLimit} propiedades. No puedes crear más propiedades.`);
      setView('error');
      return;
    }

    addProperty(formData);
  };
  const handleRetry = () => {
    setApiError(null);
    setView('form');
  };
    
  return (

    <FormProvider {...methods}>
      <Card className="min-h-full">
        {view === 'form' && (
          <>
            <div>
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  {currentStep > 1 && (
                    <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full">
                      <ArrowLeft size={20} />
                    </button>
                  )}
                  <h1 className="text-xl font-semibold">
                    Nueva Propiedad - Paso {currentStep} de 4
                  </h1>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-primary-400/20 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="px-6 flex space-x-1">
                {[1, 2, 3, 4].map(step => (
                  <div
                    key={step}
                    className={`flex-1 h-1 rounded-full ${step <= currentStep ? 'bg-primary-400' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            </div>
            <div className="p-6">
              {currentStep === 1 && <PropertyFormStep1 onNext={() => handleNext(step1Fields)} />}
              {currentStep === 2 && <PropertyFormStep2 onNext={() => handleNext(step2Fields)} onBack={handleBack} />}
              {currentStep === 3 && (
                <PropertyFormStep3 
                  onNext={() => handleNext(step3Fields)} 
                  onBack={handleBack}
                  displayImages={displayImages}
                  setDisplayImages={setDisplayImages}
                  displayVideos={displayVideos}
                  setDisplayVideos={setDisplayVideos}
                />
              )}
              {currentStep === 4 && (
                <PropertyFormStep4
                  onSubmit={handleSubmit(
                    onSubmit,
                    (errors) => {
                      console.error("Form validation failed:", errors);
                    }
                  )}
                  onBack={handleBack}
                  isSubmitting={isLoading || isSubmitting}
                  displayDocuments={displayDocuments}
                  setDisplayDocuments={setDisplayDocuments}
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
            onRetry={handleRetry}
          />
        )}
      </Card>
    </FormProvider>
  );
}