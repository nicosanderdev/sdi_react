import { PublicLayout } from '../../components/layout/PublicLayout';
import { PublicSection } from '../../components/public/PublicSection';
import { PageHero } from '../../components/public/PageHero';
import { Building2, BarChart3, CalendarCheck } from 'lucide-react';

const benefits = [
  {
    icon: <Building2 className="w-8 h-8" />,
    title: 'Gestión de propiedades',
    description: 'Administrá tus propiedades desde un solo lugar: fichas, condiciones y lo que se publica.'
  },
  {
    icon: <CalendarCheck className="w-8 h-8" />,
    title: 'Gestión de reservas',
    description: 'Seguí cada solicitud, confirmación y estado de reserva desde el panel.'
  },
  {
    icon: <BarChart3 className="w-8 h-8" />,
    title: 'Reportes',
    description: 'Consultá cómo rinden tus propiedades y decidí con información clara.'
  }
];

const faqs = [
  {
    question: '¿Hay que pagar para sumarse?',
    answer: 'No. Sumarte es gratis. Podés empezar sin un plan pago.'
  },
  {
    question: '¿Para quiénes son los planes pagos?',
    answer: 'Los planes pagos son solo para empresas. Si representás una compañía, escribinos y te contamos las opciones en privado.'
  },
  {
    question: '¿Dónde veo los precios?',
    answer: 'No publicamos planes ni tarifas en el sitio. La información se define según cada caso y te la enviamos después del contacto.'
  },
  {
    question: '¿Cómo consulto un plan?',
    answer: 'Completá el formulario de contacto. Revisamos tu mensaje y te respondemos con el siguiente paso.'
  }
];

export function UpgradeToManagerPage() {
  return (
    <PublicLayout>
      <PageHero
        title="Consultá nuestros planes"
        subtitle="Contanos cómo trabajás y te orientamos sobre el plan que te corresponde. Los detalles los vemos en privado, por el formulario de contacto."
        primaryCta={{
          text: "Escribir por contacto",
          href: "/contact"
        }}
      />

      <PublicSection background="gray">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            ¿Qué obtienes como Manager?
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-xl mb-6">
                {benefit.icon}
              </div>
              <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                {benefit.title}
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 md:p-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Preguntas Frecuentes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  {faq.question}
                </h4>
                <p className="text-gray-600 dark:text-gray-400">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </PublicSection>
    </PublicLayout>
  );
}
