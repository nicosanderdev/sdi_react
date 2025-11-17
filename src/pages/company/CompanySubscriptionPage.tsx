import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Button, Spinner, Tabs, TabItem } from 'flowbite-react';
import { 
    Crown,
    ArrowLeft,
    Settings,
    Calendar,
    CreditCard,
    Download,
    AlertCircle,
    Building2
} from 'lucide-react';
import subscriptionService from '../../services/SubscriptionService';
import { SubscriptionData } from '../../models/subscriptions/SubscriptionData';
import { BillingHistoryData } from '../../models/subscriptions/BillingHistoryData';
import { ChangeSubscriptionPage } from '../dashboard/subscription/ChangeSubscriptionPage';
import { CancelSubscriptionPage } from '../dashboard/subscription/CancelSubscriptionPage';

export function CompanySubscriptionPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [billingHistory, setBillingHistory] = useState<BillingHistoryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (!id) {
            setError('ID de compañía no proporcionado');
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [subscriptionData, billingData] = await Promise.all([
                    subscriptionService.getCompanySubscription(id),
                    subscriptionService.getBillingHistory().catch(() => [])
                ]);
                setSubscription(subscriptionData);
                setBillingHistory(billingData);
            } catch (err: any) {
                setError(err.message || 'Error al cargar la suscripción de la compañía');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'expired': return 'text-red-600 bg-red-100';
            case 'pending': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="xl" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <Card>
                    <div className="text-center py-8">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Error</h3>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <Button onClick={() => navigate(-1)}>Volver</Button>
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
                    onClick={() => navigate(-1)}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver</span>
                </button>
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Suscripción de Compañía</h1>
                        <p>Gestiona la suscripción de esta compañía</p>
                    </div>
                </div>
            </div>

            <Tabs onActiveTabChange={(tab: number) => setActiveTab(tab.toString())}>
                <TabItem active title="Resumen" icon={Crown}>
                    {subscription ? (
                        <div className="space-y-6">
                            <Card>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold">Plan Actual</h2>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(subscription.status)}`}>
                                        {subscription.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-2xl font-bold mb-2">
                                            {subscription.plan.name}
                                        </h3>
                                        <div className="flex items-baseline space-x-2 mb-4">
                                            <span className="text-3xl font-bold">
                                                €{subscription.plan.monthlyPrice}
                                            </span>
                                            <span className="text-gray-600">/{subscription.plan.billingCycle}</span>
                                        </div>
                                        <p className="text-gray-600 mb-4">
                                            Próxima facturación: {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
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
                                                <span className="font-medium">{subscription.plan.maxStorageMb} GB</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card>
                                <h3 className="text-lg font-semibold mb-4">Acciones Rápidas</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Button
                                        onClick={() => setActiveTab('change')}
                                        color="blue"
                                        className="flex items-center justify-center space-x-2"
                                    >
                                        <Settings className="w-4 h-4" />
                                        <span>Cambiar Plan</span>
                                    </Button>
                                    <Button
                                        onClick={() => setActiveTab('cancel')}
                                        color="failure"
                                        className="flex items-center justify-center space-x-2"
                                    >
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Cancelar</span>
                                    </Button>
                                    <Button
                                        onClick={() => setActiveTab('billing')}
                                        color="gray"
                                        className="flex items-center justify-center space-x-2"
                                    >
                                        <CreditCard className="w-4 h-4" />
                                        <span>Facturación</span>
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    ) : (
                        <Card>
                            <div className="text-center py-8">
                                <Crown className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Sin Suscripción</h3>
                                <p className="text-gray-600 mb-4">
                                    Esta compañía no tiene una suscripción activa.
                                </p>
                                <Button onClick={() => setActiveTab('upgrade')}>
                                    Crear Suscripción
                                </Button>
                            </div>
                        </Card>
                    )}
                </TabItem>
                <TabItem title="Cambiar Plan" icon={Settings}>
                    <ChangeSubscriptionPage />
                </TabItem>
                <TabItem title="Cancelar" icon={AlertCircle}>
                    <CancelSubscriptionPage />
                </TabItem>
                <TabItem title="Facturación" icon={CreditCard}>
                    <div className="space-y-4">
                        {billingHistory.length === 0 ? (
                            <Card>
                                <div className="text-center py-8">
                                    <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold mb-2">No hay facturas</h3>
                                    <p className="text-gray-600">
                                        Aún no hay facturas para esta compañía.
                                    </p>
                                </div>
                            </Card>
                        ) : (
                            billingHistory.map((invoice) => (
                                <Card key={invoice.id}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold">
                                                Factura #{invoice.providerInvoiceId || invoice.id.slice(0, 8)}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {new Date(invoice.paidAt).toLocaleDateString('es-ES')}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <span className="font-semibold">€{invoice.amount.toFixed(2)}</span>
                                            <Button
                                                onClick={() => subscriptionService.downloadInvoice(invoice.id)}
                                                size="sm"
                                                color="gray"
                                            >
                                                <Download className="w-4 h-4 mr-2" />
                                                Descargar
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </div>
                </TabItem>
            </Tabs>
        </div>
    );
}

