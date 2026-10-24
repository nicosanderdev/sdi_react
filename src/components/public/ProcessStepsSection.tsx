import { Link } from 'react-router-dom';
import { Button } from 'flowbite-react';
import { PublicSection } from './PublicSection';

const STEPS = [
  {
    title: 'Creá tu cuenta',
    description: 'Registrate en el panel con el correo con el que vas a publicar.',
  },
  {
    title: 'Cargá el espacio',
    description: 'Subí fotos, precio, capacidad y las reglas de la casa o del salón.',
  },
  {
    title: 'Publicalo',
    description: 'Dejá la ficha visible para quien busca un alquiler o un lugar para un evento.',
  },
  {
    title: 'Recibí reservas',
    description: 'Seguí consultas y reservas sin salir del panel.',
  },
];

export function ProcessStepsSection() {
  return (
    <PublicSection id="como-funciona" background="ink" className="scroll-mt-24">
      <div className="max-w-2xl mb-12 md:mb-16">
        <p className="m-0 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-green-400">
          <span className="inline-block h-px w-8 bg-green-400" aria-hidden />
          Cómo se publica
        </p>
        <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-white">
          Cuatro pasos para salir a publicar
        </h2>
        <p className="mt-3 text-white/75 text-base md:text-lg leading-relaxed max-w-xl">
          El detalle de cada paso está en Cómo funciona.
        </p>
      </div>

      <ol className="relative list-none m-0 p-0 pl-12 space-y-8 lg:pl-0 lg:space-y-0 lg:grid lg:grid-cols-4 lg:gap-6">
        <div
          className="absolute left-[1.05rem] top-3 bottom-3 w-px bg-white/20 lg:left-[12.5%] lg:right-[12.5%] lg:top-[1.35rem] lg:bottom-auto lg:w-auto lg:h-px"
          aria-hidden
        />
        {STEPS.map((step, index) => (
          <li key={step.title} className="relative lg:flex lg:flex-col lg:items-start">
            <Link
              to="/how-it-works"
              className="absolute -left-12 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-green-400 bg-gray-900 text-green-300 text-base font-light lg:static lg:z-10 lg:h-11 lg:w-11 lg:text-xl dark:bg-gray-950"
            >
              {index + 1}
            </Link>
            <h3 className="m-0 text-lg font-semibold text-white lg:mt-6">
              <Link to="/how-it-works" className="hover:text-green-300">
                {step.title}
              </Link>
            </h3>
            <p className="m-0 mt-1.5 text-sm text-white/75 leading-relaxed lg:mt-2">{step.description}</p>
          </li>
        ))}
      </ol>

      <div className="mt-12">
        <Button as={Link} to="/how-it-works" color="green" className="rounded-full w-100 mx-auto">
          Ver cómo funciona
        </Button>
      </div>
    </PublicSection>
  );
}
