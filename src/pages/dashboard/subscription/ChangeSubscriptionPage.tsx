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
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { PlanData } from '../../../models/subscriptions/PlanData';
import { SubscriptionData } from '../../../models/subscriptions/SubscriptionData';
import { PlanKey } from '../../../models/subscriptions/PlanKey';

export function ChangeSubscriptionPage() {
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
                    subscriptionService.getCurrentSubscription()
                ]);
                setPlans(plansData.filter(plan => plan.isActive));
                setCurrentSubscription(subscriptionData);
                setSelectedPlanId(subscriptionData.planId);
            } catch (err: any) {
                setError(err.message || 'Error al cargar los planes');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleChangePlan = async () => {
        if (!selectedPlanId || selectedPlanId === currentSubscription?.planId) {
            setError('Por favor selecciona un plan diferente');
            return;
        }

        try {
            setIsProcessing(true);
            setError(null);
            // For mock implementation, redirect to mock checkout
            const selectedPlan = plans.find(p => p.id === selectedPlanId);
            if (selectedPlan) {
                navigate(`/dashboard/subscription/checkout?planId=${selectedPlanId}&planName=${encodeURIComponent(selectedPlan.name)}&planPrice=${selectedPlan.monthlyPrice}`);
            }
        } catch (err: any) {
            setError(err.message || 'Error al cambiar el plan');
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

    if (!currentSubscription) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <Card>
                    <div className="text-center py-8">
                        <AlertCircle className="w-16 h-16 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No tienes una suscripción activa</h3>
                        <p className="mb-4">Necesitas tener una suscripción activa para cambiar de plan.</p>
                        <Button onClick={() => navigate('/dashboard/subscription/upgrade')}>
                            Ver Planes Disponibles
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    const currentPlan = plans.find(p => p.id === currentSubscription.planId);
    const selectedPlan = plans.find(p => p.id === selectedPlanId);

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/dashboard/subscription')}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-400 mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver a Suscripción</span>
                </button>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Cambiar Plan</h1>
                        <p>Actualiza tu plan actual</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800">{error}</span>
                </div>
            )}

            {/* Current Plan Card */}
            <Card className="mb-6 border-2 border-primary-500">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Plan Actual</h3>
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        Activo
                    </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-xl font-bold mb-2">
                            {currentPlan?.name || currentSubscription.plan.name}
                        </h4>
                        <p className="text-2xl font-bold mb-2">
                            €{currentPlan?.monthlyPrice || currentSubscription.plan.monthlyPrice}
                            <span className="text-lg">/{currentPlan?.billingCycle || currentSubscription.plan.billingCycle}</span>
                        </p>
                        <p className="text-sm">
                            Renovación: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('es-ES')}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="">Propiedades:</span>
                            <span className="font-medium">{currentPlan?.maxProperties || currentSubscription.plan.maxProperties}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="">Usuarios:</span>
                            <span className="font-medium">{currentPlan?.maxUsers || currentSubscription.plan.maxUsers}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="">Almacenamiento:</span>
                            <span className="font-medium">{currentPlan?.maxStorageMb || currentSubscription.plan.maxStorageMb} GB</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Recommended Plans */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Planes Recomendados</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans
                        .filter(plan => plan.id !== currentSubscription.planId)
                        .map((plan) => {
                            const isSelected = selectedPlanId === plan.id;
                            const isUpgrade = (plan.monthlyPrice || 0) > (currentPlan?.monthlyPrice || 0);
                            const isPopular = plan.key === PlanKey.MANAGER || plan.key === PlanKey.COMPANY_SMALL;

                            return (
                                <Card
                                    key={plan.id}
                                    className={`relative cursor-pointer transition-all ${
                                        isSelected ? 'ring-2 ring-primary-500 shadow-lg' : 'hover:shadow-md'
                                    }`}
                                    onClick={() => setSelectedPlanId(plan.id)}
                                >
                                    {isPopular && (
                                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                            <div className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1">
                                                <Star className="w-4 h-4" />
                                                <span>Recomendado</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-center mb-6">
                                        <div className={`inline-flex items-center justify-center w-16 h-16 ${
                                            isUpgrade ? 'bg-green-500' : 'bg-blue-500'
                                        } text-white rounded-full mb-4`}>
                                            {isUpgrade ? <ArrowRight className="w-8 h-8" /> : <Crown className="w-8 h-8" />}
                                        </div>
                                        <h4 className="text-xl font-bold text-[#1B4965] dark:text-gray-200 mb-2">
                                            {plan.name}
                                        </h4>
                                        <div className="mb-4">
                                            <span className="text-4xl font-bold text-[#1B4965] dark:text-gray-200">
                                                €{plan.monthlyPrice}
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400">/{plan.billingCycle}</span>
                                        </div>
                                        {!isUpgrade && (
                                            <span className="inline-block bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium mb-2">
                                                Bajar plan
                                            </span>
                                        )}
                                        {isUpgrade && (
                                            <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium mb-2">
                                                Subir plan
                                            </span>
                                        )}
                                    </div>

                                    <ul className="space-y-3 mb-6">
                                        <li className="flex items-center space-x-3">
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                            <span className="">
                                                Hasta {plan.maxProperties} propiedades
                                            </span>
                                        </li>
                                        <li className="flex items-center space-x-3">
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                            <span className="">
                                                {plan.maxUsers} usuarios
                                            </span>
                                        </li>
                                        <li className="flex items-center space-x-3">
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                            <span className="">
                                                {plan.maxStorageMb} GB almacenamiento
                                            </span>
                                        </li>
                                    </ul>

                                    <Button
                                        onClick={() => setSelectedPlanId(plan.id)}
                                        className={`w-full ${
                                            isSelected
                                                ? 'bg-[#1B4965] text-white'
                                                : 'bg-gray-100  hover:bg-gray-200'
                                        }`}
                                    >
                                        {isSelected ? 'Seleccionado' : 'Seleccionar Plan'}
                                    </Button>
                                </Card>
                            );
                        })}
                </div>
            </div>

            {/* Change Plan Button */}
            {selectedPlanId && selectedPlanId !== currentSubscription.planId && (
                <div className="text-center">
                    <Card className="mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Cambiando de</p>
                                <p className="font-semibold">{currentPlan?.name}</p>
                            </div>
                            <ArrowRight className="w-6 h-6 text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-600">a</p>
                                <p className="font-semibold">{selectedPlan?.name}</p>
                            </div>
                        </div>
                    </Card>
                    <div className='w-full flex flex-col justify-center'>
                        <Button
                            onClick={handleChangePlan}
                            disabled={isProcessing}
                            size="lg"
                            className="w-md bg-gradient-to-r from-blue-500 to-purple-500 text-white 
                            px-8 py-4 rounded-lg font-semibold text-lg hover:from-blue-600 hover:to-purple-600 
                            transition-all disabled:opacity-50 mx-auto"
                        >
                            {isProcessing ? (
                                <>
                                    <Spinner size="sm" className="mr-2" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <CreditCard className="w-5 h-5 mr-2 inline" />
                                    Confirmar Cambio de Plan
                                </>
                            )}
                        </Button>
                        <p className="text-sm text-gray-500 mt-4">
                            Los cambios se aplicarán en tu próxima facturación
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

