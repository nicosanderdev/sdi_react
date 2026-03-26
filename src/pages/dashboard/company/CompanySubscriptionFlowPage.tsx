import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store/store';
import { Card, Button, Spinner, Alert, Select } from 'flowbite-react';
import {
    Building2,
    Crown,
    ArrowLeft,
    AlertCircle,
    CheckCircle,
    CreditCard,
    Plus
} from 'lucide-react';
import { useSubscriptionGate } from '../../../hooks/useSubscriptionGate';
import subscriptionService from '../../../services/SubscriptionService';
import companyService from '../../../services/CompanyService';
import { SubscriptionData } from '../../../models/subscriptions/SubscriptionData';
import { CompanyInfo } from '../../../models/companies/CompanyInfo';
import { CreateCompanyModal } from '../../../components/company/CreateCompanyModal';
import { PlanKey } from '../../../models/subscriptions/PlanKey';
import { usePayment } from '../../../contexts/PaymentContext';
import { CreatePaymentRequest } from '../../../models/payments/PaymentData';

export function CompanySubscriptionFlowPage() {
    const user = useSelector((state: RootState) => state.user.profile);
    const navigate = useNavigate();

    // Subscription gate state
    const {
        hasCompanyMembership,
        companyIds,
        hasPersonalSubscription,
        isLoading: isGatingLoading,
        error: gatingError
    } = useSubscriptionGate();

    // Local state
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
    const [companySubscription, setCompanySubscription] = useState<SubscriptionData | null>(null);
    const [isLoadingCompany, setIsLoadingCompany] = useState(false);
    const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);

    const hasMultipleCompanies = companyIds.length > 1;
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

    // Initialize selected company when membership info is available
    useEffect(() => {
        if (hasCompanyMembership && companyIds.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(companyIds[0]);
        }
    }, [hasCompanyMembership, companyIds, selectedCompanyId]);

    // Load company info when user has company membership and a company is selected
    useEffect(() => {
        if (hasCompanyMembership && selectedCompanyId) {
            loadCompanyInfo(selectedCompanyId);
        }
    }, [hasCompanyMembership, selectedCompanyId]);

    // Load company subscription when company info is available
    useEffect(() => {
        if (companyInfo?.id) {
            loadCompanySubscription();
        }
    }, [companyInfo]);

    const loadCompanyInfo = async (companyId?: string) => {
        try {
            setIsLoadingCompany(true);
            setError(null);
            const info = await companyService.getCompanyInfo(companyId);
            setCompanyInfo(info);
        } catch (err: any) {
            setError(err.message || 'Error loading company information');
        } finally {
            setIsLoadingCompany(false);
        }
    };

    const loadCompanySubscription = async () => {
        if (!companyInfo?.id) return;

        try {
            setIsLoadingSubscription(true);
            const subscription = await subscriptionService.getCompanySubscription(companyInfo.id);
            setCompanySubscription(subscription);
        } catch (err: any) {
            // It's OK if there's no subscription, we'll show plan selection
            setCompanySubscription(null);
        } finally {
            setIsLoadingSubscription(false);
        }
    };

    const handleCreateCompanySuccess = async (newCompany: any) => {
        setShowCreateCompanyModal(false);
        setCompanyInfo(newCompany);
        // The subscription loading will trigger automatically via useEffect
    };

    // Show loading state while determining access
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

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/dashboard/subscription')}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver a Gestión de suscripción</span>
                </button>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Suscripción de Empresa</h1>
                        <p>Gestiona la suscripción de tu empresa</p>
                    </div>
                </div>
            </div>

            {error && (
                <Alert color="failure" icon={AlertCircle} className="mb-6">
                    {error}
                </Alert>
            )}

            {/* No company membership - show create company prompt */}
            {!hasCompanyMembership && (
                <Card>
                    <div className="text-center py-12">
                        <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Necesitas una Empresa</h3>
                        <p className="text-gray-600 mb-6">
                            No perteneces a ninguna empresa actualmente. Para suscribirte a un plan de empresa, primero necesitas crear una empresa.
                        </p>
                        <Button
                            onClick={() => setShowCreateCompanyModal(true)}
                            className="bg-[#1B4965] text-white px-6 py-3 rounded-lg hover:bg-[#153a52] transition-colors flex items-center space-x-2 mx-auto"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Crear Empresa</span>
                        </Button>
                    </div>
                </Card>
            )}

            {/* Company selection and current company info */}
            {hasCompanyMembership && !isLoadingCompany && companyInfo && (
                <Card className="mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold">Empresa seleccionada</h2>
                            <p className="text-gray-600">
                                {companyInfo.name}
                            </p>
                        </div>
                        {hasMultipleCompanies && (
                            <div className="w-full md:w-64">
                                <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                                    Selecciona empresa
                                </label>
                                <Select
                                    value={selectedCompanyId ?? ''}
                                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                                >
                                    {companyIds.map((id, index) => (
                                        <option key={id} value={id}>
                                            {`Empresa ${index + 1}`}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Has company membership but loading company info */}
            {hasCompanyMembership && isLoadingCompany && (
                <Card>
                    <div className="text-center py-12">
                        <Spinner size="xl" className="mx-auto mb-4" />
                        <p className="text-gray-600">Cargando información de la empresa...</p>
                    </div>
                </Card>
            )}

            {/* Company exists but no subscription - show company plan selection */}
            {hasCompanyMembership && companyInfo && !isLoadingCompany && !companySubscription && !isLoadingSubscription && (
                <CompanyPlanSelection companyId={companyInfo.id} companyName={companyInfo.name} />
            )}

            {/* Company has active subscription - show subscription details */}
            {hasCompanyMembership && companyInfo && companySubscription && !isLoadingSubscription && (
                <CompanySubscriptionDetails
                    companyInfo={companyInfo}
                    subscription={companySubscription}
                    onRefresh={loadCompanySubscription}
                />
            )}

            {/* Create Company Modal */}
            <CreateCompanyModal
                show={showCreateCompanyModal}
                onClose={() => setShowCreateCompanyModal(false)}
                onSuccess={handleCreateCompanySuccess}
            />
        </div>
    );
}

// Component for company plan selection
function CompanyPlanSelection({ companyId, companyName }: { companyId: string; companyName: string }) {
    const { createPayment } = usePayment();
    const user = useSelector((state: RootState) => state.user.profile);
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
                // Filter to company plans only (company_small and company_unlimited)
                const companyPlans = plansData.filter(plan => (plan.key === PlanKey.COMPANY_SMALL || plan.key === PlanKey.COMPANY_UNLIMITED) && plan.isActive);
                setPlans(companyPlans);
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
            const orderId = `sub_company_${companyId}_${selectedPlanId}_${Date.now()}`;

            // Create payment request for DLocal
            const paymentRequest: CreatePaymentRequest = {
                amount: selectedPlan.monthlyPrice,
                currency: selectedPlan.currency,
                paymentMethod: 'card', // Default to card payment, can be expanded later
                orderId,
                description: `Subscription to ${selectedPlan.name} plan for ${companyName}`,
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
            <Card>
                <div className="text-center py-12">
                    <Spinner size="xl" className="mx-auto mb-4" />
                    <p className="text-gray-600">Cargando planes de empresa...</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <Alert color="failure" icon={AlertCircle} className="mb-6">
                    {error}
                </Alert>
            )}

            <Card>
                <div className="text-center mb-6">
                    <Crown className="w-12 h-12 text-purple-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Plan de Empresa para {companyName}</h2>
                    <p className="text-gray-600">Selecciona un plan de empresa para acceder a funciones avanzadas.</p>
                </div>

                {plans.length === 0 ? (
                    <div className="text-center py-8">
                        <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No hay planes de empresa disponibles.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer transition-all border-2 ${
                                    selectedPlanId === plan.id
                                        ? 'ring-2 ring-purple-600 border-purple-600 shadow-lg'
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
                                            ? 'bg-purple-600 text-white'
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

// Component for company subscription details
function CompanySubscriptionDetails({
    companyInfo,
    subscription,
    onRefresh
}: {
    companyInfo: CompanyInfo;
    subscription: SubscriptionData;
    onRefresh: () => void;
}) {
    const navigate = useNavigate();

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'expired': return 'text-red-600 bg-red-100';
            case 'pending': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    return (
        <div className="space-y-6">
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Suscripción Activa de {companyInfo.name}</h2>
                    <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
                        <CheckCircle className="w-4 h-4" />
                        <span>{subscription.status}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-2xl font-bold mb-2">{subscription.plan.name}</h3>
                        <div className="flex items-baseline space-x-2 mb-4">
                            <span className="text-3xl font-bold">€{subscription.plan.monthlyPrice}</span>
                            <span className="text-gray-600">/{subscription.plan.billingCycle}</span>
                        </div>
                        <p className="text-gray-600 mb-4">
                            Próxima facturación: {formatDate(subscription.currentPeriodEnd?.toString() ?? '')}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Propiedades</span>
                                <span className="font-medium">{subscription.plan.maxProperties}</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Usuarios</span>
                                <span className="font-medium">{subscription.plan.maxUsers}</span>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Almacenamiento</span>
                                <span className="font-medium">{subscription.plan.maxStorageMb} MB</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-semibold mb-4">Acciones</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                        onClick={() => navigate('/company/' + companyInfo.id + '/subscription')}
                        color="blue"
                        className="flex items-center justify-center space-x-2"
                    >
                        <Crown className="w-4 h-4" />
                        <span>Gestionar Detalles</span>
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard/subscription/change')}
                        color="gray"
                        className="flex items-center justify-center space-x-2"
                    >
                        <CreditCard className="w-4 h-4" />
                        <span>Cambiar Plan</span>
                    </Button>
                    <Button
                        onClick={onRefresh}
                        color="light"
                        className="flex items-center justify-center space-x-2"
                    >
                        <AlertCircle className="w-4 h-4" />
                        <span>Actualizar</span>
                    </Button>
                </div>
            </Card>
        </div>
    );
}
