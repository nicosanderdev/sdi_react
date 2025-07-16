// pages/Login/LoginPage.tsx

import React, { useState, useEffect, useRef } from 'react'; // Import useRef
import { Link, useNavigate } from 'react-router-dom';
import authService from '../../services/AuthService';
import { PublicLayout } from '../../components/public/layout/PublicLayout';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react';
import { TwoFactorInput } from './TwoFactorInput'; // <-- IMPORT THE NEW COMPONENT

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
  const navigate = useNavigate();
  
  // Create a ref for the 2FA form to trigger submission programmatically
  const twoFaFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsVerifying(true);
      const user = await authService.verifyAuth();
      if (user) {
        navigate('/dashboard');
      } else {
        setIsVerifying(false);
      }
    };
    checkAuthStatus();
  }, [navigate]);

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

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authService.login(formData.email, formData.password);

      if (response.succeeded) {
        navigate('/dashboard');
      } else if (response.requires2FA) {
          setLoginStep('2fa');
      } else {
        setError(response.message || 'An unknown error occurred.');
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
      const response = await authService.login(formData.email, undefined, formData.twoFactorCode);
      if (response.succeeded) {
        navigate('/dashboard');
      } else {
        setFormData(prev => ({ ...prev, twoFactorCode: '' }));
        setError(response.message || 'Invalid 2FA code.');
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
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC]">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#1B4965]"></div>
            <p className="mt-4 text-lg text-[#1B4965] font-semibold">Cargando...</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <>
      <PublicLayout>
        <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] py-16 flex items-center">
          <div className="max-w-md w-full mx-auto px-4">
            <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-sm border border-gray-100">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-[#1B4965] mb-2">
                  {loginStep === 'credentials' ? 'Iniciar Sesión' : 'Verificación en dos pasos'}
                </h1>
                <p className="text-gray-600">
                  {loginStep === 'credentials'
                    ? 'Accede a tu panel de gestión'
                    : 'Ingresa el código de 6 dígitos de tu app de autenticación.'}
                </p>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">
                  <span>{error}</span>
                </div>
              )}

              {loginStep === 'credentials' ? (
                <form onSubmit={handleSubmitCredentials} className="space-y-6 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101828] mb-2">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
                        placeholder="tu@empresa.com"
                        disabled={isSubmitting}
                      />
                      <MailIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#101828] mb-2">
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        className="pl-10 pr-12 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"
                        placeholder="••••••••"
                        disabled={isSubmitting}
                      />
                      <LockIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        disabled={isSubmitting}
                      >
                        {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                      </button>
                    </div>
                  </div>
                   <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="remember"
                        className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]"
                        disabled={isSubmitting}
                      />
                      <label htmlFor="remember" className="ml-2 text-sm text-gray-600">
                        Recordarme
                      </label>
                    </div>
                    <Link to="/forgot-password" className="text-sm text-[#62B6CB] hover:text-[#1B4965]">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-[#1B4965] text-white py-2 rounded-lg hover:bg-[#153a52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
                  </button>
                </form>
              ) : (
                // ---- THE UPDATED 2FA FORM ----
                <form ref={twoFaFormRef} onSubmit={handleSubmit2FA} className="space-y-8 mt-6">
                  <div>
                    <TwoFactorInput
                        length={6}
                        value={formData.twoFactorCode}
                        onChange={handle2faCodeChange}
                        onComplete={handle2faComplete}
                        disabled={isSubmitting}
                    />
                  </div>
                  <button type="submit" disabled={isSubmitting || formData.twoFactorCode.length < 6} className="w-full bg-[#1B4965] text-white py-2 rounded-lg hover:bg-[#153a52] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? 'Verificando...' : 'Verificar Código'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </PublicLayout>
    </>
  );
}