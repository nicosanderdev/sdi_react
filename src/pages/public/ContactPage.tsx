import React, { useState } from 'react';
import { UserIcon, MailIcon, PhoneIcon, MessageSquareIcon, MapPinIcon, ClockIcon, PhoneCallIcon, MailOpenIcon, Send } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { PublicSection } from '../../components/public/PublicSection';
import { Button, TextInput, Textarea, Alert } from 'flowbite-react';
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
  return (
    <PublicLayout>
      <PublicSection background="white">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Contacto</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            ¿Tienes alguna pregunta? Estamos aquí para ayudarte
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6">
              <Send className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
              Envíanos un mensaje
            </h2>

            {showSuccess && (
              <Alert color="success" className="mb-6">
                ¡Mensaje enviado con éxito! Te responderemos pronto.
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <TextInput
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Tu nombre completo"
                  icon={UserIcon}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <TextInput
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="tu@email.com"
                    icon={MailIcon}
                  />
                </div>
                <div>
                  <TextInput
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="+34 600 000 000"
                    icon={PhoneIcon}
                  />
                </div>
              </div>

              <div>
                <TextInput
                  type="text"
                  required
                  value={formData.subject}
                  onChange={e => setFormData({...formData, subject: e.target.value})}
                  placeholder="Asunto de tu mensaje"
                  icon={MessageSquareIcon}
                />
              </div>

              <div>
                <Textarea
                  required
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                color="success"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar Mensaje
              </Button>
            </form>
          </div>
          {/* Contact Information */}
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6">
                <PhoneCallIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                Información de Contacto
              </h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <MapPinIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Dirección
                    </h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      Calle Principal 123<br />
                      28001 Madrid, España
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <ClockIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Horario de Atención
                    </h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      Lunes a Viernes: 9:00 - 18:00<br />
                      Sábados: 10:00 - 14:00
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <PhoneCallIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Teléfono
                    </h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">+34 900 123 456</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <MailOpenIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Correo Electrónico
                    </h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">info@inmogestion.com</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 text-white p-8 rounded-xl">
              <h3 className="text-2xl font-semibold mb-4">
                ¿Necesitas una demo?
              </h3>
              <p className="mb-6 text-gray-300">
                Agenda una llamada con nuestro equipo para ver cómo podemos
                ayudarte a hacer crecer tu negocio inmobiliario.
              </p>
              <Button
                href="/demo"
                color="success"
                className="bg-green-600 hover:bg-green-700"
              >
                Solicitar Demo
              </Button>
            </div>
          </div>
        </div>
      </PublicSection>
    </PublicLayout>
  );
}