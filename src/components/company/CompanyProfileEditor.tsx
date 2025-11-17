import React, { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { Card, Button, Label, TextInput, Textarea, Spinner, Alert } from 'flowbite-react';
import { 
  Building2, 
  Edit3, 
  Save, 
  X, 
  Camera, 
  MapPin,
  FileImage,
  AlertCircle
} from 'lucide-react';
import { CompanyInfo } from '../../models/companies/CompanyInfo';
import { UpdateCompanyProfilePayload } from '../../models/companies/UpdateCompanyProfilePayload';
import companyService from '../../services/CompanyService';

interface CompanyProfileEditorProps {
  companyInfo: CompanyInfo | null;
  isLoading: boolean;
  onUpdate: () => void;
}

export function CompanyProfileEditor({ companyInfo, isLoading, onUpdate }: CompanyProfileEditorProps) {
  const [editing, setEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<UpdateCompanyProfilePayload>({
    name: '',
    description: '',
    address: {
      street: '',
      street2: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    },
  });

  React.useEffect(() => {
    if (companyInfo) {
      setFormData({
        name: companyInfo.name || '',
        description: companyInfo.description || '',
        address: companyInfo.address || {
          street: '',
          street2: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
      });
      setLogoPreview(companyInfo.logoUrl || null);
      setBannerPreview(companyInfo.bannerUrl || null);
    }
  }, [companyInfo]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setFormData({
        ...formData,
        address: {
          ...formData.address!,
          [addressField]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecciona un archivo de imagen válido');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no debe superar los 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsLogoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const response = await companyService.uploadCompanyLogo(formData);
      setLogoPreview(response.logoUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al subir el logo');
      setLogoPreview(companyInfo?.logoUrl || null);
    } finally {
      setIsLogoUploading(false);
    }
  };

  const handleBannerChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecciona un archivo de imagen válido');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen no debe superar los 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsBannerUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('banner', file);
      const response = await companyService.uploadCompanyBanner(formData);
      setBannerPreview(response.bannerUrl);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al subir el banner');
      setBannerPreview(companyInfo?.bannerUrl || null);
    } finally {
      setIsBannerUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsUpdating(true);

    try {
      await companyService.updateCompanyProfile(formData);
      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al actualizar el perfil');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    if (companyInfo) {
      setFormData({
        name: companyInfo.name || '',
        description: companyInfo.description || '',
        address: companyInfo.address || {
          street: '',
          street2: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
      });
    }
    setEditing(false);
    setError(null);
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" />
        </div>
      </Card>
    );
  }

  if (!companyInfo) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-gray-500">No se encontró información de la compañía</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Building2 className="w-6 h-6" />
          <h2 className="text-xl font-bold">Información del Perfil</h2>
        </div>
        {!editing && (
          <Button
            onClick={() => setEditing(true)}
            color="blue"
            className="flex items-center space-x-2"
          >
            <Edit3 className="w-4 h-4" />
            <span>Editar</span>
          </Button>
        )}
      </div>

      {error && (
        <Alert color="failure" icon={AlertCircle} className="mb-4">
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="success" className="mb-4">
          Perfil actualizado correctamente
        </Alert>
      )}

      {/* Banner Image */}
      {bannerPreview && (
        <div className="mb-6 relative h-48 rounded-lg overflow-hidden">
          <img
            src={bannerPreview}
            alt="Banner"
            className="w-full h-full object-cover"
          />
          {editing && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Button
                onClick={() => bannerInputRef.current?.click()}
                color="gray"
                size="sm"
                disabled={isBannerUploading}
              >
                {isBannerUploading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Cambiar Banner
                  </>
                )}
              </Button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerChange}
                className="hidden"
              />
            </div>
          )}
        </div>
      )}

      {!editing ? (
        <div className="space-y-4">
          <div className="flex items-start space-x-4">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo"
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">{companyInfo.name}</h3>
              {companyInfo.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">{companyInfo.description}</p>
              )}
            </div>
          </div>

          {companyInfo.address && (
            <div className="flex items-start space-x-2 text-gray-600 dark:text-gray-400">
              <MapPin className="w-5 h-5 mt-0.5" />
              <div>
                <p>{companyInfo.address.street}</p>
                {companyInfo.address.street2 && <p>{companyInfo.address.street2}</p>}
                <p>
                  {companyInfo.address.city}, {companyInfo.address.state} {companyInfo.address.postalCode}
                </p>
                <p>{companyInfo.address.country}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Logo Upload */}
          <div>
            <Label>Logo de la Compañía</Label>
            <div className="mt-2 flex items-center space-x-4">
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-20 h-20 rounded-lg object-cover"
                />
              )}
              <div>
                <Button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  color="gray"
                  size="sm"
                  disabled={isLogoUploading}
                >
                  {isLogoUploading ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <FileImage className="w-4 h-4 mr-2" />
                      {logoPreview ? 'Cambiar Logo' : 'Subir Logo'}
                    </>
                  )}
                </Button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Banner Upload */}
          <div>
            <Label>Banner de la Compañía</Label>
            <div className="mt-2">
              <Button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                color="gray"
                size="sm"
                disabled={isBannerUploading}
              >
                {isBannerUploading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <FileImage className="w-4 h-4 mr-2" />
                    {bannerPreview ? 'Cambiar Banner' : 'Subir Banner'}
                  </>
                )}
              </Button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerChange}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="name" title="Nombre de la Compañía" />
            <TextInput
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleInputChange}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" title="Descripción" />
            <Textarea
              id="description"
              name="description"
              value={formData.description || ''}
              onChange={handleInputChange}
              rows={4}
              className="mt-1"
              placeholder="Describe tu compañía..."
            />
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-md font-semibold mb-4">Dirección</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="address.street" title="Calle y Número" />
                <TextInput
                  id="address.street"
                  name="address.street"
                  value={formData.address?.street || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="address.street2" title="Apartamento, suite, etc." />
                <TextInput
                  id="address.street2"
                  name="address.street2"
                  value={formData.address?.street2 || ''}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address.city" title="Ciudad" />
                  <TextInput
                    id="address.city"
                    name="address.city"
                    value={formData.address?.city || ''}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="address.state" title="Estado / Provincia" />
                  <TextInput
                    id="address.state"
                    name="address.state"
                    value={formData.address?.state || ''}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address.postalCode" title="Código Postal" />
                  <TextInput
                    id="address.postalCode"
                    name="address.postalCode"
                    value={formData.address?.postalCode || ''}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="address.country" title="País" />
                  <TextInput
                    id="address.country"
                    name="address.country"
                    value={formData.address?.country || ''}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              color="gray"
              onClick={handleCancel}
              disabled={isUpdating}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              color="blue"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

