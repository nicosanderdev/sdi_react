import React, { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { UserIcon, MailIcon, PhoneIcon, LockIcon, CameraIcon, MapPinIcon, BriefcaseIcon, Edit3Icon, SaveIcon, XIcon } from 'lucide-react';
import profileService, { ProfileData, AddressData, UpdateProfilePayload } from '../../services/ProfileService'; // Adjust path as needed
import { ChangePasswordModal } from '../../components/user/ChangePasswordModal';
import { EmailPhoneVerificationModal } from '../../components/user/EmailPhoneVerificationModal';
import type { VerificationType } from '../../components/user/EmailPhoneVerificationModal';
import { IconWrapper } from '../../components/ui/IconWrapper';
import { Button, Card, Label, TextInput } from 'flowbite-react';
import { fetchUserProfile } from '../../store/slices/userSlice';

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
  const dispatch = useDispatch();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState<ProfileData>(initialProfileState);
  const [editing, setEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [verificationModalType, setVerificationModalType] = useState<VerificationType | null>(null);
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
      dispatch(fetchUserProfile());
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update profile.');
      console.error(err);
    }
  };

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);

      const fd = new FormData();
      fd.append('avatar', file);
      setIsAvatarUploading(true);
      setError(null);
      try {
        const response = await profileService.uploadProfilePicture(fd);
        setProfileData(prev => prev ? { ...prev, avatarUrl: response.avatarUrl } : null);
        setFormData(prev => ({ ...prev, avatarUrl: response.avatarUrl }));
        setAvatarPreview(null); // Clear preview since we now have the uploaded URL
        dispatch(fetchUserProfile());
      } catch (err: any) {
        let errorMessage = 'Failed to upload avatar.';
        if (err.message?.includes('bucket not found')) {
          errorMessage = 'Avatar storage is not configured. Please contact an administrator.';
        } else if (err.message?.includes('Storage service unavailable')) {
          errorMessage = 'Storage service is temporarily unavailable. Please try again later.';
        } else if (err.message) {
          errorMessage = err.message;
        }
        setError(errorMessage);
        setAvatarPreview(profileData?.avatarUrl || null);
        console.error(err);
      } finally {
        // Clean up object URL to prevent memory leaks
        URL.revokeObjectURL(objectUrl);
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
      <div className="mr-4 shrink-0">
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
    icon?: any,
    required: boolean = true,
    disabled: boolean = false
  ) => (
    <div>
      <Label htmlFor={name}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative mt-1">
        <TextInput
          type={type}
          name={name}
          id={name}
          value={value || ''}
          onChange={handleInputChange}
          required={required}
          disabled={disabled}
          icon={icon}
          />
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Mi Perfil</h1>
      {error && !isUpdating && !isAvatarUploading && ( // Show general errors not related to ongoing operations
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
            </div>
        )}
      <Card>
        <div className="flex flex-col md:flex-row">
          {/* Profile Picture and Basic Info */}
          <div className="md:w-1/3 mb-6 md:mb-0 flex flex-col items-center">
            <div className="relative">
              <div className="h-40 w-40 rounded-full bg-primary-200 flex items-center justify-center text-secondary-800 overflow-hidden border-2 border-secondary-600/25 dark:border-secondary-800">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="h-full w-full object-cover" />
                ) : currentData.avatarUrl ? (
                  <img src={currentData.avatarUrl} alt={currentData.firstName} className="h-full w-full object-cover" />
                ) : (
                  <IconWrapper icon={UserIcon} size={80} />
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
                className="absolute bottom-0 right-0 rounded-full hover:bg-primary-200 transition-colors shadow-md"
                title="Change profile picture"
                disabled={isAvatarUploading}
              >
                {isAvatarUploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <IconWrapper icon={CameraIcon} hoverable={true} size={30} />}
              </button>
            </div>
            <h2 className="text-xl font-semibold mt-4">{currentData.firstName} {currentData.lastName}</h2>
            <p>{currentData.title || 'Título no especificado'}</p>
          </div>

          {/* Personal Information / Edit Form */}
          <div className="md:w-2/3 md:pl-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">
                Información Personal
              </h3>
            </div>

            {!editing && profileData ? (
              <div className="space-y-5">
                {renderInfoField(<IconWrapper icon={UserIcon} size={20} />, "Nombre completo", `${profileData.firstName} ${profileData.lastName}`)}
                {renderInfoField(<IconWrapper icon={BriefcaseIcon} size={20} />, "Título / Cargo", profileData.title)}
                <div id="onboarding-verification-section" className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="mr-4 shrink-0"><IconWrapper icon={MailIcon} size={20} /></div>
                      <div>
                        <p className="text-sm text-gray-500">Correo electrónico</p>
                        <p className="font-medium break-words">{profileData.email || '-'}</p>
                      </div>
                    </div>
                    <Button size="xs" color="light" onClick={() => setVerificationModalType('email')}>Cambiar correo</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="mr-4 shrink-0"><IconWrapper icon={PhoneIcon} size={20} /></div>
                      <div>
                        <p className="text-sm text-gray-500">Teléfono</p>
                        <p className="font-medium break-words">{profileData.phone || '-'}</p>
                      </div>
                    </div>
                    <Button size="xs" color="light" onClick={() => setVerificationModalType('phone')}>Cambiar teléfono</Button>
                  </div>
                </div>
                <div className="flex">
                     <div className="mr-4 shrink-0">
                        <IconWrapper icon={MapPinIcon} size={20} />
                     </div>
                     <div>
                        <p className="text-sm">Dirección</p>
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
                    {renderInputField("Nombre", "firstName", formData.firstName, "text", UserIcon)}
                    {renderInputField("Apellido", "lastName", formData.lastName, "text", UserIcon)}
                </div>
                {renderInputField("Título / Cargo (Opcional)", "title", formData.title, "text", BriefcaseIcon, false)}
                {renderInputField("Correo Electrónico", "email", formData.email, "email", MailIcon, true, true)}
                {renderInputField("Teléfono (Opcional)", "phone", formData.phone, "tel", PhoneIcon, false)}
                
                <h4 className="text-md font-semibold pt-2">Dirección (Opcional)</h4>
                {renderInputField("Calle y Número", "address.street", formData.address.street, "text", false)}
                {renderInputField("Apartamento, suite, etc.", "address.street2", formData.address.street2, "text", false)}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputField("Ciudad", "address.city", formData.address.city, "text", false)}
                    {renderInputField("Estado / Provincia", "address.state", formData.address.state, "text", false)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderInputField("Código Postal", "address.postalCode", formData.address.postalCode, "text", false)}
                    {renderInputField("País", "address.country", formData.address.country, "text", false)}
                </div>

                {error && isUpdating && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    color="alternative"
                    onClick={handleEditToggle}
                    disabled={isUpdating}>
                    <XIcon size={16} className="mr-2"/>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isUpdating}>
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
                  </Button>
                </div>
              </form>
            ) : (
                <p>No hay información de perfil para mostrar.</p>
            )}
            <div className="flex justify-end">
                {!editing ? (
                    <div className="flex space-x-2">
                        <Button
                        size='md'
                        color="alternative"
                        onClick={() => setIsChangePasswordModalOpen(true)}
                        >
                        <LockIcon size={10}
                        className="mr-2" />
                        Cambiar Contraseña
                        </Button>
                        
                        <Button
                        size='md'
                        onClick={handleEditToggle}
                        >
                        <Edit3Icon size={10}
                        className="mr-2"/> 
                        Editar Perfil
                        </Button>
                    </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
        onSuccess={() => {
          alert('Password changed successfully!');
        }}
      />
      {verificationModalType && (
        <EmailPhoneVerificationModal
          isOpen={!!verificationModalType}
          onClose={() => setVerificationModalType(null)}
          onSuccess={async () => {
            dispatch(fetchUserProfile());
            const data = await profileService.getCurrentUserProfile();
            setProfileData(data);
            setFormData(data);
          }}
          type={verificationModalType}
          memberId={profileData?.id}
        />
      )}
    </div>
  );
}