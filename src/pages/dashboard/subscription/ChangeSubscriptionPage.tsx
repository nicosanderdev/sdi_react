import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

    // Get the three plans to display: FREE, MANAGER_PRO, and COMPANY
    const freePlan = plans.find(plan => plan.key === PlanKey.FREE);
    const proPlan = plans.find(plan => plan.key === PlanKey.MANAGER_PRO);
    const companyPlan = plans.find(plan => 
        plan.key === PlanKey.COMPANY_SMALL || plan.key === PlanKey.COMPANY_UNLIMITED
    );
    
    const displayPlans = [freePlan, proPlan, companyPlan].filter(Boolean) as PlanData[];

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
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center">
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

            {/* Current Plan Card - Usage Details and Billing */}
            <Card className="mb-6 border-2 border-primary-500 relative overflow-hidden bg-gradient-to-br from-green-50 to-primary-50 dark:from-green-900/20 dark:to-primary-900/20">
                {/* Animated background indicator */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 via-primary-500 to-green-500 animate-pulse"></div>
                
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                            <Check className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold">Plan Actual</h3>
                    </div>
                    <span className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg flex items-center space-x-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                        <span>Activo</span>
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

            {/* Comparison Plans */}
            <div className="mb-8">
                <h3 className="text-xl font-semibold mb-8">Comparar Planes</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {displayPlans.map((plan) => {
                        const isCurrentPlan = plan.id === currentSubscription.planId;
                        const isSelected = selectedPlanId === plan.id && !isCurrentPlan;
                        const isUpgrade = (plan.monthlyPrice || 0) > (currentPlan?.monthlyPrice || 0);
                        const isPopular = plan.key === PlanKey.MANAGER_PRO || plan.key === PlanKey.COMPANY_SMALL;
                        const isCompanyPlan = plan.key === PlanKey.COMPANY_SMALL || plan.key === PlanKey.COMPANY_UNLIMITED;

                            return (
                                <Card
                                    key={plan.id}
                                    className={`relative transition-all duration-300 transform ${
                                        isCurrentPlan
                                            ? 'shadow-2xl scale-105 border-2 border-primary-500 bg-gradient-to-br from-green-50 to-primary-50 dark:from-green-900/30 dark:to-primary-900/30'
                                            : isSelected 
                                            ? 'ring-2 ring-primary-500 shadow-xl scale-105 border-primary-500 cursor-pointer bg-gradient-to-br from-green-500/10 to-blue-500/10 dark:from-green-500/20 dark:to-blue-500/20' 
                                            : 'hover:shadow-xl hover:scale-105 hover:border-primary-300 border-gray-200 dark:border-gray-700 cursor-pointer'
                                    }`}
                                    onClick={() => {
                                        if (isCurrentPlan) return;
                                        if (isCompanyPlan) {
                                            navigate('/dashboard/company/subscription');
                                        } else {
                                            setSelectedPlanId(plan.id);
                                        }
                                    }}
                                >
                                    {/* Animated glow effect */}
                                    <div className={`absolute inset-0 rounded-lg transition-opacity duration-300 ${
                                        isCurrentPlan
                                            ? 'opacity-100 bg-gradient-to-br from-green-100/70 to-primary-100/70 dark:from-green-900/40 dark:to-primary-900/40'
                                            : isSelected 
                                            ? 'opacity-100 bg-gradient-to-br from-green-100/50 to-blue-100/50 dark:from-green-900/30 dark:to-blue-900/30' 
                                            : 'opacity-0 hover:opacity-100 bg-gradient-to-br from-primary-50/50 to-green-50/50 dark:from-primary-900/20 dark:to-green-900/20'
                                    } pointer-events-none`}></div>
                                    
                                    {/* Current Plan Indicator */}
                                    {isCurrentPlan && (
                                        <>
                                            {/* Current Plan Badge */}
                                            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                                                <div className="bg-gradient-to-r from-green-500 to-primary-500 text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center space-x-2 shadow-lg">
                                                    <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                                                    <span>Activo</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    
                                    {/* Popular/Recommended Badge */}
                                    {!isCurrentPlan && isPopular && (
                                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
                                            <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center space-x-1 shadow-lg">
                                                <Star className="w-4 h-4 animate-spin-slow" />
                                                <span>Recomendado</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Selection indicator */}
                                    {isSelected && (
                                        <div className="absolute top-4 right-4 z-10">
                                            <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                                                <Check className="w-5 h-5 text-white" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="text-center mb-6 relative z-10">
                                        <div className={`inline-flex items-center justify-center w-16 h-16 ${
                                            isCurrentPlan 
                                                ? 'bg-gradient-to-br from-green-500 to-green-600 ring-4 ring-green-200 dark:ring-green-800 animate-pulse'
                                                : isUpgrade 
                                                ? 'bg-gradient-to-br from-green-500 to-green-600' 
                                                : 'bg-gradient-to-br from-blue-500 to-blue-600'
                                        } text-white rounded-full mb-4 transition-transform duration-300 ${
                                            isCurrentPlan || isSelected 
                                                ? 'scale-110 ring-4 ring-primary-200 dark:ring-primary-800' 
                                                : 'hover:scale-110'
                                        } shadow-lg`}>
                                            {isCurrentPlan ? (
                                                <Check className="w-8 h-8" />
                                            ) : isUpgrade ? (
                                                <ArrowRight className="w-8 h-8 animate-pulse" />
                                            ) : (
                                                <Crown className="w-8 h-8" />
                                            )}
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
                                        {!isUpgrade && !isCurrentPlan && (
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

                                    <ul className="space-y-3 mb-6 relative z-10">
                                        <li className="flex items-center space-x-3 transition-all duration-200 hover:translate-x-1">
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                            <span className="">
                                                Hasta {plan.maxProperties} propiedades
                                            </span>
                                        </li>
                                        <li className="flex items-center space-x-3 transition-all duration-200 hover:translate-x-1">
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                            <span className="">
                                                {plan.maxUsers} usuarios
                                            </span>
                                        </li>
                                        <li className="flex items-center space-x-3 transition-all duration-200 hover:translate-x-1">
                                            <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                                            <span className="">
                                                {plan.maxStorageMb} GB almacenamiento
                                            </span>
                                        </li>
                                    </ul>

                                    <Button
                                        onClick={() => {
                                            if (isCurrentPlan) return;
                                            if (isCompanyPlan) {
                                                navigate('/dashboard/company/subscription');
                                            } else {
                                                setSelectedPlanId(plan.id);
                                            }
                                        }}
                                        disabled={isCurrentPlan}
                                        className={`w-full relative z-10 transition-all duration-300 ${
                                            isCurrentPlan
                                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg cursor-not-allowed'
                                                : isSelected
                                                ? 'bg-gradient-to-r from-[#1B4965] to-primary-600 text-white shadow-lg transform scale-105'
                                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300'
                                        }`}
                                    >
                                        {isCurrentPlan ? (
                                            <span className="flex items-center justify-center space-x-2">
                                                <Check className="w-4 h-4" />
                                                <span>Plan Actual</span>
                                            </span>
                                        ) : isSelected ? (
                                            <span className="flex items-center justify-center space-x-2">
                                                <Check className="w-4 h-4" />
                                                <span>Seleccionado</span>
                                            </span>
                                        ) : isCompanyPlan ? (
                                            'Ver Plan Empresa'
                                        ) : (
                                            'Seleccionar Plan'
                                        )}
                                    </Button>
                                </Card>
                            );
                        })}
                </div>
            </div>

            {/* Change Plan Button */}
            {selectedPlanId && selectedPlanId !== currentSubscription.planId && (
                <div className="text-center max-w-md mx-auto">
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
                            className="w-md bg-gradient-to-r from-blue-500 to-green-500 text-white 
                            px-8 py-4 rounded-lg font-semibold text-lg hover:from-blue-600 hover:to-green-600 
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

