import React from 'react';
import { Modal, Button } from 'flowbite-react';
import { Download, Calendar, CreditCard, FileText, X } from 'lucide-react';
import { BillingHistoryData } from '../../models/subscriptions/BillingHistoryData';
import subscriptionService from '../../services/SubscriptionService';

interface InvoiceModalProps {
    invoice: BillingHistoryData | null;
    isOpen: boolean;
    onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
    invoice,
    isOpen,
    onClose
}) => {
    const [isDownloading, setIsDownloading] = React.useState(false);

    if (!invoice) return null;

    const handleDownload = async () => {
        try {
            setIsDownloading(true);
            const blob = await subscriptionService.downloadInvoice(invoice.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice-${invoice.providerInvoiceId || invoice.id.slice(0, 8)}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            alert('Error al descargar la factura: ' + (err.message || 'Error desconocido'));
        } finally {
            setIsDownloading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case '0':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Pagada
                    </span>
                );
            case '1':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                        Pendiente
                    </span>
                );
            case '2':
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                        Fallida
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300">
                        {status}
                    </span>
                );
        }
    };

    return (
        <Modal show={isOpen} onClose={onClose} size="lg">
            <Modal.Header>
                <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Factura #{invoice.providerInvoiceId || invoice.id.slice(0, 8)}</span>
                </div>
            </Modal.Header>

            <Modal.Body>
                <div className="space-y-6">
                    {/* Status and Amount */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <CreditCard className="w-5 h-5 text-gray-500" />
                                <span className="text-2xl font-bold">
                                    €{invoice.amount.toFixed(2)}
                                </span>
                                <span className="text-gray-500">{invoice.currency}</span>
                            </div>
                            {getStatusBadge(invoice.status)}
                        </div>
                    </div>

                    {/* Invoice Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ID de Factura
                                </label>
                                <p className="text-sm text-gray-900 dark:text-white font-mono">
                                    {invoice.providerInvoiceId || invoice.id}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Fecha de Creación
                                </label>
                                <div className="flex items-center space-x-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-900 dark:text-white">
                                        {new Date(invoice.createdAt).toLocaleDateString('es-ES', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {invoice.paidAt && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Fecha de Pago
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-500" />
                                        <span className="text-sm text-gray-900 dark:text-white">
                                            {new Date(invoice.paidAt).toLocaleDateString('es-ES', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ID de Suscripción
                                </label>
                                <p className="text-sm text-gray-900 dark:text-white font-mono">
                                    {invoice.subscriptionId.slice(0, 8)}...
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-lg font-semibold">Total</span>
                            <span className="text-lg font-bold">
                                €{invoice.amount.toFixed(2)} {invoice.currency}
                            </span>
                        </div>
                    </div>
                </div>
            </Modal.Body>

            <Modal.Footer>
                <div className="flex justify-between w-full">
                    <Button color="gray" onClick={onClose}>
                        <X className="w-4 h-4 mr-2" />
                        Cerrar
                    </Button>

                    <Button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="flex items-center space-x-2"
                    >
                        <Download className="w-4 h-4" />
                        <span>{isDownloading ? 'Descargando...' : 'Descargar PDF'}</span>
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};
