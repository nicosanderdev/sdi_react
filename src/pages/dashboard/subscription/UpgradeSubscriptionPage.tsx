import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { Card, Button, Spinner } from 'flowbite-react';
import { 
    Crown, 
    Check, 
    Star, 
    CreditCard,
    ArrowLeft,
    AlertCircle
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { PlanData } from '../../../models/subscriptions/PlanData';
import { SubscriptionData } from '../../../models/subscriptions/SubscriptionData';
import { PlanKey } from '../../../models/subscriptions/PlanKey';

export function UpgradeSubscriptionPage() {
    const user = useSelector((state: RootState) => state.user.profile);
    const navigate = useNavigate();
    const [plans, setPlans] = useState<PlanData[]>([]);
    const [currentSubscription, setCurrentSubscription] = useState<SubscriptionData | null>(null);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [plansData, subscriptionData] = await Promise.all([
                    subscriptionService.getPlans(),
                    subscriptionService.getCurrentSubscription().catch(() => null)
                ]);
                setPlans(plansData.filter(plan => plan.isActive));
                setCurrentSubscription(subscriptionData);
            } catch (err: any) {
                setError(err.message || 'Error al cargar los planes');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleUpgrade = async () => {
        if (!selectedPlanId) {
            setError('Por favor selecciona un plan');
            return;
        }

        try {
            setIsProcessing(true);
            setError(null);
            const checkoutUrl = await subscriptionService.getCheckout(selectedPlanId);
            // Redirect to billing portal
            window.location.href = checkoutUrl;
        } catch (err: any) {
            setError(err.message || 'Error al procesar la actualización');
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
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/dashboard/subscription')}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver a Suscripción</span>
                </button>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Actualizar Suscripción</h1>
                        <p>Elige el plan que mejor se adapte a tus necesidades</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800">{error}</span>
                </div>
            )}

            {/* Current Plan Info */}
            {currentSubscription && (
                <Card className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">Plan Actual</h3>
                    <p className="text-gray-600">
                        Estás suscrito al plan <strong>{currentSubscription.plan.name}</strong> 
                        (€{currentSubscription.plan.monthlyPrice}/{currentSubscription.plan.billingCycle})
                    </p>
                </Card>
            )}

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {plans.map((plan) => {
                    const isCurrentPlan = currentSubscription?.planId === plan.id;
                    const isSelected = selectedPlanId === plan.id;
                    const isPopular = plan.key === PlanKey.MANAGER || plan.key === PlanKey.COMPANY_SMALL;

                    return (
                        <Card
                            key={plan.id}
                            className={`relative cursor-pointer transition-all ${
                                isSelected ? 'ring-2 ring-[#1B4965] shadow-lg' : 'hover:shadow-md'
                            } ${isCurrentPlan ? 'opacity-60' : ''}`}
                            onClick={() => !isCurrentPlan && setSelectedPlanId(plan.id)}
                        >
                            {isPopular && (
                                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                    <div className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                                        <Star className="w-4 h-4" />
                                        <span>Más Popular</span>
                                    </div>
                                </div>
                            )}

                            {isCurrentPlan && (
                                <div className="absolute top-4 right-4">
                                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                        Actual
                                    </span>
                                </div>
                            )}

                            <div className="text-center mb-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1B4965] text-white rounded-full mb-4">
                                    <Crown className="w-8 h-8" />
                                </div>
                                <h4 className="text-xl font-bold text-[#1B4965] mb-2">
                                    {plan.name}
                                </h4>
                                <div className="mb-4">
                                    <span className="text-4xl font-bold text-[#1B4965]">
                                        €{plan.monthlyPrice}
                                    </span>
                                    <span className="text-gray-600">/{plan.billingCycle}</span>
                                </div>
                            </div>

                            <ul className="space-y-3 mb-6">
                                <li className="flex items-center space-x-3">
                                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <span className="text-gray-700">
                                        Hasta {plan.maxProperties} propiedades
                                    </span>
                                </li>
                                <li className="flex items-center space-x-3">
                                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <span className="text-gray-700">
                                        {plan.maxUsers} usuarios
                                    </span>
                                </li>
                                <li className="flex items-center space-x-3">
                                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <span className="text-gray-700">
                                        {plan.maxStorageMb} GB almacenamiento
                                    </span>
                                </li>
                            </ul>

                            <Button
                                onClick={() => !isCurrentPlan && setSelectedPlanId(plan.id)}
                                disabled={isCurrentPlan || isProcessing}
                                className={`w-full ${
                                    isSelected && !isCurrentPlan
                                        ? 'bg-[#1B4965] text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {isCurrentPlan ? 'Plan Actual' : isSelected ? 'Seleccionado' : 'Seleccionar Plan'}
                            </Button>
                        </Card>
                    );
                })}
            </div>

            {/* Upgrade Button */}
            {selectedPlanId && selectedPlanId !== currentSubscription?.planId && (
                <div className="text-center">
                    <Button
                        onClick={handleUpgrade}
                        disabled={isProcessing}
                        size="lg"
                        className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-yellow-500 hover:to-orange-600 transition-all disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <>
                                <Spinner size="sm" className="mr-2" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <CreditCard className="w-5 h-5 mr-2 inline" />
                                Continuar con el Pago
                            </>
                        )}
                    </Button>
                    <p className="text-sm text-gray-500 mt-4">
                        Serás redirigido al portal de pagos seguro
                    </p>
                </div>
            )}
        </div>
    );
}

