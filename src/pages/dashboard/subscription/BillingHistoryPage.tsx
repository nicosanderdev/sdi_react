import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from 'flowbite-react';
import {
    ArrowLeft,
    FileText,
    AlertCircle,
    RefreshCw
} from 'lucide-react';
import { useBillingHistory } from '../../../hooks/useBillingHistory';
import { BillingFilters } from '../../../components/subscription/BillingFilters';
import { BillingHistoryTable } from '../../../components/subscription/BillingHistoryTable';
import { InvoiceModal } from '../../../components/subscription/InvoiceModal';
import { BillingHistoryData } from '../../../models/subscriptions/BillingHistoryData';

export function BillingHistoryPage() {
    const navigate = useNavigate();
    const {
        billingHistory,
        isLoading,
        error,
        filters,
        setFilters,
        refresh,
        totalAmount,
        filteredCount
    } = useBillingHistory();

    const [selectedInvoice, setSelectedInvoice] = useState<BillingHistoryData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleViewInvoice = (invoice: BillingHistoryData) => {
        setSelectedInvoice(invoice);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedInvoice(null);
    };

    const handleClearFilters = () => {
        setFilters({});
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate('/dashboard/subscription')}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-400 mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Volver a Suscripción</span>
                </button>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold">Historial de Facturación</h1>
                            <p>Gestiona y descarga tus facturas</p>
                        </div>
                    </div>
                    <Button
                        onClick={refresh}
                        disabled={isLoading}
                        size="sm"
                        color="light"
                        className="flex items-center space-x-2"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Actualizar</span>
                    </Button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800">{error}</span>
                </div>
            )}

            {/* Filters */}
            <BillingFilters
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={handleClearFilters}
            />

            {/* Billing History Table */}
            <BillingHistoryTable
                billingHistory={billingHistory}
                isLoading={isLoading}
                onViewInvoice={handleViewInvoice}
            />

            {/* Summary */}
            {billingHistory.length > 0 && (
                <Card className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total de Facturas</p>
                            <p className="text-2xl font-bold">{filteredCount}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Facturas Pagadas</p>
                            <p className="text-2xl font-bold">
                                {billingHistory.filter(inv => inv.status === '0').length}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Total Facturado</p>
                            <p className="text-2xl font-bold">€{totalAmount.toFixed(2)}</p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Invoice Modal */}
            <InvoiceModal
                invoice={selectedInvoice}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
            />
        </div>
    );
}

