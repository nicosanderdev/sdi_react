import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import authService from '../../services/AuthService';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, Shield } from 'lucide-react';
import { TwoFactorInput } from '../../components/public/TwoFactorInput';
import { AuthCard } from '../../components/public/AuthCard';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { getRedirectPath } from '../../utils/RoleUtils';
import { useAppDispatch } from '../../hooks/reduxHooks';
import { fetchUserProfile } from '../../store/slices/userSlice';
import { Button, TextInput, Checkbox } from 'flowbite-react';
import { supabase } from '../../config/supabase';

export function LoginPage() {

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25C22.56 11.45 22.49 10.68 22.36 9.93H12.25V14.4H18.1C17.84 15.93 17.06 17.21 15.82 18.06V20.75H19.46C21.45 18.99 22.56 15.9 22.56 12.25Z" fill="#4285F4"/><path d="M12.25 23C15.47 23 18.2 21.94 20.04 20.1L16.4 17.45C15.33 18.15 13.89 18.57 12.25 18.57C9.22 18.57 6.65 16.68 5.68 14.04H1.94V16.81C3.76 20.44 7.69 23 12.25 23Z" fill="#34A853"/><path d="M5.68 14.04C5.43 13.34 5.3 12.6 5.3 11.83C5.3 11.05 5.43 10.31 5.68 9.61V6.84H1.94C1.23 8.26 0.85 9.98 0.85 11.83C0.85 13.67 1.23 15.39 1.94 16.81L5.68 14.04Z" fill="#FBBC05"/><path d="M12.25 5.18C13.99 5.18 15.26 5.86 15.84 6.4L18.49 3.84C16.69 2.13 14.6 1 12.25 1C7.69 1 3.76 3.56 1.94 7.19L5.68 9.96C6.65 7.32 9.22 5.18 12.25 5.18Z" fill="#EA4335"/></svg>
  );

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
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  
  const twoFaFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsVerifying(true);
      const user = await authService.verifyAuth();
      if (user && user.isAuthenticated) {
        // dispatch(fetchUserProfile());
        const redirectPath = getRedirectPath(user);
        navigate(redirectPath);
      } else {
        setIsVerifying(false);
      }
    };
    checkAuthStatus();
  }, [navigate, dispatch]);

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

  const handleGoogleLogin = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) {
        setError(error.message);
      }
      // Note: The redirect will happen automatically if successful
    } catch (err: any) {
      setError(err.message || 'Google login failed');
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
        dispatch(fetchUserProfile());
        const redirectPath = getRedirectPath(response.user);
        navigate(redirectPath);
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
        // Fetch user profile data and load it into the Redux store
        dispatch(fetchUserProfile());
        // Redirect based on user role
        const redirectPath = getRedirectPath(response.user);
        navigate(redirectPath);
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
          <form onSubmit={handleSubmitCredentials} className="space-y-6">
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
                rightIcon={() => (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                    disabled={isSubmitting}
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

            <Button
              type="submit"
              disabled={isSubmitting}
              color="success"
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
            </Button>
                </form>
        ) : (
          <form ref={twoFaFormRef} onSubmit={handleSubmit2FA} className="space-y-8">
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

        <Button
          onClick={handleGoogleLogin}
          color="light"
          className="w-full flex items-center justify-center gap-3 my-6"
          disabled={isSubmitting}
        >
          <GoogleIcon />
          Continuar con Google
        </Button>

        <div className="text-center">
          <Link to="/register" className="text-sm text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">
            ¿No tienes cuenta? <span className="font-semibold">Regístrate</span>
          </Link>
        </div>
      </AuthCard>
    </PublicLayout>
  );
}