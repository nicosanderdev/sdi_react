import React, { useState } from 'react';
import { Card, Button, Badge, Table, Spinner } from 'flowbite-react';
import { Download, Eye, Calendar, CreditCard, FileText } from 'lucide-react';
import { BillingHistoryData } from '../../models/subscriptions/BillingHistoryData';
import subscriptionService from '../../services/SubscriptionService';

interface BillingHistoryTableProps {
    billingHistory: BillingHistoryData[];
    isLoading: boolean;
    onViewInvoice: (invoice: BillingHistoryData) => void;
}

export const BillingHistoryTable: React.FC<BillingHistoryTableProps> = ({
    billingHistory,
    isLoading,
    onViewInvoice
}) => {
    const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

    const handleDownloadInvoice = async (invoice: BillingHistoryData) => {
        try {
            setDownloadingIds(prev => new Set(prev).add(invoice.id));
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
            setDownloadingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(invoice.id);
                return newSet;
            });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case '0':
                return <Badge color="success">Pagada</Badge>;
            case '1':
                return <Badge color="warning">Pendiente</Badge>;
            case '2':
                return <Badge color="failure">Fallida</Badge>;
            default:
                return <Badge color="gray">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <Card>
                <div className="flex items-center justify-center py-12">
                    <Spinner size="xl" />
                </div>
            </Card>
        );
    }

    if (billingHistory.length === 0) {
        return (
            <Card>
                <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No hay facturas disponibles</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        Aún no tienes facturas en tu historial.
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div className="overflow-x-auto">
                <Table hoverable>
                    <Table.Head>
                        <Table.HeadCell>Factura</Table.HeadCell>
                        <Table.HeadCell>Fecha</Table.HeadCell>
                        <Table.HeadCell>Estado</Table.HeadCell>
                        <Table.HeadCell>Monto</Table.HeadCell>
                        <Table.HeadCell>Acciones</Table.HeadCell>
                    </Table.Head>
                    <Table.Body className="divide-y">
                        {billingHistory.map((invoice) => (
                            <Table.Row key={invoice.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                                <Table.Cell>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-primary-500 dark:bg-green-900 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <CreditCard className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                #{invoice.providerInvoiceId || invoice.id.slice(0, 8)}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                ID: {invoice.id.slice(0, 8)}...
                                            </div>
                                        </div>
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {new Date(invoice.createdAt).toLocaleDateString('es-ES', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(invoice.createdAt).toLocaleTimeString('es-ES', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    {getStatusBadge(invoice.status)}
                                </Table.Cell>
                                <Table.Cell>
                                    <div className="font-semibold text-gray-900 dark:text-white">
                                        €{invoice.amount.toFixed(2)}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {invoice.currency}
                                    </div>
                                </Table.Cell>
                                <Table.Cell>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            size="sm"
                                            color="light"
                                            onClick={() => onViewInvoice(invoice)}
                                            className="flex items-center space-x-1"
                                        >
                                            <Eye className="w-4 h-4" />
                                            <span>Ver</span>
                                        </Button>
                                        <Button
                                            size="sm"
                                            color="alternative"
                                            onClick={() => handleDownloadInvoice(invoice)}
                                            disabled={downloadingIds.has(invoice.id)}
                                            className="flex items-center space-x-1"
                                        >
                                            <Download className="w-4 h-4" />
                                            <span>{downloadingIds.has(invoice.id) ? '...' : 'PDF'}</span>
                                        </Button>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </div>
        </Card>
    );
};
