import React from 'react';
import { Building2, Globe, Link, BarChart3 } from 'lucide-react';
export function ServicesSection() {
  
  const services = [{
    icon: <Building2 size={32} className="text-[#62B6CB]" />,
    title: 'Publica y gestiona propiedades',
    description: 'Carga propiedades con fotos, descripciones, ubicaciones y características. Todo centralizado y accesible desde cualquier dispositivo.'
  }, {
    icon: <Globe size={32} className="text-[#62B6CB]" />,
    title: 'Sitio web personalizado',
    description: 'Obtén un sitio web inmobiliario moderno, con tu propio dominio y diseño profesional. Sin necesidad de programadores.'
  }, {
    icon: <Link size={32} className="text-[#62B6CB]" />,
    title: 'Conexión automática con nuestro buscador',
    description: 'Tus propiedades aparecerán automáticamente en nuestro portal de búsqueda, donde miles de personas buscan casa cada día.'
  }, {
    icon: <BarChart3 size={32} className="text-[#62B6CB]" />,
    title: 'Estadísticas y seguimiento',
    description: 'Visualiza visitas, contactos y rendimiento de tus publicaciones. Mejora tu estrategia con datos reales.'
  }];
  
  return <section className="py-20 bg-[#FDFFFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-[#1B4965] mb-4">
            ¿Qué puedes hacer con nuestra plataforma?
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => <div key={index} className="bg-[#FDFFFC] p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
              <div className="mb-4">{service.icon}</div>
              <h3 className="text-xl font-semibold text-[#1B4965] mb-3">
                {service.title}
              </h3>
              <p className="text-[#101828]">{service.description}</p>
            </div>)}
        </div>
      </div>
    </section>;
}