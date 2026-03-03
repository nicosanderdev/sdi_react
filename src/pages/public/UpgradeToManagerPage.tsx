import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { PublicSection } from '../../components/public/PublicSection';
import { PageHero } from '../../components/public/PageHero';
import { PricingCard } from '../../components/public/PricingCard';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { isManager } from '../../utils/RoleUtils';
import {
  Crown,
  Check,
  Shield,
  Building2,
  BarChart3,
  Users,
  MessageSquare,
  Eye,
  CreditCard
} from 'lucide-react';
import { Button } from 'flowbite-react';

export function UpgradeToManagerPage() {
  const user = useSelector((state: RootState) => state.user.profile);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium' | 'enterprise'>('basic');
  const [isProcessing, setIsProcessing] = useState(false);

  const plans = [
    {
      id: 'basic',
      name: 'Manager Básico',
      price: '29',
      period: 'mes',
      description: 'Perfecto para empezar a gestionar propiedades',
      features: [
        'Hasta 5 propiedades',
        'Panel de gestión básico',
        'Soporte por email',
        'Reportes básicos',
        'Mensajes ilimitados'
      ],
      popular: false,
      color: 'bg-blue-500'
    },
    {
      id: 'premium',
      name: 'Manager Premium',
      price: '59',
      period: 'mes',
      description: 'Para profesionales que necesitan más herramientas',
      features: [
        'Hasta 25 propiedades',
        'Panel de gestión avanzado',
        'Soporte prioritario',
        'Reportes avanzados y métricas',
        'Integración con CRM',
        'Análisis de mercado',
        'Plantillas personalizadas'
      ],
      popular: true,
      color: 'bg-purple-500'
    },
    {
      id: 'enterprise',
      name: 'Manager Enterprise',
      price: '99',
      period: 'mes',
      description: 'Para equipos grandes y empresas',
      features: [
        'Propiedades ilimitadas',
        'Panel de gestión completo',
        'Soporte 24/7',
        'Reportes personalizados',
        'API completa',
        'Múltiples usuarios',
        'Integraciones avanzadas',
        'Consultoría incluida'
      ],
      popular: false,
      color: 'bg-yellow-500'
    }
  ];

  const benefits = [
    {
      icon: <Building2 className="w-8 h-8" />,
      title: 'Gestión Completa de Propiedades',
      description: 'Administra todas tus propiedades desde un solo lugar con herramientas profesionales.'
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Reportes y Analytics',
      description: 'Obtén insights detallados sobre el rendimiento de tus propiedades y decisiones basadas en datos.'
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: 'Centro de Mensajes Avanzado',
      description: 'Gestiona todas las consultas de manera profesional con herramientas de comunicación avanzadas.'
    },
    {
      icon: <Eye className="w-8 h-8" />,
      title: 'Visibilidad Completa',
      description: 'Controla qué información se muestra públicamente y personaliza la experiencia de tus clientes.'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Gestión de Clientes',
      description: 'Mantén un registro completo de tus clientes y sus interacciones con tus propiedades.'
    },
    {
      icon: <Settings className="w-8 h-8" />,
      title: 'Herramientas Profesionales',
      description: 'Accede a funciones avanzadas diseñadas específicamente para profesionales inmobiliarios.'
    }
  ];

  const handleUpgrade = async () => {
    setIsProcessing(true);
    // Simulate API call
    setTimeout(() => {
      setIsProcessing(false);
      alert('Redirigiendo al procesador de pagos...');
    }, 2000);
  };

  return (
    <PublicLayout>
      <PageHero
        title="¡Hola! ¿Listo para el siguiente nivel?"
        subtitle="Como Manager, tendrás acceso a herramientas profesionales que te permitirán gestionar propiedades, analizar datos y comunicarte eficientemente con tus clientes."
        primaryCta={{
          text: "Ver Planes",
          href: "#pricing"
        }}
      />

      <PublicSection background="gray">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            ¿Qué obtienes como Manager?
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {benefits.map((benefit, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
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

        {/* Pricing Plans */}
        <div id="pricing">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Elige tu plan
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                name={plan.name}
                price={plan.price}
                period={plan.period}
                description={plan.description}
                features={plan.features}
                popular={plan.popular}
                selected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id as any)}
              />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mb-16">
          <Button
            onClick={handleUpgrade}
            disabled={isProcessing}
            color="success"
            size="xl"
            className="bg-green-600 hover:bg-green-700 px-12 py-4 text-lg"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                Procesando...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Actualizar a Manager - €{plans.find(p => p.id === selectedPlan)?.price}/mes
              </>
            )}
          </Button>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
            Puedes cancelar tu suscripción en cualquier momento
          </p>
        </div>

        {/* FAQ Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 md:p-12">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-12">
            Preguntas Frecuentes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                ¿Puedo cambiar de plan más tarde?
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Sí, puedes actualizar o degradar tu plan en cualquier momento desde tu panel de configuración.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                ¿Hay período de prueba?
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Ofrecemos 14 días de prueba gratuita para que puedas explorar todas las funciones antes de comprometerte.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                ¿Qué métodos de pago aceptan?
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Aceptamos tarjetas de crédito, débito y PayPal. También ofrecemos facturación mensual y anual.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                ¿Puedo cancelar en cualquier momento?
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                Sí, puedes cancelar tu suscripción en cualquier momento sin penalizaciones ni cargos adicionales.
              </p>
            </div>
          </div>
        </div>

        {/* Security Badge */}
        <div className="text-center mt-12">
          <div className="inline-flex items-center space-x-2 text-gray-600 dark:text-gray-400">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span>Pago seguro y encriptado</span>
          </div>
        </div>
      </PublicSection>
    </PublicLayout>
  );
}
