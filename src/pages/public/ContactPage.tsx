import React, { useState } from 'react';
import { UserIcon, MailIcon, MapPinIcon, ClockIcon, PhoneCallIcon, MailOpenIcon, Send } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { PublicSection } from '../../components/public/PublicSection';
import { Button, TextInput, Textarea, Alert, Label } from 'flowbite-react';

export function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuccess(true);
    console.log('Contact form submitted:', formData);
  };

  return (
    <PublicLayout>
      <PublicSection background="white">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Contacto</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Escríbenos para dudas sobre la plataforma, portales de alquiler o espacios para eventos. Te responderemos lo
            antes posible.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6">
              <Send className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Envíanos un mensaje
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
              Completa los campos obligatorios. Cuanto más concreto sea tu mensaje, mejor podremos ayudarte.
            </p>

            {showSuccess && (
              <Alert color="success" className="mb-6">
                ¡Mensaje enviado con éxito! Te responderemos pronto.
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="contact-name" className="mb-2 block">Nombre</Label>
                <TextInput
                  id="contact-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Tu nombre completo"
                  icon={UserIcon}
                />
              </div>

              <div>
                <Label htmlFor="contact-email" className="mb-2 block">Correo electrónico</Label>
                <TextInput
                  id="contact-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="tu@email.com"
                  icon={MailIcon}
                />
              </div>

              <div>
                <Label htmlFor="contact-message" className="mb-2 block">Mensaje</Label>
                <Textarea
                  id="contact-message"
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Describe tu consulta o necesidad…"
                  rows={5}
                />
              </div>

              <Button
                type="submit"
                color="green"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar mensaje
              </Button>
            </form>
          </div>

          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-gray-100 dark:border-gray-700">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                Información de contacto
              </h2>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1">
                    <MailOpenIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Correo electrónico
                    </h3>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">info@inmogestion.com</p>
                  </div>
                </div>
            </div>

            <div className="bg-gray-600  text-white p-8 rounded-xl">
              <h3 className="text-2xl font-semibold mb-4">
                ¿Quieres ver la plataforma en acción?
              </h3>
              <p className="mb-6 text-gray-300">
                Agenda una demostración y descubre cómo centralizar la gestión de tus portales de alquiler temporal y de
                espacios para eventos.
              </p>
              <Button
                href="/"
                color="success"
                className="bg-green-600 hover:bg-green-700"
              >
                Solicitar demostración
              </Button>
            </div>
          </div>
        </div>
      </PublicSection>
    </PublicLayout>
  );
}
