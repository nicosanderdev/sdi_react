// src/pages/PropertyEditPage.tsx, start of code (Rolled back to explicit append logic)

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Home, BedDouble, Bath, Car, DollarSign, FileText, Calendar, Dog,
  Users, Building, Eye, EyeOff, Wrench, FileDown, Info,
  Loader2, Mailbox, Globe, Landmark, Building2, Hash, Upload, Trash2, Star
} from 'lucide-react';
import propertyService, { PropertyImage, PropertyData, PropertyDocument } from '../../services/PropertyService';

// Assuming you have these maps in a utility file
const propertyStatusMap: Record<string, number> = { 'Sale': 0, 'Rent': 1, 'Sold': 2, 'Reserved': 3, 'Unavailable': 4 };
const currencyMap: Record<string, number> = { 'USD': 0, 'UYU': 1, 'BRL': 2, 'EUR': 3, 'CLP': 4 };
const areaUnitMap: Record<string, number> = { 'm²': 0, 'ft²': 1, 'yd²': 2, 'acres': 3, 'hectares': 4, 'km²': 5, 'mi²': 6 };

// --- Helper Components & Interfaces ---
const FormField: React.FC<{ icon?: React.ReactNode; label: string; children: React.ReactNode; error?: string }> = ({ icon, label, children, error }) => (
    <div className='flex items-start space-x-1 w-full'>
      {icon && (<div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#BEE9E8] flex items-center justify-center mr-4 mt-2">{icon}</div>)}
      <div className='w-full'>
        <label className="text-sm text-gray-500">{label}</label>
        {children}
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>
    </div>
);

interface DisplayImage {
  key: string; previewUrl: string; alt: string; isMain: boolean;
  source: 'existing' | 'new'; file?: File; id?: string;
}
interface DisplayDocument {
  key: string; title: string; fileName: string;
  source: 'existing' | 'new'; file?: File; id?: string; url?: string;
}

// This is the payload we will assemble and pass to our mutation function.
// It includes the form data AND the file management instructions.
type UpdatePropertyPayload = PropertyData & {
  newImages: File[];
  deletedImageIds: string[];
  mainImageInfo: { type: 'existing', id: string } | { type: 'new', fileName: string } | null;
  newDocuments: { file: File, title: string }[];
  documentMetadata: Omit<DisplayDocument, 'file' | 'url' | 'source' | 'key'>[];
  deletedDocumentIds: string[];
};

export function PropertyEditPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  if (!propertyId) return <div className="text-center text-red-500 mt-10">No property ID provided.</div>;

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm<PropertyData>();

  // --- State Management (with deletion tracking restored) ---
  const API_BASE_URL = import.meta.env.VITE_API_BASE_FILES_URL || '';
  const [apiError, setApiError] = useState<string | null>(null);

  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]); // RESTORED

  const docFileInputRef = useRef<HTMLInputElement>(null);
  const [displayDocuments, setDisplayDocuments] = useState<DisplayDocument[]>([]);
  const [documentsToDelete, setDocumentsToDelete] = useState<string[]>([]); // RESTORED

  const hasGarage = watch("hasGarage");

  // --- Data Fetching ---
  const { data: property, isLoading, isError, error: queryError } = useQuery<PropertyData, Error>({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getOwnersPropertyById(propertyId!),
    enabled: !!propertyId,
  });

  // --- ROLLED-BACK MUTATION HOOK (with explicit appends) ---
  const { mutate: updateProperty, isPending: isSaving } = useMutation<
    PropertyData,
    Error,
    { id: string; payload: UpdatePropertyPayload }
  >({
    mutationFn: async ({ id, payload }): Promise<PropertyData> => {
      setApiError(null);
      console.log("Payload received for update:", payload);

      const formData = new FormData();
      
      // --- Append all form fields to FormData explicitly ---
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
      
      // Address
      formData.append('StreetName', payload.streetName);
      formData.append('HouseNumber', payload.houseNumber);
      formData.append('Neighborhood', payload.neighborhood || '');
      formData.append('City', payload.city);
      formData.append('State', payload.state);
      formData.append('ZipCode', payload.zipCode);
      formData.append('Country', payload.country);
      if (payload.location) formData.append('Location', JSON.stringify(payload.location));

      // Financials & Status
      formData.append('SalePrice', payload.salePrice || '');
      formData.append('RentPrice', payload.rentPrice || '');
      formData.append('Currency', String(currencyMap[payload.currency as keyof typeof currencyMap] ?? 0));
      formData.append('HasCommonExpenses', String(payload.hasCommonExpenses));
      formData.append('CommonExpensesAmount', payload.commonExpensesAmount || '');
      formData.append('IsWaterIncluded', String(payload.isWaterIncluded));
      formData.append('IsElectricityIncluded', String(payload.isElectricityIncluded));
      formData.append('IsPriceVisible', String(payload.isPriceVisible));
      formData.append('Status', String(propertyStatusMap[payload.status as keyof typeof propertyStatusMap] ?? 0));
      formData.append('IsActive', String(payload.isActive));
      formData.append('IsPropertyVisible', String(payload.isPropertyVisible));

      // --- Handle Images (Add/Delete Logic) ---
      payload.newImages.forEach(file => formData.append('NewImages', file));
      payload.deletedImageIds.forEach(id => formData.append('DeletedImageIds', id));
      if (payload.mainImageInfo?.type === 'existing') {
        formData.append('MainImageId', payload.mainImageInfo.id);
      } else if (payload.mainImageInfo?.type === 'new') {
        formData.append('MainImageFileName', payload.mainImageInfo.fileName);
      }

      // --- Handle Documents (Add/Delete Logic) ---
      payload.newDocuments.forEach(doc => formData.append('NewDocumentFiles', doc.file, doc.file.name));
      formData.append('DocumentMetadataJson', JSON.stringify(payload.documentMetadata));
      payload.deletedDocumentIds.forEach(id => formData.append('DeletedDocumentIds', id));

      return propertyService.updateProperty(id, formData);
    },
    onSuccess: (updatedProperty) => {
      console.log("Property updated successfully:", updatedProperty);
      setApiError(null);
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property', updatedProperty.id] });
      navigate(`/dashboard/property/${updatedProperty.id}`);
    },
    onError: (error: Error) => {
      console.error("Update failed:", error);
      setApiError(error.message || 'An unexpected error occurred.');
    },
  });

  // --- Effects ---
  useEffect(() => {
    if (property) {
      const formattedDate = new Date(property.availableFrom).toISOString().slice(0, 10);
      reset({ ...property, availableFromText: formattedDate });
      if (property.propertyImages) setDisplayImages(property.propertyImages.map((img) => ({ key: img.id!, id: img.id, source: 'existing', isMain: img.id === property.mainImageId, previewUrl: `${API_BASE_URL}${img.url.startsWith('/') ? '' : '/'}${img.url}`, alt: img.altText || 'Property Image' })));
      if (property.propertyDocuments) setDisplayDocuments(property.propertyDocuments.map((doc) => ({ key: doc.id!, id: doc.id, source: 'existing', title: doc.title, fileName: doc.fileName, url: `${API_BASE_URL}${doc.url.startsWith('/') ? '' : '/'}${doc.url}` })));
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
    if (imageToDelete.source === 'existing' && imageToDelete.id) {
      setImagesToDelete(prev => [...prev, imageToDelete.id!]);
    }
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
    if (docToDelete.source === 'existing' && docToDelete.id) {
      setDocumentsToDelete(prev => [...prev, docToDelete.id!]);
    }
    setDisplayDocuments(prev => prev.filter(doc => doc.key !== key));
  };
  const handleDocumentTitleChange = (key: string, newTitle: string) => { setDisplayDocuments(prev => prev.map(doc => doc.key === key ? { ...doc, title: newTitle } : doc)); };

  // --- ROLLED-BACK SUBMIT HANDLER ---
  const onSubmit = (formValues: PropertyData) => {
    if (!propertyId) return;

    const mainImage = displayImages.find(img => img.isMain);
    const payload: UpdatePropertyPayload = {
      ...formValues,
      newImages: displayImages.filter(img => img.source === 'new' && img.file).map(img => img.file!),
      deletedImageIds: imagesToDelete, // Use restored state
      mainImageInfo: mainImage 
        ? mainImage.source === 'existing' 
          ? { type: 'existing', id: mainImage.id! } 
          : { type: 'new', fileName: mainImage.file!.name }
        : null,
      newDocuments: displayDocuments.filter(doc => doc.source === 'new' && doc.file).map(doc => ({ file: doc.file!, title: doc.title })),
      documentMetadata: displayDocuments.map(({ id, title, fileName }) => ({ id, title, fileName })),
      deletedDocumentIds: documentsToDelete, // Use restored state
    };
    
    updateProperty({ id: propertyId, payload });
  };

  // --- Render Logic (no changes to JSX needed) ---
  if (isLoading) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="animate-spin text-[#1B4965]" size={48} /></div>;
  if (isError && queryError) return <div className="text-center text-red-500 mt-10">Error: {queryError.message}</div>;
  if (!property) return <div className="text-center text-gray-600 mt-10">Propiedad no encontrada.</div>;

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="max-w-5xl mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">
          {/* Your full JSX content goes here. It does not need to be changed. */}
        </div>
      </form>
    </>
  );
}