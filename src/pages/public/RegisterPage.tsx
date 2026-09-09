import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, CalendarIcon, AlertCircleIcon, UserPlus, PhoneIcon } from 'lucide-react';
import AuthService, { RegisterUserPayload } from '../../services/AuthService';
import { SuccessDisplay } from '../../components/ui/SuccessDisplay';
import { ErrorDisplay } from '../../components/ui/ErrorDisplay';
import { AuthCard } from '../../components/public/AuthCard';
import { SocialAuthButtons } from '../../components/public/SocialAuthButtons';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { Button, TextInput, Checkbox } from 'flowbite-react';

export function RegisterPage() {
  const [view, setView] = useState<'form' | 'success' | 'error'>('form');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthday: '',
    password: '',
    repeatPassword: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [errors, setErrors] = useState({
    birthday: '',
    repeatPassword: '',
    email: '',
    phone: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

  const validateForm = () => {
    setErrors({
      birthday: '',
      repeatPassword: '',
      email: '',
      phone: '',
      password: '',
      firstName: '',
      lastName: ''
    });
    setApiError(null);

    let isValid = true;
    const newErrors = {
      birthday: '',
      repeatPassword: '',
      email: '',
      phone: '',
      password: '',
      firstName: '',
      lastName: ''
    };

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'El nombre es obligatorio.';
      isValid = false;
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Los apellidos son obligatorios.';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio.';
      isValid = false;
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Por favor, ingresa un correo electrónico válido.';
      isValid = false;
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es obligatorio.';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'La contraseña es obligatoria.';
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
      isValid = false;
    }

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

  const handleOAuthRegister = async (provider: 'google') => {
    if (!acceptedTerms) {
      setApiError('Debes aceptar los términos y condiciones para continuar.');
      return;
    }

    try {
      setIsLoading(true);
      setApiError(null);

      const { error } = await AuthService.signInWithOAuthProvider(provider);

      if (error) {
        setApiError(error.message);
      }
    } catch (err: any) {
      setApiError(err.message || `Error al registrarse con ${provider}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) {
      return;
    }

    if (!acceptedTerms) {
      setApiError('Debes aceptar los términos y condiciones para continuar.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setApiError(null);

    const payload: RegisterUserPayload = {
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      password: formData.password,
    };

    try {
      const response = await AuthService.registerUser(payload);
      if (response.success) {
        setView('success');
      } else {
        setView('error');
        setApiError(response.message || 'Ocurrió un error durante el registro. Por favor, inténtalo de nuevo.');
      }
    } catch (error: any) {
      console.error('Registration API error:', error);

      let errorMessage = 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.';

      if (error.message) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('email') && errorMsg.includes('already')) {
          errorMessage = 'Esta dirección de correo electrónico ya está registrada. Por favor, intenta iniciar sesión o utiliza una dirección diferente.';
        } else if (
          (errorMsg.includes('phone') && (errorMsg.includes('already') || errorMsg.includes('unique') || errorMsg.includes('duplicate'))) ||
          errorMsg.includes('members_phone')
        ) {
          errorMessage = 'Este número de teléfono ya está registrado. Por favor, utiliza un número diferente.';
        } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
          errorMessage = 'Error de conexión. Por favor, verifica tu conexión a internet e inténtalo de nuevo.';
        } else if (errorMsg.includes('temporarily unavailable') || errorMsg.includes('default signup plan')) {
          errorMessage = 'El registro no está disponible temporalmente. Por favor, inténtalo más tarde.';
        } else if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
          errorMessage = 'Los datos proporcionados no son válidos. Por favor, revisa la información e inténtalo de nuevo.';
        } else if (errorMsg.includes('server') || errorMsg.includes('internal')) {
          errorMessage = 'Error del servidor. Por favor, inténtalo de nuevo en unos momentos.';
        } else {
          errorMessage = error.message;
        }
      }

      setApiError(errorMessage);
      setView('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

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
        {view === 'form' && (
          <>
            {apiError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6" role="alert">
                <span>{apiError}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <TextInput
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="Nombre"
                    icon={UserIcon}
                    color={errors.firstName ? "failure" : "gray"}
                    helperText={errors.firstName ? (
                      <span className="flex items-center gap-1 text-red-600 text-xs">
                        <AlertCircleIcon size={14} />
                        {errors.firstName}
                      </span>
                    ) : undefined}
                  />
                </div>
                <div>
                  <TextInput
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Apellidos"
                    icon={UserIcon}
                    color={errors.lastName ? "failure" : "gray"}
                    helperText={errors.lastName ? (
                      <span className="flex items-center gap-1 text-red-600 text-xs">
                        <AlertCircleIcon size={14} />
                        {errors.lastName}
                      </span>
                    ) : undefined}
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
                  helperText={errors.email ? (
                    <span className="flex items-center gap-1 text-red-600 text-xs">
                      <AlertCircleIcon size={14} />
                      {errors.email}
                    </span>
                  ) : undefined}
                />
              </div>
              <div>
                <TextInput
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="Teléfono"
                  icon={PhoneIcon}
                  color={errors.phone ? "failure" : "gray"}
                  helperText={errors.phone ? (
                    <span className="flex items-center gap-1 text-red-600 text-xs">
                      <AlertCircleIcon size={14} />
                      {errors.phone}
                    </span>
                  ) : undefined}
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
                  theme={{
                    field: {
                      rightIcon: {
                        base: 'pointer-events-auto absolute inset-y-0 right-0 flex items-center pr-3',
                        svg: 'h-5 w-5 text-gray-500 dark:text-gray-400',
                      },
                    },
                  }}
                  helperText={errors.password ? (
                    <span className="flex items-center gap-1 text-red-600 text-xs">
                      <AlertCircleIcon size={14} />
                      {errors.password}
                    </span>
                  ) : undefined}
                  rightIcon={() => (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                  theme={{
                    field: {
                      rightIcon: {
                        base: 'pointer-events-auto absolute inset-y-0 right-0 flex items-center pr-3',
                        svg: 'h-5 w-5 text-gray-500 dark:text-gray-400',
                      },
                    },
                  }}
                  rightIcon={() => (
                    <button
                      type="button"
                      onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label={showRepeatPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
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
                color="green"
                className="w-full"
              >
                {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
              </Button>
              <SocialAuthButtons
                onGoogle={() => void handleOAuthRegister('google')}
                disabled={isLoading || !acceptedTerms}
              />
            </form>
            <div className="text-center mt-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                ¿Ya tienes una cuenta?{' '}
                <Link to="/login" className="font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
                  Inicia sesión
                </Link>
              </p>
            </div>
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
