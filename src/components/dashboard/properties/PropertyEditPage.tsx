// src/pages/PropertyEditPage.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Home, BedDouble, Bath, Car, DollarSign, FileText, Calendar, Dog,
  Users, Building, Eye, EyeOff, Wrench, FileDown, Info,
  Loader2, Mailbox, Globe, Landmark, Building2, Hash, Upload, Trash2, Star
} from 'lucide-react';
import propertyService, { PropertyData } from '../../../services/PropertyService';
import { Button, Card, Checkbox, Label, Select, TextInput } from 'flowbite-react';

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

interface DisplayImage {
  key: string;
  previewUrl: string;
  alt: string;
  isMain: boolean;
  source: 'existing' | 'new';
  file?: File;
  id?: string;
}

interface DisplayDocument {
  key: string;
  title: string;
  fileName: string;
  source: 'existing' | 'new';
  file?: File;
  id?: string;
  url?: string;
}

export function PropertyEditPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  if (!propertyId) {
    return <div className="text-center text-red-500 mt-10">No property ID provided.</div>;
  }

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<PropertyData>();

  // --- State Management ---
  const API_BASE_URL = import.meta.env.VITE_API_BASE_FILES_URL || '';
  const [apiError, setApiError] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [displayDocuments, setDisplayDocuments] = useState<DisplayDocument[]>([]);
  const hasGarage = watch("hasGarage");

  // --- Data Fetching ---
  const { data: property, isLoading, isError, error: queryError } = useQuery<PropertyData, Error>({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getOwnersPropertyById(propertyId!),
    enabled: !!propertyId,
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
      const formData = new FormData();
      
      formData.append('Id', payload.id);
      formData.append('Title', payload.title);
      formData.append('Description', payload.description || '');
      formData.append('Type', payload.type);
      formData.append('AreaValue', String(payload.areaValue));
      formData.append('AreaUnit', String(areaUnitMap[payload.areaUnit as keyof typeof areaUnitMap] ?? 0));
      formData.append('Bedrooms', String(payload.bedrooms));
      formData.append('Bathrooms', String(payload.bathrooms));
      formData.append('HasGarage', String(payload.hasGarage));
      formData.append('GarageSpaces', String(payload.garageSpaces || 0));
      formData.append('Capacity', String(payload.capacity));
      formData.append('ArePetsAllowed', String(payload.arePetsAllowed));
      formData.append('AvailableFrom', new Date(payload.availableFromText || '').toISOString());
      formData.append('OwnerId', String(payload.ownerId));
      
      // Address
      formData.append('StreetName', payload.streetName);
      formData.append('HouseNumber', payload.houseNumber);
      formData.append('Neighborhood', payload.neighborhood || '');
      formData.append('City', payload.city);
      formData.append('State', payload.state);
      formData.append('ZipCode', payload.zipCode);
      formData.append('Country', payload.country);
      if (payload.location) formData.append('Location', JSON.stringify(payload.location));

      // Images
      if (payload.propertyImages && payload.propertyImages.length > 0) {
        payload.propertyImages.forEach(imgData => formData.append('Images', imgData.file!));
      }
      formData.append('MainImageId', payload.mainImageId!);

      // Financials & Status
      formData.append('SalePrice', String(payload.salePrice) || '');
      formData.append('RentPrice', String(payload.rentPrice) || '');
      formData.append('Currency', String(currencyMap[payload.currency as keyof typeof currencyMap] ?? 0));
      formData.append('HasCommonExpenses', String(payload.hasCommonExpenses));
      formData.append('CommonExpensesValue', payload.commonExpensesValue || '');
      formData.append('IsWaterIncluded', String(payload.isWaterIncluded));
      formData.append('IsElectricityIncluded', String(payload.isElectricityIncluded));
      formData.append('IsPriceVisible', String(payload.isPriceVisible));
      formData.append('Status', String(propertyStatusMap[payload.status as keyof typeof propertyStatusMap] ?? 0));
      formData.append('IsActive', String(payload.isActive));
      formData.append('IsPropertyVisible', String(payload.isPropertyVisible));  
      return propertyService.updateProperty(id, formData);
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
        arePetsAllowed: property.arePetsAllowed,
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
        setDisplayImages(property.propertyImages.map((img) => ({
          key: img.id!, id: img.id, source: 'existing', isMain: img.id === property.mainImageId,
            previewUrl: `${API_BASE_URL}${img.url.startsWith('/') ? '' : '/'}${img.url}`,
            alt: img.altText || 'Property Image',
        })));
      }
      if (property.propertyDocuments) {
        setDisplayDocuments(property.propertyDocuments.map((doc) => ({
          key: doc.id!, id: doc.id, source: 'existing', title: doc.title, fileName: doc.fileName,
            url: `${API_BASE_URL}${doc.url.startsWith('/') ? '' : '/'}${doc.url}`,
        })));
      }
    }
  }, [property, reset, API_BASE_URL]);

  useEffect(() => {
    return () => displayImages.forEach(img => {
        if (img.source === 'new') URL.revokeObjectURL(img.previewUrl);
      });
  }, [displayImages]);

  // --- File Handlers (with deletion tracking restored) ---
  const handleProcessImages = (files: FileList | null) => { if (!files) return; const newFiles = Array.from(files); const newDisplayImages: DisplayImage[] = newFiles.map(file => ({ key: `${file.name}-${file.lastModified}`, previewUrl: URL.createObjectURL(file), alt: file.name, isMain: false, source: 'new', file: file })); setDisplayImages(prev => { const updatedImages = [...prev, ...newDisplayImages]; if (!updatedImages.some(img => img.isMain) && updatedImages.length > 0) { updatedImages[0].isMain = true; } return updatedImages; }); };
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => handleProcessImages(e.target.files);
  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); handleProcessImages(e.dataTransfer.files); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDeleteImage = (key: string) => { // RESTORED
    const imageToDelete = displayImages.find(img => img.key === key);
    if (!imageToDelete) return;
    setDisplayImages(prev => {
      const remaining = prev.filter(img => img.key !== key);
      if (imageToDelete.isMain && remaining.length > 0) {
        remaining[0].isMain = true;
      }
      return remaining;
    });
  };
  const handleSetMainImage = (key: string) => setDisplayImages(prev => prev.map(img => ({ ...img, isMain: img.key === key })));
  const handleProcessDocs = (files: FileList | null) => { if (!files) return; const newFiles = Array.from(files); const newDisplayDocuments: DisplayDocument[] = newFiles.map(file => ({ key: `${file.name}-${file.lastModified}`, title: file.name.split('.').slice(0, -1).join('.'), fileName: file.name, source: 'new', file: file })); setDisplayDocuments(prev => [...prev, ...newDisplayDocuments]); };
  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => handleProcessDocs(e.target.files);
  const handleDocDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); handleProcessDocs(e.dataTransfer.files); };
  const handleDeleteDocument = (key: string) => { // RESTORED
    const docToDelete = displayDocuments.find(doc => doc.key === key);
    if (!docToDelete) return;
    setDisplayDocuments(prev => prev.filter(doc => doc.key !== key));
  };
  const handleDocumentTitleChange = (key: string, newTitle: string) => { setDisplayDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, title: newTitle } : doc)); };

  // --- SUBMIT HANDLER ---
  const onSubmit = (formValues: PropertyData) => {
    if (!propertyId) return;
    const mainImage = displayImages.find(img => img.isMain);
    const payload: PropertyData = { ...formValues, mainImageId: mainImage?.source === 'existing' ? mainImage.id : undefined};
    updateProperty({ id: propertyId, payload });
  };

  if (isLoading) return 
    <div className="flex justify-center items-center min-h-screen">
      <Loader2 className="animate-spin" size={48} />
    </div>;
  if (isError && queryError) return 
    <div className="text-center text-red-500 mt-10">
      Error: {queryError!}
    </div>;
  if (!property) return <div className="text-center text-gray-600 mt-10">Propiedad no encontrada.</div>;

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
                  {...register("description")}/>
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
                    className='w-2/3'/>
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
                  {...register("bathrooms", { required: "Campo obligatorio", valueAsNumber: true, min: 0 })}/>
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
                  {...register("capacity", { required: "Campo obligatorio", valueAsNumber: true, min: 1 })}/>
              </FormField>

              <FormField
                icon={<Dog size={20} className="text-[#1B4965]" />}
                label="Mascotas Permitidas"
                error={errors.arePetsAllowed?.message}>
                <Select {...register("arePetsAllowed", { required: "Debe seleccionar una opción" })}>
                  <option value="">Seleccione una opción...</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </Select>
              </FormField>

              <FormField
                icon={<Calendar size={20} className="text-[#1B4965]" />}
                label="Disponible Desde"
                error={errors.availableFromText?.message}>
                <TextInput
                  type="date"
                  {...register("availableFromText", { required: "La fecha es obligatoria" })}/>
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
                  {...register("streetName", { required: "El nombre de la calle es requerido" })}/>
              </FormField>

              <FormField
                icon={<Hash size={20} className="text-[#1B4965]" />}
                label="Número / Depto."
                error={errors.houseNumber?.message}
              >
                <TextInput
                  placeholder="Ej: 742, Depto 3B"
                  {...register("houseNumber", { required: "El número es requerido" })}/>
              </FormField>

              <FormField
                icon={<Home size={20} className="text-[#1B4965]" />}
                label="Barrio"
                error={errors.neighborhood?.message}
              >
                <TextInput
                  placeholder="Ej: Centro"
                  {...register("neighborhood", { required: "El barrio es requerido" })}/>
              </FormField>

              <FormField
                icon={<Building2 size={20} className="text-[#1B4965]" />}
                label="Ciudad"
                error={errors.city?.message}
              >
                <TextInput
                  placeholder="Ej: Springfield"
                  {...register("city", { required: "La ciudad es requerida" })}/>
              </FormField>

              <FormField
                icon={<Landmark size={20} className="text-[#1B4965]" />}
                label="Estado / Provincia"
                error={errors.state?.message}
              >
                <TextInput
                  placeholder="Ej: Illinois"
                  {...register("state", { required: "El estado/provincia es requerido" })}/>
              </FormField>

              <FormField
                icon={<Mailbox size={20} className="text-[#1B4965]" />}
                label="Código Postal"
                error={errors.zipCode?.message}
              >
                <TextInput
                  placeholder="Ej: 62704"
                  {...register("zipCode", { required: "El código postal es requerido" })}/>
              </FormField>

              <FormField
                icon={<Globe size={20} className="text-[#1B4965]" />}
                label="País"
                error={errors.country?.message}
              >
                <TextInput
                  placeholder="Ej: Estados Unidos"
                  {...register("country", { required: "El país es requerido" })}/>
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
                  {...register("salePrice")}/>
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
                  {...register("rentPrice")}/>
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
                    })}/>
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

          {/* --- Section: Property Images --- */}
          <div className='p-4 md:p-6'>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">Imágenes</h3>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
              onDrop={handleImageDrop}
              onDragOver={handleDragOver}
              onClick={() => imageFileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={imageFileInputRef}
                onChange={handleImageFileChange}
                multiple
                accept="image/*"
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <Upload size={40} className="text-gray-400 mb-4" />
                <p className="font-medium mb-2">Arrastra y suelta las imágenes aquí</p>
                <p className="text-sm mb-4">o</p>
                <Button
                  onClick={(e) => { e.stopPropagation(); imageFileInputRef.current?.click(); }}>
                  Seleccionar archivos
                </Button>
              </div>
            </div>

            {displayImages.length > 0 && (
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {displayImages.map((img) => (
                  <div key={img.key} className="relative group aspect-square">
                    <img src={img.previewUrl} alt={img.alt} className="w-full h-full object-cover rounded-lg" />
                    <div className="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 flex items-center justify-center gap-2 rounded-lg">
                      <button type="button" onClick={() => handleDeleteImage(img.key)} className="p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300" title="Eliminar imagen"><Trash2 size={18} /></button>
                      <button type="button" onClick={() => handleSetMainImage(img.key)} className={`p-2 rounded-full opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 ${img.isMain ? 'bg-yellow-400 text-white' : 'bg-gray-700 text-white'}`} title="Marcar como principal"><Star size={18} /></button>
                    </div>
                    {img.isMain && <div className="absolute top-2 right-2 bg-yellow-400 text-white rounded-full p-1" title="Imagen Principal"><Star size={14} /></div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className='p-4 md:p-6'>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">Documentos</h3>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
              onDrop={handleDocDrop}
              onDragOver={handleDragOver}
              onClick={() => docFileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={docFileInputRef}
                onChange={handleDocFileChange}
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
              />
              <div className="flex flex-col items-center">
                <FileDown size={40} className="text-gray-400 mb-4" />
                <p className="font-medium mb-2">Arrastra y suelta documentos aquí</p>
                <p className="text-sm mb-4">o</p>
                <Button onClick={(e) => { e.stopPropagation(); docFileInputRef.current?.click(); }}>
                  Seleccionar archivos
                </Button>
              </div>
            </div>

            {displayDocuments.length > 0 && (
              <div className="mt-6 space-y-3">
                {displayDocuments.map((doc) => (
                  <div key={doc.key} className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <FileText className="w-6 h-6 text-[#1B4965] flex-shrink-0" />
                    <div className="flex-grow">
                      <input
                        type="text"
                        value={doc.title}
                        onChange={(e) => handleDocumentTitleChange(doc.key, e.target.value)}
                        placeholder="Título del documento"
                        className="w-full text-sm font-medium text-gray-800 border-b border-transparent focus:outline-none focus:border-gray-300"
                      />
                      <p className="text-xs text-gray-500 mt-1">{doc.fileName}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.key)}
                      className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                      title="Eliminar documento"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                <Select {...register("isPropertyVisible")}>
                  <option value="true">Visible</option>
                  <option value="false">Oculta</option>
                </Select>
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