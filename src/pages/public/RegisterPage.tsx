import React, { useState } from 'react';
import { UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, ArrowLeftIcon, CalendarIcon, AlertCircleIcon, UserPlus } from 'lucide-react';
import AuthService, { RegisterUserPayload } from '../../services/AuthService';
import { SuccessDisplay } from '../../components/ui/SuccessDisplay';
import { ErrorDisplay } from '../../components/ui/ErrorDisplay';
import { AuthCard } from '../../components/public/AuthCard';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { useAppDispatch } from '../../hooks/reduxHooks';
import { fetchUserProfile } from '../../store/slices/userSlice';
import { Button, TextInput, Checkbox } from 'flowbite-react';

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
      <AuthCard
        title="Crear una cuenta"
        subtitle="Únete a nuestra plataforma"
        icon={<UserPlus className="w-8 h-8 text-green-600 dark:text-green-400" />}
      >
        {view === 'initial' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <Button
                onClick={() => setView('form')}
                color="success"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Registrarse con correo electrónico
              </Button>
              <Button
                onClick={() => handleExternalAuth()}
                color="light"
                className="w-full flex items-center justify-center gap-3"
              >
                <GoogleIcon />
                Registrarse con Google
              </Button>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ¿Ya tienes una cuenta?{' '}
                <a href="/login" className="font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
                  Inicia sesión
                </a>
              </p>
            </div>
          </div>
        )}

        {view === 'form' && (
          <>
            <button onClick={() => setView('initial')} className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors" aria-label="Volver">
              <ArrowLeftIcon size={24} />
            </button>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <TextInput
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="John"
                    icon={UserIcon}
                    color={errors.firstName ? "failure" : "gray"}
                  />
                </div>
                <div>
                  <TextInput
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Doe"
                    icon={UserIcon}
                    color={errors.lastName ? "failure" : "gray"}
                  />
                </div>
              </div>
              <div>
                <TextInput
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="tu@correo.com"
                  icon={MailIcon}
                  color={errors.email ? "failure" : "gray"}
                />
              </div>
              <div>
                <TextInput
                  type="date"
                  name="birthday"
                  required
                  value={formData.birthday}
                  onChange={handleInputChange}
                  icon={CalendarIcon}
                  color={errors.birthday ? "failure" : "gray"}
                  helperText={errors.birthday ? (
                    <span className="flex items-center gap-1 text-red-600 text-xs">
                      <AlertCircleIcon size={14} />
                      {errors.birthday}
                    </span>
                  ) : undefined}
                />
              </div>
              <div>
                <TextInput
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  icon={LockIcon}
                  color={errors.password ? "failure" : "gray"}
                  rightIcon={() => (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                  )}
                />
              </div>
              <div>
                <TextInput
                  type={showRepeatPassword ? 'text' : 'password'}
                  name="repeatPassword"
                  required
                  value={formData.repeatPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  icon={LockIcon}
                  color={errors.repeatPassword ? "failure" : "gray"}
                  rightIcon={() => (
                    <button
                      type="button"
                      onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showRepeatPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                  )}
                  helperText={errors.repeatPassword ? (
                    <span className="flex items-center gap-1 text-red-600 text-xs">
                      <AlertCircleIcon size={14} />
                      {errors.repeatPassword}
                    </span>
                  ) : undefined}
                />
              </div>
              <div className="flex items-center pt-2">
                <Checkbox
                  id="terms"
                  required
                />
                <label htmlFor="terms" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Acepto los{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 underline">
                    términos y condiciones
                  </a>
                </label>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                color="success"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
              </Button>
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
      </AuthCard>
    </PublicLayout>
  );
}