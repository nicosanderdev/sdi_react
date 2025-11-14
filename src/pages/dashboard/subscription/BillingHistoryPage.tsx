import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Spinner, Badge } from 'flowbite-react';
import { 
    ArrowLeft,
    Download,
    Calendar,
    CreditCard,
    FileText,
    AlertCircle
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { BillingHistoryData } from '../../../models/subscriptions/BillingHistoryData';

export function BillingHistoryPage() {
    const navigate = useNavigate();
    const [billingHistory, setBillingHistory] = useState<BillingHistoryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBillingHistory = async () => {
            try {
                setIsLoading(true);
                const data = await subscriptionService.getBillingHistory();
                setBillingHistory(data);
            } catch (err: any) {
                setError(err.message || 'Error al cargar el historial de facturación');
            } finally {
                setIsLoading(false);
            }
        };
        fetchBillingHistory();
    }, []);

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

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid':
            case '0':
                return <Badge color="success">Pagada</Badge>;
            case 'pending':
            case '1':
                return <Badge color="warning">Pendiente</Badge>;
            case 'failed':
            case '2':
                return <Badge color="failure">Fallida</Badge>;
            default:
                return <Badge color="gray">{status}</Badge>;
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
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Historial de Facturación</h1>
                        <p>Gestiona y descarga tus facturas</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800">{error}</span>
                </div>
            )}

            {/* Billing History List */}
            {billingHistory.length === 0 ? (
                <Card>
                    <div className="text-center py-12">
                        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No hay facturas disponibles</h3>
                        <p className="text-gray-600 mb-4">
                            Aún no tienes facturas en tu historial.
                        </p>
                    </div>
                </Card>
            ) : (
                <Card>
                    <div className="space-y-4">
                        {billingHistory.map((invoice) => (
                            <div
                                key={invoice.id}
                                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                            >
                                <div className="flex items-center space-x-4 flex-1">
                                    <div className="w-12 h-12 bg-[#1B4965] rounded-lg flex items-center justify-center">
                                        <CreditCard className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                Factura #{invoice.providerInvoiceId || invoice.id.slice(0, 8)}
                                            </h3>
                                            {getStatusBadge(invoice.status)}
                                        </div>
                                        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center space-x-1">
                                                <Calendar className="w-4 h-4" />
                                                <span>
                                                    {new Date(invoice.paidAt).toLocaleDateString('es-ES', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <span className="font-semibold text-gray-900 dark:text-white">
                                                    €{invoice.amount.toFixed(2)}
                                                </span>
                                                <span className="text-gray-500">{invoice.currency}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        onClick={() => handleDownloadInvoice(invoice.id)}
                                        size="sm"
                                        color="gray"
                                        className="flex items-center space-x-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Descargar</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Summary */}
            {billingHistory.length > 0 && (
                <Card className="mt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total de Facturas</p>
                            <p className="text-2xl font-bold">{billingHistory.length}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-600">Total Facturado</p>
                            <p className="text-2xl font-bold">
                                €{billingHistory
                                    .filter(inv => inv.status.toLowerCase() === 'paid' || inv.status === '0')
                                    .reduce((sum, inv) => sum + inv.amount, 0)
                                    .toFixed(2)}
                            </p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}

