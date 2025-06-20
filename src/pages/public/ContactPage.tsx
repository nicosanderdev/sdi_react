import React, { useState } from 'react';
import { PublicLayout } from '../../components/public/layout/PublicLayout';
import { UserIcon, MailIcon, PhoneIcon, MessageSquareIcon, MapPinIcon, ClockIcon, PhoneCallIcon, MailOpenIcon } from 'lucide-react';
export function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle contact form submission here
    console.log('Contact form submitted:', formData);
  };
  return <PublicLayout>
      <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-[#1B4965] mb-4">Contacto</h1>
            <p className="text-lg text-gray-600">
              ¿Tienes alguna pregunta? Estamos aquí para ayudarte
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-[#1B4965] mb-6">
                Envíanos un mensaje
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[#101828] mb-2">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <input type="text" required value={formData.name} onChange={e => setFormData({
                    ...formData,
                    name: e.target.value
                  })} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
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
                    })} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
                      <MailIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#101828] mb-2">
                      Teléfono
                    </label>
                    <div className="relative">
                      <input type="tel" value={formData.phone} onChange={e => setFormData({
                      ...formData,
                      phone: e.target.value
                    })} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
                      <PhoneIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101828] mb-2">
                    Asunto
                  </label>
                  <div className="relative">
                    <input type="text" required value={formData.subject} onChange={e => setFormData({
                    ...formData,
                    subject: e.target.value
                  })} className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]" />
                    <MessageSquareIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#101828] mb-2">
                    Mensaje
                  </label>
                  <textarea required value={formData.message} onChange={e => setFormData({
                  ...formData,
                  message: e.target.value
                })} rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB]"></textarea>
                </div>
                <button type="submit" className="w-full bg-[#62B6CB] text-[#FDFFFC] py-2 rounded-md hover:opacity-90 transition-colors">
                  Enviar Mensaje
                </button>
              </form>
            </div>
            {/* Contact Information */}
            <div className="space-y-8">
              <div className="bg-[#FDFFFC] p-8 rounded-lg shadow-sm border border-gray-100">
                <h2 className="text-xl font-semibold text-[#1B4965] mb-6">
                  Información de Contacto
                </h2>
                <div className="space-y-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <MapPinIcon className="text-[#62B6CB] mt-1" size={24} />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-[#101828]">
                        Dirección
                      </h3>
                      <p className="mt-1 text-gray-600">
                        Calle Principal 123
                        <br />
                        28001 Madrid, España
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <ClockIcon className="text-[#62B6CB] mt-1" size={24} />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-[#101828]">
                        Horario de Atención
                      </h3>
                      <p className="mt-1 text-gray-600">
                        Lunes a Viernes: 9:00 - 18:00
                        <br />
                        Sábados: 10:00 - 14:00
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <PhoneCallIcon className="text-[#62B6CB] mt-1" size={24} />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-[#101828]">
                        Teléfono
                      </h3>
                      <p className="mt-1 text-gray-600">+34 900 123 456</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <MailOpenIcon className="text-[#62B6CB] mt-1" size={24} />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-[#101828]">
                        Correo Electrónico
                      </h3>
                      <p className="mt-1 text-gray-600">info@inmogestion.com</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[#1B4965] p-8 rounded-lg text-[#FDFFFC]">
                <h3 className="text-xl font-semibold mb-4">
                  ¿Necesitas una demo?
                </h3>
                <p className="mb-6 text-gray-300">
                  Agenda una llamada con nuestro equipo para ver cómo podemos
                  ayudarte a hacer crecer tu negocio inmobiliario.
                </p>
                <a href="/demo" className="inline-block bg-[#62B6CB] text-[#FDFFFC] px-6 py-2 rounded-md hover:opacity-90 transition-colors">
                  Solicitar Demo
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>;
}