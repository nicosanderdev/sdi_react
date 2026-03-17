// src/pages/dashboard/admin/AdminCreatePropertyPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Label, TextInput } from 'flowbite-react';
import { propertyFormSchema, PropertyFormData } from '../../../models/properties/PropertyFormSchema';
import { PropertyFormStep1 } from '../../../components/dashboard/properties/PropertyFormStep1';
import { PropertyFormStep2 } from '../../../components/dashboard/properties/PropertyFormStep2';
import { PropertyFormStep3 } from '../../../components/dashboard/properties/PropertyFormStep3';
import { PropertyFormStep4 } from '../../../components/dashboard/properties/PropertyFormStep4';
import { DisplayImage } from '../../../components/dashboard/properties/ImageManager';
import { DisplayDocument } from '../../../components/dashboard/properties/DocumentManager';
import { DisplayVideo } from '../../../components/dashboard/properties/VideoManager';
import PropertyService from '../../../services/PropertyService';
import { getMemberById, getMemberByEmail } from '../../../services/AdminMemberService';
import { AdminCreateMemberForm } from '../../../components/admin/properties/AdminCreateMemberForm';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { useAuth } from '../../../contexts/AuthContext';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AdminCreatePropertyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserEmail = user?.email ?? '';
  const [phase, setPhase] = useState<'owner' | 'property'>('owner');
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('existing');
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [existingInput, setExistingInput] = useState('');
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [propertyStep, setPropertyStep] = useState(1);
  const [propertyError, setPropertyError] = useState<string | null>(null);
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const [displayDocuments, setDisplayDocuments] = useState<DisplayDocument[]>([]);
  const [displayVideos, setDisplayVideos] = useState<DisplayVideo[]>([]);
  const [isSubmittingProperty, setIsSubmittingProperty] = useState(false);

  const methods = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    mode: 'onTouched',
    defaultValues: {
      streetName: '',
      houseNumber: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Uruguay',
      location: { lat: -30.8994, lng: -55.5469 },
      title: '',
      type: undefined,
      propertyType: undefined,
      areaValue: 0,
      areaUnit: undefined,
      bedrooms: 1,
      bathrooms: 1,
      hasGarage: false,
      garageSpaces: 0,
      hasLaundryRoom: false,
      hasPool: false,
      hasBalcony: false,
      isFurnished: false,
      capacity: 1,
      description: '',
      availableFrom: new Date().toISOString().split('T')[0],
      currency: 'USD',
      listingType: undefined,
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
      amenities: [],
    },
  });

  const { handleSubmit, trigger } = methods;

  const handleBack = () => {
    navigate('/dashboard/admin/properties');
  };

  const handleExistingContinue = async () => {
    const trimmed = existingInput.trim();
    if (!trimmed) {
      setOwnerError('Ingresa un ID de miembro o un email.');
      return;
    }
    setOwnerError(null);
    try {
      const isUuid = UUID_REGEX.test(trimmed);
      const member = isUuid
        ? await getMemberById(trimmed)
        : await getMemberByEmail(trimmed);
      if (!member) {
        setOwnerError('ID o email de miembro no encontrado.');
        return;
      }
      setOwnerUserId(member.UserId);
      setPhase('property');
    } catch (err) {
      setOwnerError(err instanceof Error ? err.message : 'Error al buscar el miembro.');
    }
  };

  const handleNewMemberSuccess = (userId: string) => {
    setOwnerError(null);
    setOwnerUserId(userId);
    setPhase('property');
  };

  const handlePropertyBack = () => {
    setPropertyStep((s) => Math.max(1, s - 1));
    setPropertyError(null);
  };

  const handlePropertyNext = () => {
    setPropertyError(null);
    setPropertyStep((s) => Math.min(4, s + 1));
  };

  const onPropertySubmit = async (formData: PropertyFormData) => {
    if (!ownerUserId) return;
    setPropertyError(null);
    setIsSubmittingProperty(true);
    try {
      const processedImages = displayImages.map((img) => ({
        ...img,
        altText: img.alt || '',
        isPublic: true,
      }));
      const processedDocuments = displayDocuments.map((doc) => ({
        ...doc,
        name: doc.name || '',
        fileName: doc.fileName || doc.name || '',
        isPublic: true,
      }));
      await PropertyService.createPropertyForOwner(
        ownerUserId,
        formData,
        processedImages,
        processedDocuments
      );
      navigate('/dashboard/admin/properties');
    } catch (err) {
      setPropertyError(err instanceof Error ? err.message : 'Error al crear la propiedad.');
    } finally {
      setIsSubmittingProperty(false);
    }
  };

  const pageTitle =
    phase === 'owner'
      ? 'Nueva propiedad — Propietario'
      : `Nueva propiedad — Paso ${propertyStep} de 4`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button color="light" size="sm" onClick={handleBack} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        <DashboardPageTitle
          title={pageTitle}
          subtitle={
            phase === 'owner'
              ? 'Elige si la propiedad será para un miembro existente o crea uno nuevo.'
              : 'Completa los datos de la propiedad.'
          }
        />
      </div>

      {phase === 'owner' && (
        <Card>
          <div className="space-y-6 text-left">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Elige si la propiedad será para un miembro existente o crea uno nuevo.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ownerMode"
                  checked={ownerMode === 'existing'}
                  onChange={() => {
                    setOwnerMode('existing');
                    setOwnerError(null);
                  }}
                />
                <span>Usar miembro existente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="ownerMode"
                  checked={ownerMode === 'new'}
                  onChange={() => {
                    setOwnerMode('new');
                    setOwnerError(null);
                  }}
                />
                <span>Crear nuevo miembro</span>
              </label>
            </div>

            {ownerMode === 'existing' && (
              <div className="space-y-2">
                <Label
                  htmlFor="memberIdOrEmail"
                  className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  ID de miembro (UUID) o email
                </Label>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center max-w-xl">
                  <TextInput
                    id="memberIdOrEmail"
                    value={existingInput}
                    onChange={(e) => setExistingInput(e.target.value)}
                    placeholder="Ej: 883ff807-044d-401b-894a-055525766dc6 o usuario@dominio.com"
                    className="flex-1"
                  />
                  {currentUserEmail && (
                    <Button
                      type="button"
                      color="light"
                      onClick={() => {
                        setExistingInput(currentUserEmail);
                        setOwnerError(null);
                      }}
                    >
                      Usar mi email
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Usa el <span className="font-semibold">ID de miembro</span> (no el ID de propiedad) o el email exacto
                  con el que se registró el miembro.
                </p>
                {ownerError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{ownerError}</p>
                )}
                <Button onClick={handleExistingContinue}>Continuar</Button>
              </div>
            )}

            {ownerMode === 'new' && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Datos del nuevo miembro
                </h4>
                <AdminCreateMemberForm
                  onSubmitSuccess={handleNewMemberSuccess}
                  onCancel={handleBack}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {phase === 'property' && ownerUserId && (
        <FormProvider {...methods}>
          <Card>
            <div className="px-2">
              <div className="flex space-x-1 mb-6">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`flex-1 h-1 rounded-full ${
                      step <= propertyStep ? 'bg-primary-400' : 'bg-gray-200 dark:bg-gray-600'
                    }`}
                  />
                ))}
              </div>
              {propertyError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {propertyError}
                </div>
              )}
              {propertyStep === 1 && (
                <PropertyFormStep1 onNext={() => handlePropertyNext(step1Fields)} />
              )}
              {propertyStep === 2 && (
                <PropertyFormStep2
                  onNext={handlePropertyNext}
                  onBack={handlePropertyBack}
                />
              )}
              {propertyStep === 3 && (
                <PropertyFormStep3
                  onNext={handlePropertyNext}
                  onBack={handlePropertyBack}
                  displayImages={displayImages}
                  setDisplayImages={setDisplayImages}
                  displayVideos={displayVideos}
                  setDisplayVideos={setDisplayVideos}
                />
              )}
              {propertyStep === 4 && (
                <PropertyFormStep4
                  onSubmit={handleSubmit(onPropertySubmit, (errors) => {
                    console.error('Form validation failed:', errors);
                  })}
                  onBack={handlePropertyBack}
                  isSubmitting={isSubmittingProperty}
                  displayDocuments={displayDocuments}
                  setDisplayDocuments={setDisplayDocuments}
                />
              )}
            </div>
          </Card>
        </FormProvider>
      )}
    </div>
  );
}
