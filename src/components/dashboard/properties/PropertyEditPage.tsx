// src/pages/PropertyEditPage.tsx

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    MapPin, Home, BedDouble, Bath, Car, DollarSign, Calendar, Dog,
    Users, Building, Eye, EyeOff, Wrench, Info,
    Loader2, Mailbox, Globe, Landmark, Building2, Hash
} from 'lucide-react';
import propertyService from '../../../services/PropertyService';
import { Button, Card, Checkbox, Label, Select, TextInput } from 'flowbite-react';
import { PropertyData, PropertyDocument, PropertyImage, PropertyVideo, Amenity } from '../../../models/properties';
import { ImageManager, DisplayImage } from './ImageManager';
import { DocumentManager, DisplayDocument } from './DocumentManager';
import { VideoManager, DisplayVideo } from './VideoManager';
import { usePropertyQuota } from '../../../hooks/usePropertyQuota';
import { useSubscriptionNotifications } from '../../../hooks/useSubscriptionNotifications';

const propertyStatusMap: Record<string, number> = { 'Sale': 0, 'Rent': 1, 'Sold': 2, 'Reserved': 3, 'Unavailable': 4 };
const currencyMap: Record<string, number> = { 'USD': 0, 'UYU': 1, 'BRL': 2, 'EUR': 3, 'CLP': 4 };
const areaUnitMap: Record<string, number> = { 'm²': 0, 'ft²': 1, 'yd²': 2, 'acres': 3, 'hectares': 4, 'km²': 5, 'mi²': 6 };

const FormField: React.FC<{ icon?: React.ReactNode; label: string; children: React.ReactNode; error?: string }> = ({ icon, label, children, error }) => (
    <div className='flex items-start space-x-1 w-full'>
        {icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#BEE9E8] flex items-center justify-center mr-4 mt-6">
                {icon}
            </div>
        )}
        <div className='w-full'>
            <Label>{label}</Label>
            <div className='mt-1'>
                {children}
            </div>
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        </div>
    </div>
);


