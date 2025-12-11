import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../../store/store';
import {
    Crown,
    CreditCard,
    Download,
    AlertCircle,
    CheckCircle,
    Clock,
    BarChart3,
    Users,
    Building2,
    MessageSquare
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { SubscriptionData } from '../../../models/subscriptions/SubscriptionData';
import { BillingHistoryData } from '../../../models/subscriptions/BillingHistoryData';
import { Button, Card, Spinner, Alert } from 'flowbite-react';
import { useSubscriptionGate } from '../../../hooks/useSubscriptionGate';
import { PlanKey } from '../../../models/subscriptions/PlanKey';
import { usePayment } from '../../../contexts/PaymentContext';
import { CreatePaymentRequest } from '../../../models/payments/PaymentData';

// Component for personal plans selection only
function PersonalPlansSelection() {
    const user = useSelector((state: RootState) => state.user.profile);
    const { createPayment } = usePayment();
    const [plans, setPlans] = useState<any[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                setIsLoading(true);
                const plansData = await subscriptionService.getPlans();
                // Filter to personal plans only (manager and manager_pro plans)
                const personalPlans = plansData.filter(plan => (plan.key === PlanKey.MANAGER || plan.key === PlanKey.MANAGER_PRO) && plan.isActive);
                setPlans(personalPlans);
            } catch (err: any) {
                setError(err.message || 'Error al cargar los planes');
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const handleSelectPlan = (planId: string) => {
        setSelectedPlanId(planId);
    };

    const handleProceedToPayment = async () => {
        if (!selectedPlanId) {
            setError('Por favor selecciona un plan');
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

            // Create order ID for subscription payment
            const orderId = `sub_personal_${user.id}_${selectedPlanId}_${Date.now()}`;

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
            <div className="flex items-center justify-center py-12">
                <Spinner size="xl" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <Alert color="failure" icon={AlertCircle} className="mb-6">
                    {error}
                </Alert>
            )}

            {/* Plans Display - Personal Only */}
            <Card>
                <h2 className="text-xl font-semibold mb-4">Planes Personales Disponibles</h2>

                {plans.length === 0 ? (
                    <div className="text-center py-8">
                        <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No hay planes personales disponibles.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map((plan) => (
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
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="text-sm">Hasta {plan.maxProperties} propiedades</span>
                                    </li>
                                    <li className="flex items-center space-x-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="text-sm">Hasta {plan.maxUsers} usuarios</span>
                                    </li>
                                    <li className="flex items-center space-x-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
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
            {selectedPlanId && (
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

export function ManagerSubscriptionPage() {
    const user = useSelector((state: RootState) => state.user.profile);
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [billingHistory, setBillingHistory] = useState<BillingHistoryData[]>([]);

    // Use the subscription gate hook to determine access
    const { hasPersonalSubscription, isLoading: isGatingLoading, error: gatingError } = useSubscriptionGate();

    useEffect(() => {
        const fetchSubscription = async () => {
            const response = await subscriptionService.getCurrentSubscription();
            setSubscription(response);
        };
        fetchSubscription();
    }, []);

    /* useEffect(() => {
        const fetchBillingHistory = async () => {
            const response = await subscriptionService.getBillingHistory();
            setBillingHistory(response);
        };
        fetchBillingHistory();
    }, []);*/

    // Show loading state while determining subscription status
    if (isGatingLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="xl" />
            </div>
        );
    }

    // Show error state if gating failed
    if (gatingError) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <Card>
                    <div className="text-center py-8">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Error</h3>
                        <p className="text-gray-600 mb-4">{gatingError}</p>
                        <Button onClick={() => window.location.reload()}>Reintentar</Button>
                    </div>
                </Card>
            </div>
        );
    }

    // If no personal subscription, show plan selection for personal plans only
    if (!hasPersonalSubscription) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Suscripción Requerida</h1>
                    <p className="text-gray-600">Para acceder a las funciones de Manager, necesitas una suscripción activa. Selecciona un plan personal a continuación.</p>
                </div>
                {/* Render PlansSelectionPage but restrict to personal plans */}
                <PersonalPlansSelection />
            </div>
        );
    }


    const formatDate = (dateStr : string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      };

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
            case '0': return <CheckCircle className="w-4 h-4" />;
            case '1': return <AlertCircle className="w-4 h-4" />;
            case '2': return <Clock className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    const handleUpdatePlan = () => {
        navigate('/dashboard/subscription/change');
    };

    const handleDownloadInvoice = async (invoiceId: string) => {
        try {
            const blob = await subscriptionService.downloadInvoice(invoiceId);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice-${invoiceId}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            alert('Error al descargar la factura: ' + (err.message || 'Error desconocido'));
        }
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
                        <h1 className="text-3xl font-bold">Estado de Suscripción</h1>
                        <p>Gestiona tu plan de Manager Premium</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Subscription Overview */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Current Plan Card */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">Plan Actual</h2>
                            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription?.status ?? '')}`}>
                                {getStatusIcon(subscription?.status.toString() ?? '')}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-2xl font-bold mb-2">
                                    {subscription?.plan.name ?? ''}
                                </h3>
                                <div className="flex items-baseline space-x-2 mb-4">
                                    <span className="text-3xl font-bold">
                                        €{subscription?.plan.monthlyPrice ?? ''}
                                    </span>
                                    <span className="text-gray-600">/{subscription?.plan.billingCycle ?? ''}</span>
                                </div>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    Próxima facturación: {formatDate(subscription?.currentPeriodEnd?.toString() ?? '')}
                                </p>
                                <div className="flex flex-col space-y-2">
                                    <Button
                                        onClick={handleUpdatePlan}
                                        className="bg-[#1B4965] text-white px-4 py-2 rounded-lg hover:bg-[#153a52] transition-colors flex items-center space-x-2"
                                    >
                                        <Crown className="w-4 h-4" />
                                        <span>Cambiar Plan</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Propiedades</span>
                                        <span className="font-medium">{8}/{subscription?.plan.maxProperties ?? '0'}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-[#1B4965] h-2 rounded-full"
                                            style={{ width: "50%" }}
                                        >
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Mensajes</span>
                                        <span className="font-medium">{8}/{subscription?.plan.maxUsers ?? '0'}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-green-500 h-2 rounded-full"
                                            style={{ width: "70%" }}
                                        ></div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600">Almacenamiento</span>
                                        <span className="font-medium">1.2 GB/{subscription?.plan.maxStorageMb ?? '0'}GB</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: "18%" }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Billing History */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Historial de Facturación</h3>
                            <p>Año actual: 2025</p>
                        </div>
                        <div className="space-y-3">
                            {billingHistory.map((invoice : BillingHistoryData) => (
                                <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div>
                                        <p className="font-medium">{invoice.providerInvoiceId}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{new Date(invoice.paidAt).toLocaleDateString('es-ES')}</p>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className="font-semibold">€{invoice.amount}</span>
                                        <button
                                            onClick={() => handleDownloadInvoice(invoice.id)}
                                            className="flex items-center space-x-1 hover:text-gray-800 dark:hover:text-gray-400 transition-colors"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span className="text-sm">Descargar</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <Card>
                        <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>
                        <div className="space-y-3">
                            <button 
                                onClick={() => navigate('/dashboard/subscription/change')}
                                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <Crown className="w-5 h-5" />
                                <span>Cambiar Plan</span>
                            </button>
                            <button 
                                onClick={() => navigate('/dashboard/subscription/billing-history')}
                                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <CreditCard className="w-5 h-5" />
                                <span>Historial de Facturación</span>
                            </button>
                            <button 
                                onClick={() => navigate('/dashboard/subscription/cancel')}
                                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600"
                            >
                                <AlertCircle className="w-5 h-5" />
                                <span>Cancelar Suscripción</span>
                            </button>
                        </div>
                    </Card>

                    {/* Usage Summary */}
                    <Card>
                        <h3 className="text-lg font-semibold mb-4">Resumen de Uso</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Building2 className="w-5 h-5 text-blue-500" />
                                    <span>Propiedades</span>
                                </div>
                                <span className="font-semibold">
                                    {subscription?.plan.maxProperties ?? '0'}/{subscription?.plan.maxProperties ?? '0'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <MessageSquare className="w-5 h-5 text-green-500" />
                                    <span>Mensajes</span>
                                </div>
                                <span className="font-semibold">
                                    {subscription?.plan.maxUsers ?? '0'}/{subscription?.plan.maxUsers ?? '0'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <BarChart3 className="w-5 h-5 text-purple-500" />
                                    <span>Reportes</span>
                                </div>
                                <span className="font-semibold">Ilimitados</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <Users className="w-5 h-5 text-orange-500" />
                                    <span>Usuarios</span>
                                </div>
                                <span className="font-semibold">1</span>
                            </div>
                        </div>
                    </Card>

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
