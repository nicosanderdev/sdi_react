import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PublicSection } from './PublicSection';

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: '¿Cuánto tarda crear una propiedad?',
    answer:
      'Con los datos básicos y algunas fotos, puedes publicar un anuncio en pocos minutos. Luego puedes completar detalles como tarifas, políticas y disponibilidad.',
  },
  {
    question: '¿Cómo funciona el proceso de reserva?',
    answer:
      'Recibes la solicitud, revisas disponibilidad y confirmas o rechazas desde el panel. El historial y el estado de cada reserva quedan centralizados.',
  },
  {
    question: '¿Puedo sincronizar con otros sitios de alquiler?',
    answer:
      'Sí. Puedes conectar calendarios y canales externos para mantener la disponibilidad alineada y reducir el riesgo de sobreventas.',
  },
  {
    question: '¿Necesito experiencia técnica para empezar?',
    answer:
      'No. El flujo está pensado para gestores y equipos operativos: pasos claros, formularios guiados y sin configuraciones complejas al inicio.',
  },
  {
    question: '¿Puedo gestionar varias propiedades a la vez?',
    answer:
      'Sí. La plataforma permite administrar un catálogo de inmuebles y venues desde un mismo entorno, con la misma lógica de publicación y reservas.',
  },
  {
    question: '¿Dónde pido ayuda si me quedo atascado?',
    answer:
      'Puedes contactarnos desde la página de contacto o solicitar una demostración. Estaremos encantados de orientarte en el onboarding.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <PublicSection background="white">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-4">
          Preguntas frecuentes
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-10">
          Respuestas rápidas sobre publicación, reservas y sincronización.
        </p>

        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div key={item.question}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 md:px-6 md:py-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <span className="font-semibold text-gray-900 dark:text-white">{item.question}</span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 text-green-600 dark:text-green-400 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 md:px-6 md:pb-6">
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PublicSection>
  );
}
