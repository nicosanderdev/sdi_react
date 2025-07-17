import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ArrowLeft, X } from 'lucide-react';
import { PropertyFormStep1 } from './PropertyFormStep1';
import { PropertyFormStep2 } from './PropertyFormStep2';
import { PropertyFormStep3 } from './PropertyFormStep3';
import { PropertyFormStep4 } from './PropertyFormStep4';
import PropertyService, { PropertyData } from '../../services/PropertyService';
import { SuccessDisplay } from '../ui/SuccessDisplay';
import { ErrorDisplay } from '../ui/ErrorDisplay';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_DOC_TYPES = [
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png"
];

const propertyStatusMap: { [key: string]: number } = {
  sale: 0, rent: 1, reserved: 2, sold: 3, unavailable: 4,
};
const areaUnitMap: { [key: string]: number } = {
  'm²': 0, 'ft²': 1, 'yd²': 2, 'acres': 3, 'hectares': 4, 'sq_km': 5, 'sq_mi': 6,
};
const currencyMap: { [key: string]: number } = {
  USD: 0, UYU: 1, BRL: 2, EUR: 3, GBP: 4,
};

const optionalFileSchema = z.preprocess(
  (val) => (val instanceof FileList && val.length > 0 ? val[0] : undefined),
  z.instanceof(File, { message: "Input not instance of File" })
    .refine((file) => file.size <= MAX_FILE_SIZE, `El tamaño máximo del archivo es 5MB.`)
    .refine((file) => ACCEPTED_DOC_TYPES.includes(file.type), "Formato de archivo no válido.")
    .optional()
    .nullable()
);

const requiredFileSchema = z.preprocess(
  (val) => (val instanceof FileList && val.length > 0 ? val[0] : undefined),
  z.instanceof(File, { message: "El archivo es requerido." })
    .refine((file) => file.size <= MAX_FILE_SIZE, `El tamaño máximo del archivo es 5MB.`)
    .refine((file) => ACCEPTED_DOC_TYPES.includes(file.type), "Formato de archivo no válido.")
);

const imageFileSchema = z.instanceof(File, { message: "El archivo de imagen es requerido." })
  .refine((file) => file.size <= MAX_FILE_SIZE, `El tamaño máximo de la imagen es 5MB.`)
  .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
    "Solo se aceptan formatos .jpg, .jpeg, .png y .webp."
  );

const imageArraySchema = z.preprocess(
  (val) => (val instanceof FileList ? Array.from(val) : val),
  z.array(imageFileSchema).min(1, 'Debes subir al menos una imagen.').max(15, 'Puedes subir un máximo de 15 imágenes.')
);

const documentSchema = z.object({
  file: requiredFileSchema,
  name: z.string().min(1, 'El nombre del documento es requerido.'),
});

