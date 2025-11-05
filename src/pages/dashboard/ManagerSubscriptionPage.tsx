import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { 
  Crown, 
  Calendar, 
  CreditCard, 
  Download, 
  Settings, 
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  BarChart3,
  Users,
  Building2,
  MessageSquare,
  Eye,
  Shield
} from 'lucide-react';

export function ManagerSubscriptionPage() {
  const user = useSelector((state: RootState) => state.user.profile);
  const [isUpdating, setIsUpdating] = useState(false);

  // TODO: Implement subscription data from the API
  const subscription = {
    plan: 'Manager Premium',
    status: 'active',
    nextBillingDate: '2024-02-15',
    amount: 59,
    currency: 'EUR',
    period: 'monthly',
    propertiesUsed: 12,
    propertiesLimit: 25,
    features: [
      'Panel de gestión avanzado',
      'Soporte prioritario',
      'Reportes avanzados y métricas',
      'Integración con CRM',
      'Análisis de mercado',
      'Plantillas personalizadas'
    ],
    usage: {
      messages: 245,
      messagesLimit: 1000,
      storage: 2.3,
      storageLimit: 10
    }
  };

  const billingHistory = [
    {
      id: '1',
      date: '2024-01-15',
      amount: 59,
      status: 'paid',
      description: 'Manager Premium - Enero 2024'
    },
    {
      id: '2',
      date: '2023-12-15',
      amount: 59,
      status: 'paid',
      description: 'Manager Premium - Diciembre 2023'
    },
    {
      id: '3',
      date: '2023-11-15',
      amount: 59,
      status: 'paid',
      description: 'Manager Premium - Noviembre 2023'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'expired': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'expired': return <AlertCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const handleUpdatePlan = () => {
    setIsUpdating(true);
    // Simulate API call
    setTimeout(() => {
      setIsUpdating(false);
      alert('Redirigiendo a la página de actualización...');
    }, 1000);
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    // TODO: Implement invoice download
    alert(`Descargando factura ${invoiceId}...`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#1B4965]">Estado de Suscripción</h1>
            <p className="text-gray-600">Gestiona tu plan de Manager Premium</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Plan Card */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[#1B4965]">Plan Actual</h2>
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
                {getStatusIcon(subscription.status)}
                <span className="capitalize">{subscription.status}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-2xl font-bold text-[#1B4965] mb-2">
                  {subscription.plan}
                </h3>
                <div className="flex items-baseline space-x-2 mb-4">
                  <span className="text-3xl font-bold text-[#1B4965]">
                    €{subscription.amount}
                  </span>
                  <span className="text-gray-600">/{subscription.period}</span>
                </div>
                <p className="text-gray-600 mb-4">
                  Próxima facturación: {new Date(subscription.nextBillingDate).toLocaleDateString('es-ES')}
                </p>
                <button
                  onClick={handleUpdatePlan}
                  disabled={isUpdating}
                  className="bg-[#1B4965] text-white px-4 py-2 rounded-lg hover:bg-[#153a52] transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>{isUpdating ? 'Procesando...' : 'Cambiar Plan'}</span>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Propiedades</span>
                    <span className="font-medium">{subscription.propertiesUsed}/{subscription.propertiesLimit}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-[#1B4965] h-2 rounded-full" 
                      style={{ width: `${(subscription.propertiesUsed / subscription.propertiesLimit) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Mensajes</span>
                    <span className="font-medium">{subscription.usage.messages}/{subscription.usage.messagesLimit}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(subscription.usage.messages / subscription.usage.messagesLimit) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Almacenamiento</span>
                    <span className="font-medium">{subscription.usage.storage}GB/{subscription.usage.storageLimit}GB</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(subscription.usage.storage / subscription.usage.storageLimit) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-[#1B4965] mb-4">Características Incluidas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscription.features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing History */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-[#1B4965] mb-4">Historial de Facturación</h3>
            <div className="space-y-3">
              {billingHistory.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-[#1B4965]">{invoice.description}</p>
                    <p className="text-sm text-gray-600">{new Date(invoice.date).toLocaleDateString('es-ES')}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-[#1B4965]">€{invoice.amount}</span>
                    <button
                      onClick={() => handleDownloadInvoice(invoice.id)}
                      className="flex items-center space-x-1 text-[#1B4965] hover:text-[#153a52] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm">Descargar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-[#1B4965] mb-4">Acciones Rápidas</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <CreditCard className="w-5 h-5 text-[#1B4965]" />
                <span className="text-gray-700">Actualizar Método de Pago</span>
              </button>
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Calendar className="w-5 h-5 text-[#1B4965]" />
                <span className="text-gray-700">Cambiar Fecha de Facturación</span>
              </button>
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-[#1B4965]" />
                <span className="text-gray-700">Configuración de Facturación</span>
              </button>
            </div>
          </div>

          {/* Usage Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-[#1B4965] mb-4">Resumen de Uso</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-700">Propiedades</span>
                </div>
                <span className="font-semibold text-[#1B4965]">
                  {subscription.propertiesUsed}/{subscription.propertiesLimit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-green-500" />
                  <span className="text-gray-700">Mensajes</span>
                </div>
                <span className="font-semibold text-[#1B4965]">
                  {subscription.usage.messages}/{subscription.usage.messagesLimit}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  <span className="text-gray-700">Reportes</span>
                </div>
                <span className="font-semibold text-[#1B4965]">Ilimitados</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-orange-500" />
                  <span className="text-gray-700">Usuarios</span>
                </div>
                <span className="font-semibold text-[#1B4965]">1</span>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-2">¿Necesitas Ayuda?</h3>
            <p className="text-blue-100 mb-4">
              Nuestro equipo de soporte está aquí para ayudarte con cualquier pregunta sobre tu suscripción.
            </p>
            <button className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
              Contactar Soporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
