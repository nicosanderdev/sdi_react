import React, { useState } from 'react';
import { PublicLayout } from '../../components/public/layout/PublicLayout';
import { BuildingIcon, UserIcon, MailIcon, PhoneIcon, LockIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    password: ''
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle registration logic here
    console.log('Registration attempt:', formData);
  };
  return <PublicLayout>
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] py-16">
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-sm border border-gray-100">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[#1B4965] mb-2">
                Crear Cuenta
              </h1>
              <p className="text-gray-600">
                Comienza a gestionar tu inmobiliaria de forma eficiente
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#101828] mb-2">
                  Nombre de la inmobiliaria
                </label>
                <div className="relative">
                  <input type="text" required value={formData.companyName} onChange={e => setFormData({
                  ...formData,
                  companyName: e.target.value
                })} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="Tu Inmobiliaria" />
                  <BuildingIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101828] mb-2">
                  Nombre del contacto
                </label>
                <div className="relative">
                  <input type="text" required value={formData.contactName} onChange={e => setFormData({
                  ...formData,
                  contactName: e.target.value
                })} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="Tu nombre completo" />
                  <UserIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-[#101828] mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <input type="email" required value={formData.email} onChange={e => setFormData({
                    ...formData,
                    email: e.target.value
                  })} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="tu@empresa.com" />
                    <MailIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101828] mb-2">
                    Teléfono
                  </label>
                  <div className="relative">
                    <input type="tel" required value={formData.phone} onChange={e => setFormData({
                    ...formData,
                    phone: e.target.value
                  })} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="+34 600 000 000" />
                    <PhoneIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#101828] mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={e => setFormData({
                  ...formData,
                  password: e.target.value
                })} className="pl-10 pr-12 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" placeholder="••••••••" />
                  <LockIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <input type="checkbox" id="terms" required className="h-4 w-4 text-[#62B6CB] border-gray-300 rounded focus:ring-[#62B6CB]" />
                <label htmlFor="terms" className="ml-2 text-sm text-gray-600">
                  Acepto los{' '}
                  <a href="/terms" className="text-[#62B6CB] hover:text-[#1B4965]">
                    términos y condiciones
                  </a>
                </label>
              </div>
              <button type="submit" className="w-full bg-[#62B6CB] text-[#FDFFFC] py-2 rounded-md hover:opacity-90 transition-colors">
                Crear Cuenta
              </button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                ¿Ya tienes una cuenta?{' '}
                <a href="/login" className="text-[#62B6CB] hover:text-[#1B4965]">
                  Inicia sesión
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>;
}