export function PropertyEditPage() {
    const { propertyId } = useParams<{ propertyId: string }>();
    if (!propertyId) {
        return <div className="text-center text-red-500 mt-10">No property ID provided.</div>;
    }

    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<PropertyData>();

    // Property quota management
    const {
      canPublishProperty,
      isAtPublishedLimit,
      publishedLimit,
      publishedCount,
      isLoading: isQuotaLoading
    } = usePropertyQuota();

    // Subscription notifications
    const { showWarningNotification } = useSubscriptionNotifications();

    // --- State Management ---
    const API_BASE_URL = import.meta.env.VITE_API_BASE_FILES_URL || '';
    const [apiError, setApiError] = useState<string | null>(null);
    const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
    const [displayDocuments, setDisplayDocuments] = useState<DisplayDocument[]>([]);
    const [displayVideos, setDisplayVideos] = useState<DisplayVideo[]>([]);
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
    const hasGarage = watch("hasGarage");
    const isPropertyVisible = watch("isPropertyVisible");

    // --- Data Fetching ---
    const { data: property, isLoading, isError, error: queryError } = useQuery<PropertyData, Error>({
        queryKey: ['property', propertyId],
        queryFn: () => propertyService.getOwnersPropertyById(propertyId!),
        enabled: !!propertyId,
    });

    const { data: allAmenities, isLoading: isLoadingAmenities } = useQuery({
        queryKey: ['amenities'],
        queryFn: () => propertyService.getAmenities(),
    });

    // --- MUTATION HOOK ---
    const { mutate: updateProperty, isPending: isSaving } = useMutation<
        PropertyData,
        Error,
        { id: string; payload: PropertyData }
    >({
        mutationFn: async ({ id, payload }): Promise<PropertyData> => {
            setApiError(null);
            console.log("Payload received for update:", payload);

            // Check if trying to publish when at published limit
            const currentIsVisible = property?.isPropertyVisible || false;
            const newIsVisible = payload.isPropertyVisible || false;
            
            // Only check limit if changing from unpublished to published
            if (!currentIsVisible && newIsVisible && isAtPublishedLimit) {
                throw new Error(`Your plan limits have reached. You cannot publish more than ${publishedLimit} properties.`);
            }

            // Convert PropertyData to PropertyFormData structure
            const formData: PropertyFormData = {
                streetName: payload.streetName,
                houseNumber: payload.houseNumber,
                neighborhood: payload.neighborhood,
                city: payload.city,
                state: payload.state,
                zipCode: payload.zipCode,
                country: payload.country,
                location: payload.location,
                title: payload.title,
                type: payload.type as 'house' | 'apartment' | 'commercial' | 'land' | 'other',
                areaValue: payload.areaValue,
                areaUnit: payload.areaUnit as 'm²' | 'ft²' | 'yd²' | 'acres' | 'hectares' | 'sq_km' | 'sq_mi',
                bedrooms: payload.bedrooms,
                bathrooms: payload.bathrooms,
                hasGarage: payload.hasGarage,
                garageSpaces: payload.garageSpaces,
                description: payload.description,
                availableFrom: payload.availableFrom.toISOString().split('T')[0], // Convert to date string
                currency: payload.currency as 'USD' | 'UYU' | 'BRL' | 'EUR' | 'GBP',
                salePrice: payload.salePrice,
                rentPrice: payload.rentPrice,
                hasCommonExpenses: payload.hasCommonExpenses,
                commonExpensesValue: payload.commonExpensesValue,
                isElectricityIncluded: payload.isElectricityIncluded,
                isWaterIncluded: payload.isWaterIncluded,
                isPriceVisible: payload.isPriceVisible,
                status: payload.status as 'sale' | 'rent' | 'reserved' | 'sold' | 'unavailable',
                isActive: payload.isActive,
                isPropertyVisible: payload.isPropertyVisible,
                amenities: payload.amenities.map(a => a.id)
            };

            // Convert property images/documents to DisplayImage/DisplayDocument format
            const displayImages: DisplayImage[] = payload.propertyImages.map(img => ({
                id: img.id,
                source: 'existing' as const,
                previewUrl: img.url,
                alt: img.altText,
                isMain: img.isMain
            }));

            const displayDocuments: DisplayDocument[] = (payload.propertyDocuments || []).map(doc => ({
                id: doc.id,
                source: 'existing' as const,
                url: doc.url,
                name: doc.name,
                fileName: doc.fileName
            }));

            return propertyService.updateProperty(id, formData, displayImages, displayDocuments);
        },
        onSuccess: (updatedProperty) => {
            console.log("Property updated successfully:", updatedProperty);
            setApiError(null);
            queryClient.invalidateQueries({ queryKey: ['properties'] });
            queryClient.invalidateQueries({ queryKey: ['property', updatedProperty.id] });
            navigate(`/dashboard/property/${updatedProperty.id}/edit`);
        },
        onError: (error: Error) => {
            console.error("Update failed:", error);
            setApiError(error.message || 'An unexpected error occurred.');
        },
    });

    useEffect(() => {
        if (property) {
            const isValidDate = property.availableFrom != null;
            const formattedDate = isValidDate ? new Date(property.availableFrom).toISOString().slice(0, 10) : '';

            const formData = {
                ...property,
                availableFromText: formattedDate,
                hasCommonExpenses: property.hasCommonExpenses,
                isWaterIncluded: property.isWaterIncluded,
                isElectricityIncluded: property.isElectricityIncluded,
                isPriceVisible: property.isPriceVisible,
                isActive: property.isActive,
                isPropertyVisible: property.isPropertyVisible,
                salePrice: property.salePrice ?? '',
                rentPrice: property.rentPrice ?? '',
                commonExpensesValue: property.commonExpensesValue ?? '',
            };

            reset(formData);

            if (property.propertyImages) {
                setDisplayImages(property.propertyImages.map((img: any) => ({
                    key: img.id!, id: img.id, source: 'existing', isMain: img.id === property.mainImageId,
                    previewUrl: `${API_BASE_URL}${img.url.startsWith('/') ? '' : '/'}${img.url}`,
                    alt: img.altText || 'Property Image',
                })));
            }
            if (property.propertyDocuments) {
                setDisplayDocuments(property.propertyDocuments.map((doc: any) => ({
                    key: doc.id!, 
                    id: doc.id, 
                    source: 'existing', 
                    name: doc.name, 
                    fileName: doc.name,
                    fileType: "pdf",
                    url: `${API_BASE_URL}${doc.url.startsWith('/') ? '' : '/'}${doc.url}`,
                })));
            }
            if (property.propertyVideos) {
                setDisplayVideos(property.propertyVideos.map((video: any) => ({
                    key: video.id!, 
                    id: video.id, 
                    source: 'existing', 
                    title: video.title || '',
                    description: video.description || '',
                    url: video.url,
                })));
            }
            if (property.amenities) {
                setSelectedAmenities(property.amenities.map((amenity: any) => amenity.id));
            }
        }
    }, [property, reset, API_BASE_URL]);


    // --- SUBMIT HANDLER ---
    const onSubmit = (formValues: PropertyData) => {
        if (!propertyId) return;

        const mainImage = displayImages.find(img => img.isMain);
        
        const propertyImages = displayImages.map(img => ({
            id: img.id,
            file: img.file,
            url: img.source === 'existing' ? img.previewUrl : '',
            altText: img.alt,
            isMain: img.isMain,
            ...(img.source === 'new' && !img.id && { id: `temp-${img.key}` })
        }));
        
        const propertyDocuments = displayDocuments.map(doc => ({
            id: doc.id,
            file: doc.file,
            url: (doc.source === 'existing' ? doc.url : '') || '',
            name: doc.name,
            estatePropertyId: formValues.id,
            fileName: doc.fileName,
            isPublic: true,
            ...(doc.source === 'new' && !doc.id && { id: `temp-${doc.key}` })
        }));

        const propertyVideos = displayVideos.map(video => ({
            id: video.id,
            url: video.url || '',
            title: video.title,
            description: video.description,
            estatePropertyId: formValues.id,
            isPublic: true,
            ...(video.source === 'new' && !video.id && { id: `temp-${video.key}` })
        }));

        const selectedAmenitiesData = allAmenities?.filter(amenity => 
            selectedAmenities.includes(amenity.id)
        ) || [];

        const payload: PropertyData = {
            ...formValues,
            propertyImages,
            mainImageId: mainImage?.source === 'existing' ? mainImage.id : undefined,
            propertyDocuments,
            propertyVideos,
            amenities: selectedAmenitiesData
        };
        updateProperty({ id: propertyId, payload });
    };


    // --- LOADING & ERROR HANDLING ---
    if (isLoading) return
        <div className="flex justify-center items-center min-h-screen">
            <Loader2 className="animate-spin" size={48} />
        </div>;
    
    if (isError && queryError) return
        <div className="text-center text-red-500 mt-10">
            Error: {queryError!}
        </div>;
    
    if (!property) return 
        <div className="text-center text-gray-600 mt-10">Propiedad no encontrada.</div>;

    return (
        <>
            <form onSubmit={handleSubmit(onSubmit)}>
                <Card className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-2">
                        <h1 className="text-3xl font-semibold">{property.title}</h1>
                    </div>

                    {/* --- API Error Display --- */}
                    {apiError && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                            <strong className="font-bold mr-2">Error!</strong>
                            <span className="block sm:inline">{apiError}</span>
                        </div>
                    )}

                    {/* --- Section: General info -- */}
                    <div className="p-4 md:p-6 flex justify-center border-t border-gray-200">
                        <div className="flex flex-col items-center w-[50%] gap-y-4 mb-8">

                            <FormField
                                icon={<Home size={20} className="text-[#1B4965]" />}
                                label="Título de la Publicación"
                                error={errors.title?.message}>
                                <TextInput
                                    {...register("title", { required: "El título es obligatorio" })}
                                />
                            </FormField>

                            <FormField
                                icon={<Home size={20} className="text-[#1B4965]" />}
                                label="Descripición"
                                error={errors.description?.message}>
                                <TextInput type='area'
                                    {...register("description")} />
                            </FormField>

                            <FormField
                                icon={<Home size={20} className="text-[#1B4965]" />}
                                label="Tipo de Propiedad"
                                error={errors.type?.message}>
                                <Select {...register("type", { required: "Debe seleccionar un tipo" })}>
                                    <option value="">Seleccione una opción...</option>
                                    <option value="Apartment">Apartamento</option>
                                    <option value="House">Casa</option>
                                    <option value="Commercial">Comercial</option>
                                    <option value="Land">Terreno</option>
                                    <option value="Other">Otro</option>
                                </Select>
                            </FormField>

                            <FormField
                                icon={<Building size={20} className="text-[#1B4965]" />}
                                label="Área Total"
                                error={errors.areaValue?.message || errors.areaUnit?.message}>
                                <div className="flex items-center space-x-2">
                                    <TextInput
                                        type="number"
                                        placeholder="120"
                                        {...register("areaValue", { required: "El área es obligatoria", valueAsNumber: true })}
                                        className='w-2/3' />
                                    <Select {...register("areaUnit", { required: "La unidad es obligatoria" })} className='w-1/3'>
                                        <option value="0">m²</option>
                                        <option value="1">ft²</option>
                                        <option value="2">yd²</option>
                                        <option value="3">acres</option>
                                        <option value="4">hectares</option>
                                        <option value="5">km²</option>
                                        <option value="6">mi²</option>
                                    </Select>
                                </div>
                            </FormField>

                            <FormField
                                icon={<BedDouble size={20} className="text-[#1B4965]" />}
                                label="Dormitorios"
                                error={errors.bedrooms?.message}>
                                <TextInput
                                    type="number"
                                    {...register("bedrooms", { required: "Campo obligatorio", valueAsNumber: true, min: 0 })}
                                />
                            </FormField>

                            <FormField
                                icon={<Bath size={20} className="text-[#1B4965]" />}
                                label="Baños"
                                error={errors.bathrooms?.message}>
                                <TextInput
                                    type="number"
                                    {...register("bathrooms", { required: "Campo obligatorio", valueAsNumber: true, min: 0 })} />
                            </FormField>

                            <FormField
                                icon={<Car size={20} className="text-[#1B4965]" />}
                                label="Garage"
                                error={errors.garageSpaces?.message}>
                                <div className="flex flex-col space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox {...register("hasGarage")} id="hasGarage" />
                                        <Label htmlFor="hasGarage">Tiene garage</Label>
                                    </div>
                                    {hasGarage && (
                                        <TextInput
                                            type="number"
                                            placeholder="Número de espacios"
                                            {...register("garageSpaces", {
                                                required: "Debe indicar el número de espacios",
                                                valueAsNumber: true,
                                                min: { value: 1, message: "Debe ser al menos 1" }
                                            })}
                                        />
                                    )}
                                </div>
                            </FormField>

                            <FormField
                                icon={<Users size={20} className="text-[#1B4965]" />}
                                label="Capacidad (personas)"
                                error={errors.capacity?.message}>
                                <TextInput
                                    type="number"
                                    {...register("capacity", { required: "Campo obligatorio", valueAsNumber: true, min: 1 })} />
                            </FormField>

                            <FormField
                                icon={<Calendar size={20} className="text-[#1B4965]" />}
                                label="Disponible Desde"
                                error={errors.availableFromText?.message}>
                                <TextInput
                                    type="date"
                                    {...register("availableFromText", { required: "La fecha es obligatoria" })} />
                            </FormField>
                        </div>
                    </div>

                    {/* --- Section: Address --- */}
                    <div className='p-4 md:p-6 flex flex-col items-center'>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2">Ubicación</h3>
                        <div className="flex flex-col items-center w-[50%] gap-y-4 mb-8">
                            <FormField
                                icon={<MapPin size={20} className="text-[#1B4965]" />}
                                label="Nombre de la calle"
                                error={errors.streetName?.message}
                            >
                                <TextInput
                                    placeholder="Ej: Av. Siempreviva"
                                    {...register("streetName", { required: "El nombre de la calle es requerido" })} />
                            </FormField>

                            <FormField
                                icon={<Hash size={20} className="text-[#1B4965]" />}
                                label="Número / Depto."
                                error={errors.houseNumber?.message}
                            >
                                <TextInput
                                    placeholder="Ej: 742, Depto 3B"
                                    {...register("houseNumber", { required: "El número es requerido" })} />
                            </FormField>

                            <FormField
                                icon={<Home size={20} className="text-[#1B4965]" />}
                                label="Barrio"
                                error={errors.neighborhood?.message}
                            >
                                <TextInput
                                    placeholder="Ej: Centro"
                                    {...register("neighborhood", { required: "El barrio es requerido" })} />
                            </FormField>

                            <FormField
                                icon={<Building2 size={20} className="text-[#1B4965]" />}
                                label="Ciudad"
                                error={errors.city?.message}
                            >
                                <TextInput
                                    placeholder="Ej: Springfield"
                                    {...register("city", { required: "La ciudad es requerida" })} />
                            </FormField>

                            <FormField
                                icon={<Landmark size={20} className="text-[#1B4965]" />}
                                label="Estado / Provincia"
                                error={errors.state?.message}
                            >
                                <TextInput
                                    placeholder="Ej: Illinois"
                                    {...register("state", { required: "El estado/provincia es requerido" })} />
                            </FormField>

                            <FormField
                                icon={<Mailbox size={20} className="text-[#1B4965]" />}
                                label="Código Postal"
                                error={errors.zipCode?.message}
                            >
                                <TextInput
                                    placeholder="Ej: 62704"
                                    {...register("zipCode", { required: "El código postal es requerido" })} />
                            </FormField>

                            <FormField
                                icon={<Globe size={20} className="text-[#1B4965]" />}
                                label="País"
                                error={errors.country?.message}
                            >
                                <TextInput
                                    placeholder="Ej: Estados Unidos"
                                    {...register("country", { required: "El país es requerido" })} />
                            </FormField>

                        </div>
                    </div>

                    {/* --- Section: Financials --- */}
                    <div className='p-4 md:p-6 flex flex-col items-center'>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2">Información Financiera</h3>
                        <div className="flex flex-col items-center w-[50%] gap-y-4 mb-8">

                            <FormField
                                icon={<DollarSign size={20} className="text-[#1B4965]" />}
                                label="Precio de Venta"
                                error={errors.salePrice?.message}
                            >
                                <TextInput
                                    type="number"
                                    step="100"
                                    placeholder="Ej: 150000"
                                    {...register("salePrice")} />
                            </FormField>

                            <FormField
                                icon={<DollarSign size={20} className="text-[#1B4965]" />}
                                label="Precio de Alquiler (mensual)"
                                error={errors.rentPrice?.message}
                            >
                                <TextInput
                                    type="number"
                                    step="100"
                                    placeholder="Ej: 850"
                                    {...register("rentPrice")} />
                            </FormField>

                            <FormField
                                icon={<DollarSign size={20} className="text-[#1B4965]" />}
                                label="Moneda"
                                error={errors.currency?.message}
                            >
                                <Select {...register("currency", { required: "Debe seleccionar una moneda" })}>
                                    <option value="0">USD - Dólar Americano</option>
                                    <option value="1">UYU - Peso Uruguayo</option>
                                    <option value="2">BRL - Real Brasileño</option>
                                    <option value="3">EUR - Euro</option>
                                    <option value="4">CLP - Peso Chileno</option>
                                </Select>
                            </FormField>

                            <FormField
                                icon={<Wrench size={20} className="text-[#1B4965]" />}
                                label="¿Tiene Gastos Comunes?"
                                error={errors.hasCommonExpenses?.message}
                            >
                                <Select {...register("hasCommonExpenses")}>
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                </Select>
                            </FormField>

                            {/* Campo condicional: solo se muestra si "Tiene Gastos Comunes" es "Sí" */}
                            {property.hasCommonExpenses && (
                                <FormField
                                    icon={<DollarSign size={20} className="text-[#1B4965]" />}
                                    label="Monto de Gastos Comunes"
                                    error={errors.commonExpensesValue?.message}
                                >
                                    <TextInput
                                        type="number"
                                        step="0.01"
                                        placeholder="Ej: 50"
                                        {...register("commonExpensesValue", {
                                            required: "El monto es requerido si tiene gastos comunes"
                                        })} />
                                </FormField>
                            )}

                            <FormField
                                icon={<Wrench size={20} className="text-[#1B4965]" />}
                                label="Agua Incluida"
                                error={errors.isWaterIncluded?.message}
                            >
                                <Select {...register("isWaterIncluded")}>
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                </Select>
                            </FormField>

                            <FormField
                                icon={<Wrench size={20} className="text-[#1B4965]" />}
                                label="Electricidad Incluida"
                                error={errors.isElectricityIncluded?.message}>
                                <Select {...register("isElectricityIncluded")}>
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                </Select>
                            </FormField>

                        </div>
                    </div>

                    {/* --- Section: Amenities --- */}
                    <div className='p-4 md:p-6 flex flex-col items-center'>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2">Servicios</h3>
                        <div className="flex flex-col items-center w-[50%] gap-y-4 mb-8">
                            {isLoadingAmenities ? (
                                <div className="flex justify-center items-center py-8">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="ml-2">Cargando servicios...</span>
                                </div>
                            ) : allAmenities && allAmenities.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                                    {allAmenities.map((amenity) => (
                                        <div key={amenity.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`amenity-${amenity.id}`}
                                                checked={selectedAmenities.includes(amenity.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedAmenities(prev => [...prev, amenity.id]);
                                                    } else {
                                                        setSelectedAmenities(prev => prev.filter(id => id !== amenity.id));
                                                    }
                                                }}
                                            />
                                            <Label htmlFor={`amenity-${amenity.id}`} className="text-sm font-light">
                                                {amenity.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    No hay amenidades disponibles
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- Section: Property Images --- */}
                    <ImageManager
                        displayImages={displayImages}
                        onImagesChange={setDisplayImages}
                    />

                    {/* --- Section: Videos --- */}
                    <VideoManager
                        displayVideos={displayVideos}
                        onVideosChange={setDisplayVideos}
                    />

                    {/* --- Section: Documents --- */}
                    <DocumentManager
                        displayDocuments={displayDocuments}
                        onDocumentsChange={setDisplayDocuments}
                    />

                    {/* --- Section: Internal Status (For Owner) --- */}
                    <div className='mb-8 w-full max-w-4xl mx-auto bg-blue-50 dark:bg-gray-700 flex flex-col items-center p-6 rounded-lg border border-blue-200 dark:border-gray-500'>
                        <h3 className="text-xl font-semibold mb-4 border-b pb-2">Estado y visibilidad</h3>
                        <div className="flex flex-col items-center w-[50%] gap-y-4 mb-8">
                            <FormField
                                icon={<Info size={20} className="text-[#1B4965]" />}
                                label="Estado de la publicación"
                                error={errors.status?.message}
                            >
                                <Select {...register("status", { required: "Debe seleccionar un estado" })}>
                                    <option value="">Seleccione un estado...</option>
                                    <option value="Sale">En venta</option>
                                    <option value="Rent">Alquiler</option>
                                    <option value="Reserved">Reservada</option>
                                    <option value="Sold">Vendida</option>
                                    <option value="Unavailable">No disponible</option>
                                </Select>
                            </FormField>
                            <FormField
                                icon={<Eye size={20} className="text-[#1B4965]" />}
                                label="Visible al público"
                                error={errors.isPropertyVisible?.message}
                            >
                                <Select 
                                    {...register("isPropertyVisible")}
                                    disabled={!property?.isPropertyVisible && isAtPublishedLimit}
                                >
                                    <option value="true">Visible</option>
                                    <option value="false">Oculta</option>
                                </Select>
                                {!property?.isPropertyVisible && isAtPublishedLimit && (
                                    <p className="text-sm text-yellow-600 mt-1">
                                        Has alcanzado el límite de {publishedLimit} propiedades publicadas ({publishedCount}/{publishedLimit}). 
                                        No puedes publicar más propiedades hasta que despublicar alguna o actualizar tu plan.
                                    </p>
                                )}
                            </FormField>
                            <FormField
                                icon={<EyeOff size={20} className="text-[#1B4965]" />}
                                label="Precio visible al público"
                                error={errors.isPriceVisible?.message}
                            >
                                <Select {...register("isPriceVisible")}>
                                    <option value="true">Visible</option>
                                    <option value="false">Oculto</option>
                                </Select>
                            </FormField>
                        </div>
                    </div>
                    
                    {/* --- Submit button --- */}
                    <div className="p-2 flex space-x-3 w-full max-w-4xl mx-auto justify-center">
                        <Button
                            color="alternative"
                            onClick={() => navigate(-1)}
                            disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}>
                            {isSaving && <Loader2 className="animate-spin mr-2" size={20} />}
                            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </Card>
            </form>
        </>
    )
}