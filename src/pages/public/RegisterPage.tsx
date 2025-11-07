import React, { useState } from 'react';
import { UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowLeftIcon, CalendarIcon, AlertCircleIcon } from 'lucide-react';
import AuthService, { RegisterUserPayload } from '../../services/AuthService';
import { SuccessDisplay } from '../../components/ui/SuccessDisplay';
import { ErrorDisplay } from '../../components/ui/ErrorDisplay';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { useAppDispatch } from '../../hooks/reduxHooks';
import { fetchUserProfile } from '../../store/slices/userSlice';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25C22.56 11.45 22.49 10.68 22.36 9.93H12.25V14.4H18.1C17.84 15.93 17.06 17.21 15.82 18.06V20.75H19.46C21.45 18.99 22.56 15.9 22.56 12.25Z" fill="#4285F4"/><path d="M12.25 23C15.47 23 18.2 21.94 20.04 20.1L16.4 17.45C15.33 18.15 13.89 18.57 12.25 18.57C9.22 18.57 6.65 16.68 5.68 14.04H1.94V16.81C3.76 20.44 7.69 23 12.25 23Z" fill="#34A853"/><path d="M5.68 14.04C5.43 13.34 5.3 12.6 5.3 11.83C5.3 11.05 5.43 10.31 5.68 9.61V6.84H1.94C1.23 8.26 0.85 9.98 0.85 11.83C0.85 13.67 1.23 15.39 1.94 16.81L5.68 14.04Z" fill="#FBBC05"/><path d="M12.25 5.18C13.99 5.18 15.26 5.86 15.84 6.4L18.49 3.84C16.69 2.13 14.6 1 12.25 1C7.69 1 3.76 3.56 1.94 7.19L5.68 9.96C6.65 7.32 9.22 5.18 12.25 5.18Z" fill="#EA4335"/></svg>
);

export function RegisterPage() {
  const dispatch = useAppDispatch();
  const [view, setView] = useState<'initial' | 'form' | 'success' | 'error'>('initial');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    birthday: '',
    password: '',
    repeatPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [errors, setErrors] = useState({ birthday: '', repeatPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const validateForm = () => {
    // Clear previous errors
    setErrors({ birthday: '', repeatPassword: '' });
    setApiError(null);
    
    let isValid = true;
    const newErrors = { birthday: '', repeatPassword: '' };

    if (formData.password !== formData.repeatPassword) {
      newErrors.repeatPassword = 'Las contraseñas no coinciden.';
      isValid = false;
    }

    if (formData.birthday) {
      const birthDate = new Date(formData.birthday);
      const today = new Date();
      const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
      if (birthDate > eighteenYearsAgo) {
        newErrors.birthday = 'Debes ser mayor de 18 años para registrarte.';
        isValid = false;
      }
    } else {
      newErrors.birthday = 'La fecha de nacimiento es obligatoria.';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setApiError(null);

    const payload: RegisterUserPayload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
    };

    try {
      const response = await AuthService.registerUser(payload);
      if (response.success) {
        console.log('Registration successful:');
        dispatch(fetchUserProfile());
        setView('success');
      } else {
        setView('error');
        setApiError(response.errorMessage || 'Ocurrió un error durante el registro. Por favor, inténtalo de nuevo.');
      }
    } catch (error: any) {
        setApiError(error.message || 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.');
        console.error('Registration API error:', error);
        setView('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleExternalAuth = () => {
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google-login`;
  }

  const handleRetry = () => {
    setApiError(null);
    setView('form');
  };
  
  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] py-16 flex items-center justify-center">
        <div className="max-w-lg w-full mx-auto px-4">
          <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-sm border border-gray-100 relative">
            {view === 'initial' && (
              // --- Initial View ---
              <div className="text-center">
                 <h1 className="text-2xl font-bold text-[#1B4965] mb-2">Crear una cuenta</h1>
                <p className="text-gray-600 mb-8">Únete a nuestra plataforma.</p>
                <div className="space-y-4">
                  <button onClick={() => setView('form')} className="w-full bg-[#62B6CB] text-[#FDFFFC] py-2.5 rounded-md hover:opacity-90 transition-colors font-medium">
                    Registrarse con correo electrónico
                  </button>
                  <button onClick={() => handleExternalAuth()} className="w-full flex items-center justify-center gap-3 bg-white text-[#101828] py-2.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors font-medium">
                    <GoogleIcon />
                    Registrarse con Google
                  </button>
                </div>
                 <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    ¿Ya tienes una cuenta?{' '}
                    <a href="/login" className="font-medium text-[#62B6CB] hover:text-[#1B4965]">
                      Inicia sesión
                    </a>
                  </p>
                </div>
              </div>
            )}

            {view === 'form' && (
              <>
                <button onClick={() => setView('initial')} className="absolute top-4 left-4 text-gray-500 hover:text-[#1B4965] transition-colors" aria-label="Volver">
                  <ArrowLeftIcon size={24} />
                </button>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-[#1B4965] mb-2">Crear Cuenta con Email</h1>
                  <p className="text-gray-600">Completa tus datos para empezar.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-[#101828] mb-1.5">Nombre</label>
                      <div className="relative">
                        <input type="text" name="firstName" required value={formData.firstName} onChange={handleInputChange} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="John" />
                        <UserIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#101828] mb-1.5">Apellidos</label>
                      <div className="relative">
                        <input type="text" name="lastName" required value={formData.lastName} onChange={handleInputChange} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="Doe" />
                        <UserIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101828] mb-1.5">Correo electrónico</label>
                    <div className="relative">
                      <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="tu@correo.com" />
                      <MailIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101828] mb-1.5">Fecha de nacimiento</label>
                    <div className="relative">
                      <input type="date" name="birthday" required value={formData.birthday} onChange={handleInputChange} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
                      <CalendarIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                    {errors.birthday && <p className="flex items-center gap-1 text-red-600 text-xs mt-1.5"><AlertCircleIcon size={14} />{errors.birthday}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101828] mb-1.5">Contraseña</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} name="password" required value={formData.password} onChange={handleInputChange} className="pl-10 pr-12 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="••••••••" />
                      <LockIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101828] mb-1.5">Repetir contraseña</label>
                    <div className="relative">
                      <input type={showRepeatPassword ? 'text' : 'password'} name="repeatPassword" required value={formData.repeatPassword} onChange={handleInputChange} className="pl-10 pr-12 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="••••••••" />
                      <LockIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <button type="button" onClick={() => setShowRepeatPassword(!showRepeatPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                        {showRepeatPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                      </button>
                    </div>
                    {errors.repeatPassword && <p className="flex items-center gap-1 text-red-600 text-xs mt-1.5"><AlertCircleIcon size={14} />{errors.repeatPassword}</p>}
                  </div>
                  <div className="flex items-center pt-2">
                    <input type="checkbox" id="terms" required className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
                    <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                      Acepto los{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#62B6CB] hover:text-[#1B4965] underline">
                        términos y condiciones
                      </a>
                    </label>
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-[#62B6CB] text-[#FDFFFC] py-2 rounded-md hover:opacity-90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
                  </button>
                </form>
              </>
            )}

            {view === 'success' && (
              <SuccessDisplay
                title="¡Registro exitoso!"
                message="Tu cuenta ha sido creada. Serás redirigido al panel de control."
                redirectUrl="/dashboard"
              />
            )}

            {view === 'error' && apiError && (
              <ErrorDisplay
                title="Error en el registro"
                message={apiError}
                buttonText="Intentar de nuevo"
                onRetry={handleRetry}
              />
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}