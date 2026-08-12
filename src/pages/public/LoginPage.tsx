import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import authService from '../../services/AuthService';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, Shield } from 'lucide-react';
import { TwoFactorInput } from '../../components/public/TwoFactorInput';
import { AuthCard } from '../../components/public/AuthCard';
import { SocialAuthButtons } from '../../components/public/SocialAuthButtons';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { getRedirectPath } from '../../utils/RoleUtils';
import { useAppDispatch } from '../../hooks/reduxHooks';
import { fetchUserProfile } from '../../store/slices/userSlice';
import { Button, TextInput, Checkbox } from 'flowbite-react';
import { supabase } from '../../config/supabase';
import { Roles } from '../../models/Roles';

const PANEL_ALLOWED_ROLES = new Set<string>([Roles.Admin, Roles.User]);
const SHOW_REGISTER_LINK = true;

export function LoginPage() {

  const [isVerifying, setIsVerifying] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loginStep, setLoginStep] = useState<'credentials' | '2fa'>('credentials');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    twoFactorCode: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const twoFaFormRef = useRef<HTMLFormElement>(null);

  const resolveRedirectAfterAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No se pudo verificar la sesión autenticada.');
    }

    const profile = await dispatch(fetchUserProfile(session.user)).unwrap();
    const normalizedRole = String(profile?.role ?? '').toLowerCase();

    if (!PANEL_ALLOWED_ROLES.has(normalizedRole)) {
      await authService.logout();
      throw new Error('Tu cuenta no tiene permisos para acceder al panel.');
    }

    const redirectPath = getRedirectPath(profile);
    window.location.href = redirectPath;
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsVerifying(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        try {
          const profile = await dispatch(fetchUserProfile(session.user)).unwrap();
          const normalizedRole = String(profile?.role ?? '').toLowerCase();

          if (PANEL_ALLOWED_ROLES.has(normalizedRole)) {
            const redirectPath = getRedirectPath(profile);
            window.location.href = redirectPath;
          } else {
            await authService.logout();
            setError('Tu cuenta no tiene permisos para acceder al panel.');
          }
        } catch {
          await authService.logout();
          setError('No se pudo validar tu perfil de acceso al panel.');
        }
      }

      setIsVerifying(false);
    };
    void checkAuthStatus();
  }, [dispatch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handle2faCodeChange = (code: string) => {
    setFormData(prev => ({ ...prev, twoFactorCode: code }));
  };
  
  const handle2faComplete = (code: string) => {
    setFormData(prev => ({...prev, twoFactorCode: code }));
    setTimeout(() => {
        twoFaFormRef.current?.requestSubmit();
    }, 100);
  };

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    try {
      setIsSubmitting(true);
      setError(null);

      const { error } = await authService.signInWithOAuthProvider(provider);

      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message || `${provider} login failed`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authService.login(formData.email, formData.password);
      if (response.succeeded && response.user) {
        await resolveRedirectAfterAuth();
      } else if (response.requires2FA) {
        // For Supabase MFA, we need to initiate the challenge
        setLoginStep('2fa');
      } else {
        setError(response.errorMessage || 'Invalid login attempt. Please check your username and password.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or server error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.twoFactorCode.length < 6) {
        setError("Please enter the complete 6-digit code.");
        return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      // For Supabase, we need to handle MFA verification differently
      // Since MFA challenge happens during initial login, we use verifyOtp
      const response = await authService.login(formData.email, undefined, formData.twoFactorCode);
      if (response.succeeded && response.user) {
        await resolveRedirectAfterAuth();
      } else {
        setFormData(prev => ({ ...prev, twoFactorCode: '' }));
        setError(response.errorMessage || 'Invalid 2FA code.');
      }
    } catch (err: any) {
      setFormData(prev => ({ ...prev, twoFactorCode: '' }));
      setError(err.message || 'Invalid 2FA code or session expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-600"></div>
            <p className="mt-4 text-lg text-gray-900 dark:text-white font-semibold">Cargando...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <AuthCard
        title={loginStep === 'credentials' ? 'Iniciar Sesión' : 'Verificación en dos pasos'}
        subtitle={loginStep === 'credentials'
          ? 'Accede a tu panel de gestión'
          : 'Ingresa el código de 6 dígitos de tu app de autenticación.'}
        icon={<Shield className="w-8 h-8 text-green-600 dark:text-green-400" />}
      >
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6" role="alert">
            <span>{error}</span>
          </div>
        )}

        {loginStep === 'credentials' ? (
          <form data-testid="login-form" onSubmit={handleSubmitCredentials} className="space-y-6">
            <div>
              <TextInput
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                placeholder="tu@empresa.com"
                disabled={isSubmitting}
                icon={MailIcon}
                color={error ? "failure" : "gray"}
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
                disabled={isSubmitting}
                icon={LockIcon}
                color={error ? "failure" : "gray"}
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
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    disabled={isSubmitting}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Checkbox
                  id="remember"
                  disabled={isSubmitting}
                />
                <label htmlFor="remember" className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Recordarme
                </label>
              </div>
              <Link to="/forgot-password" className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="text-right">
              <Link to="/forgot-password?mode=recover-account" className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
                ¿Olvidaste tu correo? Recupera tu cuenta
              </Link>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              color="green"
              className="w-full"
            >
              {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
            </Button>
            <SocialAuthButtons
              onGoogle={() => void handleOAuthLogin('google')}
              onFacebook={() => void handleOAuthLogin('facebook')}
              disabled={isSubmitting}
              showTermsHint
            />
            {SHOW_REGISTER_LINK && (
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300">
                  Regístrate
                </Link>
              </p>
            )}
          </form>
        ) : (
          <form data-testid="login-form" ref={twoFaFormRef} onSubmit={handleSubmit2FA} className="space-y-8">
            <div>
              <TwoFactorInput
                length={6}
                value={formData.twoFactorCode}
                onChange={handle2faCodeChange}
                onComplete={handle2faComplete}
                disabled={isSubmitting}
              />
            </div>
            <Button
              type="submit"
              disabled={isSubmitting || formData.twoFactorCode.length < 6}
              color="success"
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Verificando...' : 'Verificar Código'}
            </Button>
          </form>
        )}

      </AuthCard>
    </PublicLayout>
  );
}
