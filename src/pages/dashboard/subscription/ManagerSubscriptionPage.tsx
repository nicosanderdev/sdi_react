import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../../store/store';
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
import subscriptionService from '../../../services/SubscriptionService';
import { SubscriptionData } from '../../../models/subscriptions/SubscriptionData';
import { BillingHistoryData } from '../../../models/subscriptions/BillingHistoryData';
import { Button, Card } from 'flowbite-react';



export function ManagerSubscriptionPage() {
    const user = useSelector((state: RootState) => state.user.profile);
    const navigate = useNavigate();
    const [isUpdating, setIsUpdating] = useState(false);
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [billingHistory, setBillingHistory] = useState<BillingHistoryData[]>([]);

    useEffect(() => {
        const fetchSubscription = async () => {
            const response = await subscriptionService.getCurrentSubscription();
            setSubscription(response);
        };
        fetchSubscription();
    }, []);

    useEffect(() => {
        const fetchBillingHistory = async () => {
            const response = await subscriptionService.getBillingHistory();
            setBillingHistory(response);
        };
        fetchBillingHistory();
    }, []);


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
                                        disabled={isUpdating}
                                        className="bg-[#1B4965] text-white px-4 py-2 rounded-lg hover:bg-[#153a52] transition-colors flex items-center space-x-2"
                                    >
                                        <Crown className="w-4 h-4" />
                                        <span>{isUpdating ? 'Procesando...' : 'Cambiar Plan'}</span>
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
