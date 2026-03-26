import React from 'react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { PublicSection } from '../../components/public/PublicSection';

export function AboutPage() {
  return (
    <PublicLayout>
      <PublicSection background="white">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white text-center mb-6">
            Sobre nosotros
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 text-center mb-14">
            Software para equipos que publican y operan alquileres temporales y espacios para eventos.
          </p>

          <div className="space-y-10 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 p-8 rounded-xl">
            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Qué hace la plataforma
              </h2>
              <p className="leading-relaxed">
                SGI concentra la gestión de tus portales y propiedades: puedes mantener catálogos de viviendas para
                estancias cortas y de venues para celebraciones o encuentros profesionales, con herramientas para
                actualizar oferta, coordinar reservas y dar respuesta a consultas desde un entorno único.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Por qué importa una gestión centralizada
              </h2>
              <p className="leading-relaxed">
                Evitar sistemas dispersos reduce errores en disponibilidad y tarifas, acelera la publicación de nuevos
                anuncios y asegura que tu equipo vea la misma información sobre cada inmueble o espacio. Un solo lugar
                para el catálogo y la operación diaria facilita el control y la colaboración entre quienes administran
                los portales.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Eficiencia, escalabilidad y facilidad de uso
              </h2>
              <p className="leading-relaxed">
                La plataforma está pensada para crecer contigo: incorporar propiedades o ampliar equipos no debe
                multiplicar la complejidad. Priorizamos flujos claros y tiempos de respuesta rápidos para que dediques
                menos tiempo a tareas repetitivas y más a atender a huéspedes y organizadores de eventos.
              </p>
            </section>
          </div>
        </div>
      </PublicSection>
    </PublicLayout>
  );
}
