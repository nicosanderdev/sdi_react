import React, { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { UserIcon, MailIcon, PhoneIcon, LockIcon, CameraIcon, MapPinIcon, BriefcaseIcon, Edit3Icon, SaveIcon, XIcon } from 'lucide-react';
import profileService, { ProfileData, AddressData, UpdateProfilePayload } from '../../services/ProfileService'; // Adjust path as needed
import { ChangePasswordModal } from './ChangePasswordModal';

const initialProfileState: ProfileData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  title: '',
  avatarUrl: '',
  address: {
    street: '',
    street2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
};

export function UserProfile() {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState<ProfileData>(initialProfileState);
  const [editing, setEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await profileService.getCurrentUserProfile();
        setProfileData(data);
        setFormData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch profile data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const [field, subField] = name.split('.');

    if (subField) {
      setFormData(prev => ({
        ...prev,
        [field]: {
          ...(prev[field as keyof ProfileData] as AddressData),
          [subField]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleEditToggle = () => {
    if (editing && profileData) {
      setFormData(profileData);
    }
    setEditing(!editing);
    setError(null);
  };

  const handleSubmitProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setError(null);
    try {
      const { email, ...updatePayload } = formData;
      const payload : UpdateProfilePayload = {
        id: undefined,
        updateProfileDto: updatePayload,
      };
      const updatedProfile = await profileService.updateUserProfile(payload);
      if (updatedProfile.updateProfileDto) {
        setProfileData(updatedProfile.updateProfileDto as ProfileData);
        setFormData(updatedProfile.updateProfileDto as ProfileData); // Ensure formData is also updated with response
      }
      setEditing(false);
      setIsUpdating(false);
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile.');
      console.error(err);
    }
  };

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarPreview(URL.createObjectURL(file));

      const fd = new FormData();
      fd.append('avatar', file);
      setIsAvatarUploading(true);
      setError(null);
      try {
        const response = await profileService.uploadProfilePicture(fd);  
        setProfileData(prev => prev ? { ...prev, avatarUrl: response.avatarUrl } : null);
        setFormData(prev => ({ ...prev, avatarUrl: response.avatarUrl }));
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to upload avatar.');
        setAvatarPreview(profileData?.avatarUrl || null);
        console.error(err);
      } finally {
        setIsAvatarUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
      }
    }
  };

  if (isLoading) {
    return <div className="max-w-4xl mx-auto p-6 text-center">Loading profile...</div>;
  }

  if (!profileData && !editing) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-red-500">
        {error || 'Could not load profile data. Please try again later.'}
      </div>
    );
  }
  
  const currentData = editing ? formData : (profileData || initialProfileState);

  const renderInfoField = (icon: React.ReactNode, label: string, value: string | undefined | null) => (
    <div className="flex items-center">
      <div className="w-10 h-10 rounded-full bg-[#BEE9E8] flex items-center justify-center mr-4 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="font-medium break-words">{value || '-'}</p>
      </div>
    </div>
  );

  const renderInputField = (
    label: string,
    name: string,
    value: string | undefined,
    type: string = 'text',
    icon?: React.ReactNode,
    required: boolean = true,
    disabled: boolean = false
  ) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          name={name}
          id={name}
          value={value || ''}
          onChange={handleInputChange}
          required={required}
          disabled={disabled}
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB] disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
        />
        {icon && <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">{icon}</div>}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold text-[#1B4965] mb-6">Mi Perfil</h1>
      {error && !isUpdating && !isAvatarUploading && ( // Show general errors not related to ongoing operations
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}
      <div className="bg-[#FDFFFC] rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col md:flex-row">
          {/* Profile Picture and Basic Info */}
          <div className="md:w-1/3 mb-6 md:mb-0 flex flex-col items-center">
            <div className="relative">
              <div className="h-40 w-40 rounded-full bg-[#BEE9E8] flex items-center justify-center text-[#1B4965] overflow-hidden border-2 border-[#62B6CB]">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="h-full w-full object-cover" />
                ) : currentData.avatarUrl ? (
                  <img src={currentData.avatarUrl} alt={currentData.firstName} className="h-full w-full object-cover" />
                ) : (
                  <UserIcon size={80} />
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAvatarFileChange}
                accept="image/*"
                style={{ display: 'none' }}
                disabled={isAvatarUploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-[#62B6CB] p-2 rounded-full text-[#FDFFFC] hover:bg-[#47A9C2] transition-colors shadow-md"
                title="Change profile picture"
                disabled={isAvatarUploading}
              >
                {isAvatarUploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <CameraIcon size={20} />}
              </button>
            </div>
            <h2 className="text-xl font-semibold mt-4 text-[#1B4965]">{currentData.firstName} {currentData.lastName}</h2>
            <p className="text-gray-600">{currentData.title || 'Título no especificado'}</p>
          </div>

          {/* Personal Information / Edit Form */}
          <div className="md:w-2/3 md:pl-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-[#1B4965]">
                Información Personal
              </h3>
              {!editing ? (
                <div className="flex space-x-2">
                    <button
                    onClick={() => setIsChangePasswordModalOpen(true)}
                    className="bg-gray-200 text-[#1B4965] px-4 py-2 rounded-md hover:bg-gray-300 transition-colors text-sm flex items-center"
                    >
                    <LockIcon size={16} className="mr-2"/> Cambiar Contraseña
                    </button>
                    <button
                    onClick={handleEditToggle}
                    className="bg-[#62B6CB] text-[#FDFFFC] px-4 py-2 rounded-md hover:bg-[#47A9C2] transition-colors text-sm flex items-center"
                    >
                    <Edit3Icon size={16} className="mr-2"/> Editar Perfil
                    </button>
                </div>
              ) : null}
            </div>

            {!editing && profileData ? (
              <div className="space-y-5">
                {renderInfoField(<UserIcon size={20} className="text-[#1B4965]" />, "Nombre completo", `${profileData.firstName} ${profileData.lastName}`)}
                {renderInfoField(<BriefcaseIcon size={20} className="text-[#1B4965]" />, "Título / Cargo", profileData.title)}
                {renderInfoField(<MailIcon size={20} className="text-[#1B4965]" />, "Correo electrónico", profileData.email)}
                {renderInfoField(<PhoneIcon size={20} className="text-[#1B4965]" />, "Teléfono", profileData.phone)}
                <div className="flex">
                     <div className="w-10 h-10 rounded-full bg-[#BEE9E8] flex items-center justify-center mr-4 shrink-0">
                        <MapPinIcon size={20} className="text-[#1B4965]" />
                     </div>
                     <div>
                        <p className="text-sm text-gray-500">Dirección</p>
                        <p className="font-medium">{profileData.address.street || '-'}</p>
                        {profileData.address.street2 && <p className="font-medium">{profileData.address.street2}</p>}
                        <p className="font-medium">{`${profileData.address.city || ''}${profileData.address.city && profileData.address.state ? ', ' : ''}${profileData.address.state || ''} ${profileData.address.postalCode || ''}`}</p>
                        <p className="font-medium">{profileData.address.country || ''}</p>
                     </div>
                </div>
              </div>
            ) : editing ? (
              <form onSubmit={handleSubmitProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputField("Nombre", "firstName", formData.firstName, "text", <UserIcon size={18} />)}
                    {renderInputField("Apellido", "lastName", formData.lastName, "text", <UserIcon size={18} />)}
                </div>
                {renderInputField("Título / Cargo (Opcional)", "title", formData.title, "text", <BriefcaseIcon size={18} />, false)}
                {renderInputField("Correo Electrónico", "email", formData.email, "email", <MailIcon size={18} />, true, true)}
                {renderInputField("Teléfono (Opcional)", "phone", formData.phone, "tel", <PhoneIcon size={18} />, false)}
                
                <h4 className="text-md font-semibold text-[#1B4965] pt-2">Dirección (Opcional)</h4>
                {renderInputField("Calle y Número", "address.street", formData.address.street, "text", <MapPinIcon size={18} />, false)}
                {renderInputField("Apartamento, suite, etc.", "address.street2", formData.address.street2, "text", <MapPinIcon size={18} />, false)}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputField("Ciudad", "address.city", formData.address.city, "text", <MapPinIcon size={18} />, false)}
                    {renderInputField("Estado / Provincia", "address.state", formData.address.state, "text", <MapPinIcon size={18} />, false)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputField("Código Postal", "address.postalCode", formData.address.postalCode, "text", <MapPinIcon size={18} />, false)}
                    {renderInputField("País", "address.country", formData.address.country, "text", <MapPinIcon size={18} />, false)}
                </div>

                {error && isUpdating && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleEditToggle}
                    disabled={isUpdating}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm flex items-center"
                  >
                    <XIcon size={16} className="mr-2"/> Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="bg-[#5CA4B8] text-[#FDFFFC] px-4 py-2 rounded-md hover:bg-[#62B6CB] transition-colors text-sm flex items-center disabled:opacity-50"
                  >
                    {isUpdating ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Guardando...
                        </>
                    ) : (
                        <>
                           <SaveIcon size={16} className="mr-2"/> Guardar Cambios
                        </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
                // Fallback if !profileData in display mode (already handled by main error display but good for structure)
                <p>No hay información de perfil para mostrar.</p>
            )}
          </div>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={() => {
          alert('Password changed successfully!');
        }}
      />
    </div>
  );
}