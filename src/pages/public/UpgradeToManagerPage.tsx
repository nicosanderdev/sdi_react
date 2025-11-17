import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { 
  ArrowLeft, 
  Crown, 
  Check, 
  Star, 
  Shield, 
  BarChart3, 
  Users, 
  Settings,
  CreditCard,
  Calendar,
  Zap,
  Award,
  Building2,
  MessageSquare,
  Eye,
  Lock
} from 'lucide-react';

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
      <div className="min-h-screen bg-gradient-to-b from-[#BEE9E8] to-[#FDFFFC]">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center space-x-4">
              <Link
                to="/welcome"
                className="flex items-center space-x-2 text-[#1B4965] hover:text-[#153a52] transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Volver</span>
              </Link>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[#1B4965]">Conviértete en Manager</h1>
                <p className="text-gray-600 mt-1">Accede a herramientas profesionales para gestionar propiedades</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mb-6">
              <Crown className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-bold text-[#1B4965] mb-4">
              ¡Hola, {user?.firstName}! ¿Listo para el siguiente nivel?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Como Manager, tendrás acceso a herramientas profesionales que te permitirán gestionar propiedades, 
              analizar datos y comunicarte eficientemente con tus clientes.
            </p>
          </div>

          {/* Benefits Section */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-[#1B4965] text-center mb-8">
              ¿Qué obtienes como Manager?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm p-6 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1B4965] text-white rounded-full mb-4">
                    {benefit.icon}
                  </div>
                  <h4 className="text-lg font-semibold text-[#1B4965] mb-3">
                    {benefit.title}
                  </h4>
                  <p className="text-gray-600">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Plans */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold text-[#1B4965] text-center mb-8">
              Elige tu plan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-lg shadow-sm p-8 cursor-pointer transition-all ${
                    selectedPlan === plan.id ? 'ring-2 ring-[#1B4965] shadow-lg' : 'hover:shadow-md'
                  } ${plan.popular ? 'border-2 border-purple-500' : ''}`}
                  onClick={() => setSelectedPlan(plan.id as any)}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                        <Star className="w-4 h-4" />
                        <span>Más Popular</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center justify-center w-16 h-16 ${plan.color} text-white rounded-full mb-4`}>
                      <Crown className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-bold text-[#1B4965] mb-2">
                      {plan.name}
                    </h4>
                    <p className="text-gray-600 mb-4">
                      {plan.description}
                    </p>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-[#1B4965]">€{plan.price}</span>
                      <span className="text-gray-600">/{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                      selectedPlan === plan.id
                        ? 'bg-[#1B4965] text-white hover:bg-[#153a52]'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setSelectedPlan(plan.id as any)}
                  >
                    {selectedPlan === plan.id ? 'Seleccionado' : 'Seleccionar Plan'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade Button */}
          <div className="text-center mb-16">
            <button
              onClick={handleUpgrade}
              disabled={isProcessing}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-yellow-500 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Actualizar a Manager - €{plans.find(p => p.id === selectedPlan)?.price}/mes</span>
                </>
              )}
            </button>
            <p className="text-sm text-gray-500 mt-4">
              Puedes cancelar tu suscripción en cualquier momento
            </p>
          </div>

          {/* FAQ Section */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h3 className="text-2xl font-bold text-[#1B4965] text-center mb-8">
              Preguntas Frecuentes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold text-[#1B4965] mb-2">
                  ¿Puedo cambiar de plan más tarde?
                </h4>
                <p className="text-gray-600">
                  Sí, puedes actualizar o degradar tu plan en cualquier momento desde tu panel de configuración.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[#1B4965] mb-2">
                  ¿Hay período de prueba?
                </h4>
                <p className="text-gray-600">
                  Ofrecemos 14 días de prueba gratuita para que puedas explorar todas las funciones antes de comprometerte.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[#1B4965] mb-2">
                  ¿Qué métodos de pago aceptan?
                </h4>
                <p className="text-gray-600">
                  Aceptamos tarjetas de crédito, débito y PayPal. También ofrecemos facturación mensual y anual.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-[#1B4965] mb-2">
                  ¿Puedo cancelar en cualquier momento?
                </h4>
                <p className="text-gray-600">
                  Sí, puedes cancelar tu suscripción en cualquier momento sin penalizaciones ni cargos adicionales.
                </p>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="text-center mt-12">
            <div className="inline-flex items-center space-x-2 text-gray-600">
              <Shield className="w-5 h-5" />
              <span>Pago seguro y encriptado</span>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