const step1Fields: (keyof PropertyFormData)[] = ['streetName', 'houseNumber', 'city', 'state', 'zipCode', 'country', 'location'];
const step2Fields: (keyof PropertyFormData)[] = ['title', 'type', 'areaValue', 'areaUnit', 'bedrooms', 'bathrooms', 'hasGarage', 'garageSpaces'];
const step3Fields: (keyof PropertyFormData)[] = ['description', 'availableFrom', 'arePetsAllowed', 'capacity', 'currency', 'salePrice', 'rentPrice', 'status', 'hasCommonExpenses', 'commonExpensesAmount'];

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
  commonExpensesAmount: z.string().optional(),
  isElectricityIncluded: z.boolean(),
  isWaterIncluded: z.boolean(),
  isPriceVisible: z.boolean(),
  status: z.enum(['sale', 'rent', 'reserved', 'sold', 'unavailable']),
  isActive: z.boolean(),
  isPropertyVisible: z.boolean(),
  mainImageUrl: z.string().min(1, 'Debes seleccionar una imagen principal.'),
  images: imageArraySchema,

  // --- Documents (Step 4) ---
  // Use the pre-processing schemas here
  publicDeed: optionalFileSchema,
  propertyPlans: optionalFileSchema,
  taxReceipts: optionalFileSchema,
  otherDocuments: z.array(documentSchema).optional(),

}).refine((data) => data.salePrice || data.rentPrice, {
  message: 'Debes especificar un precio de venta o de alquiler.',
  path: ['salePrice'],
}).refine(data => !data.hasCommonExpenses || (data.hasCommonExpenses && data.commonExpensesAmount), {
  message: 'Debes especificar el monto de los gastos comunes.',
  path: ['commonExpensesAmount'],
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
      commonExpensesAmount: '',
      isElectricityIncluded: false,
      isWaterIncluded: false,
      isPriceVisible: true,
      status: undefined,
      isActive: true,
      isPropertyVisible: true,
      images: [],
      mainImageUrl: '',

      // --- Documents (Step 4) ---
      publicDeed: undefined,
      propertyPlans: undefined,
      taxReceipts: undefined,
      otherDocuments: [],
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
      if (data.commonExpensesAmount) {
        formData.append('CommonExpensesAmount', data.commonExpensesAmount);
      }
      formData.append('IsElectricityIncluded', String(data.isElectricityIncluded));
      formData.append('IsWaterIncluded', String(data.isWaterIncluded));
      formData.append('IsPriceVisible', String(data.isPriceVisible));
      formData.append('Status', String(propertyStatusMap[data.status]));
      formData.append('IsActive', String(data.isActive));
      formData.append('IsPropertyVisible', String(data.isPropertyVisible));
      // Images (IFormFile[])
      if (data.images && data.images.length > 0) {
        data.images.forEach(file => formData.append('Images', file));
      }
      formData.append('MainImageUrl', data.mainImageUrl);

      // --- Handle Files ---
      // Documents (IFormFile[])
      // Gather all potential document files into one array first.
      const allDocumentFiles: File[] = [];
      if (data.publicDeed) allDocumentFiles.push(data.publicDeed);
      if (data.propertyPlans) allDocumentFiles.push(data.propertyPlans);
      if (data.taxReceipts) allDocumentFiles.push(data.taxReceipts);
      if (data.otherDocuments) {
        data.otherDocuments.forEach(doc => allDocumentFiles.push(doc.file));
      }

      if (allDocumentFiles.length > 0) {
        console.log(`Appending ${allDocumentFiles.length} files to FormData under the key 'Documents'.`);
        allDocumentFiles.forEach((file) => {
          formData.append('Documents', file);
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
      <div className="bg-[#FDFFFC] min-h-full">
        {view === 'form' && (
          <>
            <div className="border-b border-gray-200">
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  {currentStep > 1 && (
                    <button onClick={handleBack} className="mr-4 p-2 hover:bg-gray-100 rounded-full">
                      <ArrowLeft size={20} className="text-[#101828]" />
                    </button>
                  )}
                  <h1 className="text-xl font-semibold text-[#101828]">
                    Nueva Propiedad - Paso {currentStep} de 4
                  </h1>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} className="text-[#101828]" />
                </button>
              </div>
              <div className="px-6 flex space-x-1">
                {[1, 2, 3, 4].map(step => (
                  <div
                    key={step}
                    className={`flex-1 h-1 rounded-full ${step <= currentStep ? 'bg-[#62B6CB]' : 'bg-gray-200'}`}
                  />
                ))}
              </div>
            </div>
            <div className="p-6">
              {currentStep === 1 && <PropertyFormStep1 onNext={() => handleNext(step1Fields)} />}
              {currentStep === 2 && <PropertyFormStep2 onNext={() => handleNext(step2Fields)} onBack={handleBack} />}
              {currentStep === 3 && <PropertyFormStep3 onNext={() => handleNext(step3Fields)} onBack={handleBack} />}
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
      </div>
    </FormProvider>
  );
}