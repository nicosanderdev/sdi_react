import React, { useState } from 'react';
import { PublicLayout } from '../../components/public/layout/PublicLayout';
import { MailIcon } from 'lucide-react';
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle password reset logic here
    console.log('Password reset requested for:', email);
    setSubmitted(true);
  };
  return <PublicLayout>
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] py-16">
        <div className="max-w-md mx-auto px-4">
          <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-sm border border-gray-100">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[#1B4965] mb-2">
                Recuperar Contraseña
              </h1>
              <p className="text-gray-600">
                Te enviaremos un enlace para restablecer tu contraseña
              </p>
            </div>
            {!submitted ? <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#101828] mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="tu@empresa.com" />
                    <MailIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                <button type="submit" className="w-full bg-[#62B6CB] text-[#FDFFFC] py-2 rounded-md hover:opacity-90 transition-colors">
                  Enviar Enlace
                </button>
              </form> : <div className="text-center">
                <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-6">
                  Si existe una cuenta con ese correo electrónico, recibirás un
                  enlace para restablecer tu contraseña.
                </div>
                <a href="/login" className="text-[#62B6CB] hover:text-[#1B4965]">
                  Volver al inicio de sesión
                </a>
              </div>}
            <div className="mt-6 text-center">
              <a href="/login" className="text-sm text-[#62B6CB] hover:text-[#1B4965]">
                Volver al inicio de sesión
              </a>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>;
}