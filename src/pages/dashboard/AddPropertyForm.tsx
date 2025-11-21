import { useState } from 'react';
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
const step3Fields: (keyof PropertyFormData)[] = ['description', 'availableFrom', 'arePetsAllowed', 'capacity', 'currency', 'salePrice', 'rentPrice', 'status', 'hasCommonExpenses', 'commonExpensesValue'];

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
  arePetsAllowed: z.boolean(),
  capacity: z.coerce.number().int().min(1, 'La capacidad debe ser al menos 1.'),
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
  const queryClient = useQueryClient();

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
      arePetsAllowed: false,
      capacity: 1,
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
      console.log("Form data received for submission:", data);

      const formData = new FormData();

      // Address
      formData.append('StreetName', data.streetName);
      formData.append('HouseNumber', data.houseNumber);
      if (data.neighborhood) {
        formData.append('Neighborhood', data.neighborhood);
      }
      formData.append('City', data.city);
      formData.append('State', data.state);
      formData.append('ZipCode', data.zipCode);
      formData.append('Country', data.country);
      // For complex objects, send as a JSON string. The backend model binder
      // will need to be configured to deserialize this string.
      formData.append('Location', JSON.stringify(data.location));

      // Description
      formData.append('Title', data.title);
      formData.append('Type', data.type);
      formData.append('AreaValue', String(data.areaValue));
      formData.append('AreaUnit', String(areaUnitMap[data.areaUnit]));
      formData.append('Bedrooms', String(data.bedrooms));
      formData.append('Bathrooms', String(data.bathrooms));
      formData.append('HasGarage', String(data.hasGarage));
      formData.append('GarageSpaces', String(data.garageSpaces));

      // Values
      if (data.description) {
        formData.append('Description', data.description);
      }
      formData.append('AvailableFrom', data.availableFrom); // ISO string is perfect for DateTime
      formData.append('ArePetsAllowed', String(data.arePetsAllowed));
      formData.append('Capacity', String(data.capacity));

      // Price and status
      formData.append('Currency', String(currencyMap[data.currency]));
      if (data.salePrice) {
        formData.append('SalePrice', data.salePrice);
      }
      if (data.rentPrice) {
        formData.append('RentPrice', data.rentPrice);
      }
      formData.append('HasCommonExpenses', String(data.hasCommonExpenses));
      if (data.commonExpensesValue) {
        formData.append('commonExpensesValue', data.commonExpensesValue);
      }
      formData.append('IsElectricityIncluded', String(data.isElectricityIncluded));
      formData.append('IsWaterIncluded', String(data.isWaterIncluded));
      formData.append('IsPriceVisible', String(data.isPriceVisible));
      formData.append('Status', String(propertyStatusMap[data.status]));
      formData.append('IsActive', String(data.isActive));
      formData.append('IsPropertyVisible', String(data.isPropertyVisible));
      
      // Images
      if (displayImages && displayImages.length > 0) {
        displayImages.forEach((imgData: DisplayImage, index: number) => {
          let imageId = imgData.id || crypto.randomUUID();
          
          if (imgData.id?.startsWith('temp-'))
            imageId = crypto.randomUUID();

          formData.append(`PropertyImages[${index}].Id`, imageId);
          formData.append(`PropertyImages[${index}].AltText`, imgData.alt || '');
          formData.append(`PropertyImages[${index}].IsMain`, imgData.isMain ? 'true' : 'false');
          formData.append(`PropertyImages[${index}].EstatePropertyId`, 'temp-property-id'); // Will be set by backend
          formData.append(`PropertyImages[${index}].IsPublic`, 'true');
          formData.append(`PropertyImages[${index}].FileName`, imgData.alt || '');

          if (imgData.source === 'existing' && imgData.previewUrl)
            formData.append(`PropertyImages[${index}].Url`, imgData.previewUrl);

          if (imgData.file)
            formData.append(`PropertyImages[${index}].File`, imgData.file);

          if (imgData.isMain)
            formData.append('MainImageId', imageId);
        });
      }

      // Documents
      if (displayDocuments && displayDocuments.length > 0) {
        displayDocuments.forEach((docData: DisplayDocument, index: number) => {
          let docId = docData.id || crypto.randomUUID();
          
          if (docData.id?.startsWith('temp-'))
            docId = crypto.randomUUID();

          formData.append(`PropertyDocuments[${index}].Id`, docId);
          formData.append(`PropertyDocuments[${index}].Name`, docData.name || '');
          formData.append(`PropertyDocuments[${index}].EstatePropertyId`, 'temp-property-id'); // Will be set by backend
          formData.append(`PropertyDocuments[${index}].FileName`, docData.fileName || docData.name || '');
          formData.append(`PropertyDocuments[${index}].IsPublic`, 'true');

          if (docData.url)
            formData.append(`PropertyDocuments[${index}].Url`, docData.url);

          if (docData.file)
            formData.append(`PropertyDocuments[${index}].File`, docData.file);
        });
      }

      // Videos
      if (displayVideos && displayVideos.length > 0) {
        displayVideos.forEach((videoData: DisplayVideo, index: number) => {
          let videoId = videoData.id || crypto.randomUUID();
          
          if (videoData.id?.startsWith('temp-'))
            videoId = crypto.randomUUID();

          formData.append(`PropertyVideos[${index}].Id`, videoId);
          formData.append(`PropertyVideos[${index}].Title`, videoData.title || '');
          formData.append(`PropertyVideos[${index}].Description`, videoData.description || '');
          formData.append(`PropertyVideos[${index}].Url`, videoData.url || '');
          formData.append(`PropertyVideos[${index}].EstatePropertyId`, 'temp-property-id'); // Will be set by backend
          formData.append(`PropertyVideos[${index}].IsPublic`, 'true');
        });
      }

      // Amenities
      if (data.amenities && data.amenities.length > 0) {
        data.amenities.forEach((amenityId, index) => {
          formData.append(`Amenities[${index}].Id`, amenityId);
        });
      }

      for (let [key, value] of formData.entries()) {
        console.log(`FormData -> ${key}:`, value);
      }

      return PropertyService.createProperty(formData);
    },
    onSuccess: (data) => {
      console.log("Property created successfully:", data);
      setApiError(null);
      queryClient.invalidateQueries({ queryKey: ['properties'] });
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