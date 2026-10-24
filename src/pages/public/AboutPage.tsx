import { Link } from 'react-router-dom';
import { CalendarCheck, Eye, Heart, Shield, Sparkles } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { EditorialTitle } from '../../components/public/EditorialTitle';

const values = [
  {
    icon: Sparkles,
    title: 'Simplicidad',
    description: 'Publicar una casa o un salón tiene que ser una ficha clara, no un trámite.',
  },
  {
    icon: Eye,
    title: 'Transparencia',
    description: 'Precios, reglas y disponibilidad se ven como los cargaste, sin letras escondidas.',
  },
  {
    icon: CalendarCheck,
    title: 'Control del calendario',
    description: 'La disponibilidad de cada propiedad queda en un solo lugar.',
  },
  {
    icon: Heart,
    title: 'Contacto directo',
    description: 'Huéspedes y organizadores te escriben a vos, no a un intermediario anónimo.',
  },
  {
    icon: Shield,
    title: 'Seguridad',
    description: 'El acceso al panel es tuyo. Vos decidís qué se publica de tu propiedad.',
  },
];

export function AboutPage() {
  return (
    <PublicLayout>
      <section className="relative py-28 md:py-32 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden>
          <div className="absolute top-16 right-10 w-80 h-80 bg-green-400 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-72 h-72 bg-green-700 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto px-8 text-center">
          <EditorialTitle
            as="h1"
            lead="Sobre"
            emphasis="nosotros"
            className="text-5xl md:text-6xl"
          />
          <p className="mt-6 text-xl text-gray-600 dark:text-gray-300">
            El panel para quien tiene una casa o un espacio y quiere publicarlo.
          </p>
        </div>
      </section>

      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <EditorialTitle
                as="h2"
                lead="Para qué"
                emphasis="existe"
                className="text-4xl md:text-5xl mb-6"
              />
              <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
                <p>
                  <span className="font-semibold text-gray-900 dark:text-white">Misión:</span>{' '}
                  que publiques tu casa o tu espacio para eventos con una ficha clara, un calendario y un lugar donde seguir las reservas.
                </p>
                <p>
                  <span className="font-semibold text-gray-900 dark:text-white">Visión:</span>{' '}
                  que el dueño del lugar no tenga que armar el anuncio en varios sistemas para que alguien lo encuentre y lo reserve.
                </p>
              </div>
            </div>
            <div className="relative">
              <img
                src="/images/hero-portals.jpg"
                alt="Casa lista para publicarse en alquiler"
                className="rounded-3xl shadow-2xl w-full h-[28rem] object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <EditorialTitle
              as="h2"
              lead="Cómo"
              emphasis="trabajamos"
              className="text-4xl md:text-5xl"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value) => (
              <div
                key={value.title}
                className="bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-700"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <value.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{value.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{value.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-light mb-6">
            ¿Listo para <span className="font-bold text-green-400">publicar?</span>
          </h2>
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Mirá los planes o escribinos si querés entender cómo entra tu propiedad al panel.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center px-8 py-4 bg-green-600 text-white font-semibold rounded-full hover:bg-green-500 transition-colors"
            >
              Ver planes
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-gray-900 transition-colors"
            >
              Contacto
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
