// pages/Login/LoginPage.tsx

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// ... other imports ...
import authService from '../../services/AuthService';
import { PublicLayout } from '../../components/public/layout/PublicLayout';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from 'lucide-react';

// ... FullPageLoader component is fine ...

export function LoginPage() {
  const [isVerifying, setIsVerifying] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // NEW: State to manage which step of the login we are on
  const [loginStep, setLoginStep] = useState<'credentials' | '2fa'>('credentials');

  const [formData, setFormData] = useState({
    email: '', // This will be sent as usernameOrEmail
    password: '',
    twoFactorCode: '' // New field for the 2FA code
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // This verification logic is now perfect
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

  // UPDATED: This now handles the initial login request
  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Call login with email and password
      const response = await authService.login(formData.email, formData.password);

      if (response.succeeded) {
        navigate('/dashboard');
      } else if (response.requires2FA) {
        // ---- THIS IS THE 2FA LOGIC ----
        // Stay on the page, but switch to the 2FA input view
        setLoginStep('2fa');
      } else {
        // This case should ideally not be hit if backend returns 401 on failure,
        // but as a fallback:
        setError(response.message || 'An unknown error occurred.');
      }
    } catch (err: any) {
      // Error from Axios interceptor (e.g., 401 Unauthorized)
      setError(err.message || 'Invalid credentials or server error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // NEW: Handler for submitting the 2FA code
  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Call login again, but this time with the 2FA code.
      // The email/username is needed by SignInManager to find the user in the 2FA flow.
      const response = await authService.login(formData.email, undefined, formData.twoFactorCode);

      if (response.succeeded) {
        navigate('/dashboard');
      } else {
        setError(response.message || 'Invalid 2FA code.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid 2FA code or session expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return <PublicLayout>Loading...</PublicLayout>;
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
                    : 'Ingresa el código de tu app de autenticación.'}
                </p>
              </div>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">
                  <span>{error}</span>
                </div>
              )}

              {/* ---- CONDITIONAL FORM RENDERING ---- */}

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
                        name="password" // Added name attribute for handler
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
                    {/* Use Link for internal navigation */}
                    <Link to="/forgot-password" className="text-sm text-[#62B6CB] hover:text-[#1B4965]">
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </div>

                  <button type="submit" disabled={isSubmitting} className="...">
                    {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit2FA} className="space-y-6 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-[#101828] mb-2">
                      Código de Autenticación
                    </label>
                    <input
                      type="text"
                      name="twoFactorCode"
                      required
                      value={formData.twoFactorCode}
                      onChange={handleInputChange}
                      className="py-2 px-3 w-full border border-gray-300 rounded-lg text-center tracking-[.5em]"
                      placeholder="123456"
                      maxLength={6}
                      disabled={isSubmitting}
                    />
                  </div>
                  <button type="submit" disabled={isSubmitting} className="...">
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