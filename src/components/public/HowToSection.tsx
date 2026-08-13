import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from 'flowbite-react';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Play,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { PublicSection } from './PublicSection';

type StepPreview = {
  label: string;
  youtubeId?: string;
};

type Step = {
  id: string;
  label: string;
  title: string;
  description: string;
  previews: StepPreview[];
  videoTitle: string;
  videoMeta: string;
  icon: LucideIcon;
};

const STEPS: Step[] = [
  {
    id: 'crear-propiedad',
    label: 'PASO - 01',
    title: 'Crear propiedad',
    description:
      'Carga los datos básicos de tu inmueble o venue, añade fotos y publica el anuncio en minutos.',
    previews: [
      { label: 'Formulario de propiedad', youtubeId: 'GkI7L_jGUOU' },
      { label: 'Tipos de propiedades', youtubeId: '5qo5rg9Weno' },
    ],
    videoTitle: 'Cómo crear tu primera propiedad',
    videoMeta: '3 min 20 seg',
    icon: Building2,
  },
  {
    id: 'proceso-reserva',
    label: 'PASO - 02',
    title: 'Proceso de reserva',
    description:
      'Recibe solicitudes, confirma disponibilidad y gestiona el ciclo de la reserva desde un solo panel.',
    previews: [{ label: 'Flujo de confirmación' }],
    videoTitle: 'Cómo gestionar una reserva',
    videoMeta: '00:52',
    icon: CalendarCheck,
  },
  {
    id: 'sincronizacion',
    label: 'PASO - 03',
    title: 'Administración de calendario',
    description:
      'Mantén calendarios y disponibilidad alineados entre tu portal y canales externos sin trabajo duplicado.',
    previews: [
      { label: 'Administrar mi calendario' },
      { label: 'Canales conectados' },
    ],
    videoTitle: 'Cómo sincronizar con otros sitios',
    videoMeta: '00:58',
    icon: RefreshCw,
  },
];

export function HowToSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [activePreview, setActivePreview] = useState(0);
  const current = STEPS[activeStep];
  const ActiveIcon = current.icon;
  const selectedPreview = current.previews[activePreview] ?? current.previews[0];
  const youtubeId = selectedPreview?.youtubeId;

  const selectStep = (index: number) => {
    setActiveStep(index);
    setActivePreview(0);
  };

  const selectPreview = (stepIndex: number, previewIndex: number) => {
    setActiveStep(stepIndex);
    setActivePreview(previewIndex);
  };

  return (
    <PublicSection background="gray">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Left column: fixed chrome + dynamic video */}
        <div className="space-y-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-green-600 dark:border-green-400 px-3 py-1 text-xs font-semibold tracking-wide text-green-700 dark:text-green-400 uppercase mb-4">
              Cómo funciona
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Nuestros procesos simples
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 max-w-lg">
              Sigue estos tres pasos para publicar, reservar y sincronizar tu oferta sin complicaciones.
            </p>
            <Button as={Link} to="/contact" color="green">
              Empezar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-800 to-gray-950 aspect-video shadow-md">
            {youtubeId ? (
              <iframe
                key={youtubeId}
                className="absolute inset-0 h-full w-full"
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title={selectedPreview.label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-900/40 via-transparent to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15 backdrop-blur border border-white/20">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-lg leading-snug">{current.videoTitle}</p>
                      <p className="text-gray-300 text-sm mt-0.5">{current.videoMeta}</p>
                    </div>
                  </div>
                </div>
                <div className="absolute top-6 right-6 rounded-xl bg-white/10 backdrop-blur p-3 border border-white/10">
                  <ActiveIcon className="w-8 h-8 text-green-400" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right column: timeline + step cards */}
        <div className="relative">
          {/* Desktop timeline */}
          <div
            className="hidden lg:block absolute left-0 top-6 bottom-6 w-px bg-green-500/40"
            aria-hidden
          />

          <div className="space-y-4 lg:pl-10">
            {STEPS.map((step, index) => {
              const isActive = index === activeStep;
              const StepIcon = step.icon;

              return (
                <div key={step.id} className="relative">
                  <div
                    className={`hidden lg:flex absolute -left-10 top-6 h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 transition-colors ${
                      isActive
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-white dark:bg-gray-800 border-green-500/50 text-green-600 dark:text-green-400'
                    }`}
                    aria-hidden
                  >
                    <StepIcon className="w-4 h-4" />
                  </div>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => selectStep(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectStep(index);
                      }
                    }}
                    aria-pressed={isActive}
                    className={`w-full text-left rounded-2xl border p-5 md:p-6 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-gray-800 border-green-500 shadow-md opacity-100'
                        : 'bg-white/70 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <p className="text-xs font-semibold tracking-wide text-green-600 dark:text-green-400 mb-2">
                      {step.label}
                    </p>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{step.description}</p>
                    <div className="space-y-2">
                      {step.previews.map((preview, previewIndex) => {
                        const isPreviewActive = isActive && activePreview === previewIndex;

                        return (
                          <button
                            key={preview.label}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              selectPreview(index, previewIndex);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                              isPreviewActive
                                ? 'border-green-100 dark:border-green-900/40 bg-green-50 dark:bg-green-900/20'
                                : isActive
                                  ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 hover:border-green-200 dark:hover:border-green-800'
                                  : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40'
                            }`}
                          >
                            <StepIcon
                              className={`w-5 h-5 shrink-0 ${
                                isPreviewActive || isActive
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-gray-400'
                              }`}
                            />
                            <span
                              className={`text-sm font-medium ${
                                isPreviewActive || isActive
                                  ? 'text-gray-900 dark:text-white'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {preview.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PublicSection>
  );
}
