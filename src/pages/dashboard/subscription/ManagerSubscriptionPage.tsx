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
import { PlanKey } from '../../../models/subscriptions/PlanKey';
import { usePropertyQuota } from '../../../hooks/usePropertyQuota';
import type { PropertyType } from '../../../models/properties/PropertyData';

export function ManagerSubscriptionPage() {
    const user = useSelector((state: RootState) => state.user.profile);
    const navigate = useNavigate();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [billingHistory, setBillingHistory] = useState<BillingHistoryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedPropertyType, setSelectedPropertyType] = useState<PropertyType | 'all'>('all');

    // Get property quota data
    const {
        publishedCount,
        ownedCount,
        publishedLimit,
        totalLimit,
        isLoading: isQuotaLoading
    } = usePropertyQuota();

    useEffect(() => {
        const fetchSubscription = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await subscriptionService.getCurrentSubscription();
                setSubscription(response);
            } catch (err: any) {
                console.error('Error fetching subscription:', err);
                setError(err.message || 'Error al cargar la suscripción');
            } finally {
                setIsLoading(false);
            }
        };
        fetchSubscription();
    }, []);

    useEffect(() => {
        const fetchBillingHistory = async () => {
            const response = await subscriptionService.getBillingHistory();
            // Only load last 5 receipts
            setBillingHistory(response.slice(0, 5));
        };
        fetchBillingHistory();
    }, []);

    const getPropertyTypeLabel = (type: PropertyType | 'all') => {
        if (type === 'all') return 'Todas';
        switch (type) {
            case 'RealEstate': return 'En Venta';
            case 'AnnualRent': return 'En Alquiler';
            case 'EventVenue': return 'Locales';
            case 'SummerRent': return 'Alquileres de verano';
            default: return type;
        }
    };

    const availablePropertyTypes: PropertyType[] =
        subscription?.propertyTypes && subscription.propertyTypes.length > 0
            ? subscription.propertyTypes
            : subscription?.propertyType
                ? [subscription.propertyType]
                : [];

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="xl" />
            </div>
        );
    }

    // Show error state if failed
    if (error) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <Card>
                    <div className="text-center py-8">
                        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Error</h3>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <Button onClick={() => window.location.reload()}>Reintentar</Button>
                    </div>
                </Card>
            </div>
        );
    }

    // Always show subscription info (including free plan)
    if (!subscription) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="xl" />
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

    // Calculate progress bar percentages
    const publishedLimitValue = subscription?.plan.publishedProperties ?? publishedLimit ?? 1;
    const publishedPercentage = isQuotaLoading ? 0 : Math.min(100, (publishedCount / publishedLimitValue) * 100);
    
    const totalLimitValue = subscription?.plan.totalProperties ?? totalLimit ?? 1;
    const totalPercentage = isQuotaLoading ? 0 : Math.min(100, (ownedCount / totalLimitValue) * 100);

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                        <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Estado de Suscripción</h1>
                        <p>Gestiona tu plan {subscription?.plan.name ?? ''}</p>
                    </div>
                </div>
                {availablePropertyTypes.length > 0 && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Tipo de propiedad
                        </label>
                        <select
                            className="mt-1 block w-full md:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            value={selectedPropertyType}
                            onChange={(e) => setSelectedPropertyType(e.target.value as PropertyType | 'all')}
                        >
                            <option value="all">Todas</option>
                            {availablePropertyTypes.map((t) => (
                                <option key={t} value={t}>
                                    {getPropertyTypeLabel(t)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
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
                                    {subscription.plan.key !== PlanKey.FREE && (
                                        <span className="text-gray-600">/{subscription?.plan.billingCycle ?? ''}</span>
                                    )}
                                </div>
                                {subscription.plan.key !== PlanKey.FREE && (
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                                        Próxima facturación: {formatDate(subscription?.currentPeriodEnd?.toString() ?? '')}
                                    </p>
                                )}
                                {subscription.plan.key === PlanKey.FREE && (
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                                        Plan gratuito - Sin facturación
                                    </p>
                                )}
                                <div className="flex flex-col space-y-2">
                                    <Button
                                        color="green"
                                        onClick={() => navigate('/dashboard/subscription/change')}
                                        className="px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                                    >
                                        <Crown className="w-4 h-4" />
                                        <span>{subscription.plan.key === PlanKey.FREE ? 'Ver Planes' : 'Cambiar Plan'}</span>
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-300">Propiedades publicadas</span>
                                        <span className="font-medium">
                                            {isQuotaLoading ? '...' : publishedCount}/{subscription?.plan.publishedProperties ?? publishedLimit ?? '0'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        {isQuotaLoading ? (
                                            <div className="bg-gray-300 h-2 rounded-full animate-pulse" style={{ width: "50%" }}></div>
                                        ) : (
                                            <div
                                                className="bg-[#1B4965] h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${publishedPercentage}%` }}
                                            >
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-300">Propiedades totales</span>
                                        <span className="font-medium">
                                            {isQuotaLoading ? '...' : ownedCount}/{subscription?.plan.totalProperties ?? totalLimit ?? '0'}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        {isQuotaLoading ? (
                                            <div className="bg-gray-300 h-2 rounded-full animate-pulse" style={{ width: "50%" }}></div>
                                        ) : (
                                            <div
                                                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                                style={{ width: `${totalPercentage}%` }}
                                            ></div>
                                        )}
                                    </div>
                                </div>

                                {/* <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-300">Usuarios</span>
                                        <span className="font-medium">1/{subscription?.plan.maxUsers ?? '0'}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: "18%" }}
                                        ></div>
                                    </div>
                                </div> */}
                            </div>
                        </div>
                    </Card>

                    {/* Billing History */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Historial de Facturación</h3>
                            <p>Últimas facturas</p>
                        </div>
                        {billingHistory.length > 0 && (
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
                        )}
                        {billingHistory.length === 0 && (
                            <div className="text-center py-8">
                                <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No hay facturas</h3>
                                <p className="text-gray-600">Aún no hay facturas para esta suscripción.</p>
                            </div>
                        )}
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
                            {subscription.plan.key !== PlanKey.FREE && (
                                <button 
                                    onClick={() => navigate('/dashboard/subscription/cancel')}
                                    className="w-full flex items-center space-x-3 p-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-red-600"
                                >
                                    <AlertCircle className="w-5 h-5" />
                                    <span>Cancelar Suscripción</span>
                                </button>
                            )}
                        </div>
                    </Card>

                    {/* Support */}
                    <div className="bg-gradient-to-r from-blue-500 to-green-600 rounded-lg p-6 text-white">
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
