import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { Card, Button, Spinner, Alert, Select } from 'flowbite-react';
import {
  Crown,
  Building2,
  User,
  Check,
  AlertCircle,
  CreditCard
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { PlanData } from '../../../models/subscriptions/PlanData';
import { PlanKey } from '../../../models/subscriptions/PlanKey';
import { usePayment } from '../../../contexts/PaymentContext';
import { CreatePaymentRequest } from '../../../models/payments/PaymentData';

type SubscriptionType = 'personal' | 'company';

export function PlansSelectionPage() {
  const user = useSelector((state: RootState) => state.user.profile);
  const navigate = useNavigate();
  const { createPayment } = usePayment();
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [subscriptionType, setSubscriptionType] = useState<SubscriptionType>('personal');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock company data - in real app, this would come from user state
  const userCompanies = useSelector((state: RootState) => state.user.companies) || [];

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setIsLoading(true);
        const plansData = await subscriptionService.getPlans();
        setPlans(plansData.filter(plan => plan.isActive));
      } catch (err: any) {
        setError(err.message || 'Error al cargar los planes');
      } finally {
        setIsLoading(false);
      }
    };
    fetchPlans();
  }, []);

  // Separate plans into personal and company based on PlanKey
  // Personal plans: manager and manager_pro, Company plans: company_small and company_unlimited
  const personalPlans = plans.filter(plan => plan.key === PlanKey.MANAGER || plan.key === PlanKey.MANAGER_PRO);
  const companyPlans = plans.filter(plan => plan.key === PlanKey.COMPANY_SMALL || plan.key === PlanKey.COMPANY_UNLIMITED);

  const currentPlans = subscriptionType === 'personal' ? personalPlans : companyPlans;

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleProceedToPayment = async () => {
    if (!selectedPlanId) {
      setError('Por favor selecciona un plan');
      return;
    }

    if (subscriptionType === 'company' && !selectedCompanyId) {
      setError('Por favor selecciona una compañía');
      return;
    }

    if (!user) {
      setError('Usuario no encontrado. Por favor inicia sesión nuevamente.');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Find the selected plan details
      const selectedPlan = plans.find(plan => plan.id === selectedPlanId);
      if (!selectedPlan) {
        throw new Error('Plan seleccionado no encontrado');
      }

      const entityType = subscriptionType;
      const entityId = subscriptionType === 'personal'
        ? user.id
        : selectedCompanyId || '';

      // Create order ID for subscription payment
      const orderId = `sub_${entityType}_${entityId}_${selectedPlanId}_${Date.now()}`;

      // Create payment request for DLocal
      const paymentRequest: CreatePaymentRequest = {
        amount: selectedPlan.monthlyPrice,
        currency: selectedPlan.currency,
        paymentMethod: 'card', // Default to card payment, can be expanded later
        orderId,
        description: `Subscription to ${selectedPlan.name} plan`,
        customerInfo: {
          name: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email?.split('@')[0] || 'User',
          email: user.email || '',
          phone: user.phone || ''
        },
        callbackUrl: `${window.location.origin}/dashboard/payments/callback`
      };

      // Create payment using DLocal
      const paymentResponse = await createPayment(paymentRequest);

      if (paymentResponse.redirectUrl) {
        // Redirect to DLocal payment page
        window.location.href = paymentResponse.redirectUrl;
      } else {
        throw new Error('No redirect URL received from payment service');
      }

    } catch (err: any) {
      console.error('Payment creation error:', err);
      setError(err.message || 'Error al iniciar el proceso de pago. Por favor, inténtalo de nuevo.');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Seleccionar Plan</h1>
        <p className="text-gray-600">Elige el tipo de suscripción y plan que mejor se adapte a tus necesidades.</p>
      </div>

      {error && (
        <Alert color="failure" icon={AlertCircle} className="mb-6">
          {error}
        </Alert>
      )}

      {/* Subscription Type Selection */}
      <Card className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Tipo de Suscripción</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              subscriptionType === 'personal'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => {
              setSubscriptionType('personal');
              setSelectedPlanId(null);
              setSelectedCompanyId(null);
            }}
          >
            <div className="flex items-center space-x-3">
              <User className="w-8 h-8 text-blue-600" />
              <div>
                <h3 className="font-semibold">Suscripción Personal</h3>
                <p className="text-sm text-gray-600">Para uso individual</p>
              </div>
              {subscriptionType === 'personal' && (
                <Check className="w-5 h-5 text-blue-600 ml-auto" />
              )}
            </div>
          </div>

          <div
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              subscriptionType === 'company'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => {
              setSubscriptionType('company');
              setSelectedPlanId(null);
              setSelectedCompanyId(null);
            }}
          >
            <div className="flex items-center space-x-3">
              <Building2 className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="font-semibold">Suscripción de Empresa</h3>
                <p className="text-sm text-gray-600">Para equipos y compañías</p>
              </div>
              {subscriptionType === 'company' && (
                <Check className="w-5 h-5 text-green-600 ml-auto" />
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Company Selection (only for company subscriptions) */}
      {subscriptionType === 'company' && (
        <Card className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Seleccionar Empresa</h2>
          {userCompanies.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No tienes compañías. Crea una primero.</p>
              <Button onClick={() => navigate('/dashboard/company')}>
                Gestionar Compañías
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Select
                value={selectedCompanyId || ''}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
              >
                <option value="" disabled>Selecciona una compañía</option>
                {userCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Card>
      )}

      {/* Plans Display */}
      <Card className="mb-6">
        <h2 className="text-xl font-semibold mb-4">
          Planes Disponibles - {subscriptionType === 'personal' ? 'Personal' : 'Empresa'}
        </h2>

        {currentPlans.length === 0 ? (
          <div className="text-center py-8">
            <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay planes disponibles para este tipo de suscripción.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentPlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer transition-all border-2 ${
                  selectedPlanId === plan.id
                    ? 'ring-2 ring-blue-600 border-blue-600 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700 hover:shadow-md'
                }`}
                onClick={() => handleSelectPlan(plan.id)}
              >
                <div className="text-center mb-4">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">€{plan.monthlyPrice}</span>
                    <span className="text-gray-600">/{plan.billingCycle}</span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  <li className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Hasta {plan.maxProperties} propiedades</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Hasta {plan.maxUsers} usuarios</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm">{plan.maxStorageMb} MB de almacenamiento</span>
                  </li>
                </ul>

                <button
                  className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                    selectedPlanId === plan.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {selectedPlanId === plan.id ? 'Seleccionado' : 'Seleccionar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Proceed Button */}
      {selectedPlanId && (subscriptionType === 'personal' || selectedCompanyId) && (
        <div className="flex justify-center">
          <Button
            onClick={handleProceedToPayment}
            disabled={isProcessing}
            className="bg-[#1B4965] text-white px-8 py-3 rounded-lg hover:bg-[#153a52] transition-colors flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                <span>Proceder al Pago</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
