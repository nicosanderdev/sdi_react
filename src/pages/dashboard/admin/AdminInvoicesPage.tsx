import React, { useEffect, useState } from 'react';
import { Card, Button, Spinner, Badge, Table, Label, TableHead, TableHeadCell, TableBody, TableRow, TableCell } from 'flowbite-react';
import { 
    FileText,
    Search,
    Download,
    RefreshCw,
    Calendar
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { BillingHistoryData } from '../../../models/subscriptions/BillingHistoryData';

export function AdminInvoicesPage() {
    const [invoices, setInvoices] = useState<BillingHistoryData[]>([]);
    const [filteredInvoices, setFilteredInvoices] = useState<BillingHistoryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [userIdFilter, setUserIdFilter] = useState('');
    const [companyIdFilter, setCompanyIdFilter] = useState('');

    useEffect(() => {
        fetchInvoices();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [invoices, searchTerm, userIdFilter, companyIdFilter]);

    const fetchInvoices = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const filters: any = {};
            if (userIdFilter) filters.userId = userIdFilter;
            if (companyIdFilter) filters.companyId = companyIdFilter;

            const data = await subscriptionService.getAdminInvoices(filters);
            setInvoices(data);
        } catch (err: any) {
            setError(err.message || 'Error al cargar las facturas');
        } finally {
            setIsLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...invoices];

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(inv =>
                inv.id.toLowerCase().includes(term) ||
                inv.providerInvoiceId?.toLowerCase().includes(term) ||
                inv.subscriptionId.toLowerCase().includes(term)
            );
        }

        setFilteredInvoices(filtered);
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

    const totalAmount = invoices
        .filter(inv => inv.status.toLowerCase() === 'paid' || inv.status === '0')
        .reduce((sum, inv) => sum + inv.amount, 0);

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Gestión de Facturas</h1>
                        <p>Administra todas las facturas de la plataforma</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {/* Filters */}
            <Card className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="search">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                id="search"
                                type="text"
                                placeholder="Buscar por ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full rounded-lg border-gray-300"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="userId">ID de Usuario</Label>
                        <input
                            id="userId"
                            type="text"
                            placeholder="Filtrar por usuario..."
                            value={userIdFilter}
                            onChange={(e) => setUserIdFilter(e.target.value)}
                            className="w-full rounded-lg border-gray-300"
                        />
                    </div>
                    <div>
                        <Label htmlFor="companyId">ID de Compañía</Label>
                        <input
                            id="companyId"
                            type="text"
                            placeholder="Filtrar por compañía..."
                            value={companyIdFilter}
                            onChange={(e) => setCompanyIdFilter(e.target.value)}
                            className="w-full rounded-lg border-gray-300"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button
                            onClick={fetchInvoices}
                            color="gray"
                            className="w-full"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Actualizar
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card>
                    <div className="text-sm text-gray-600 mb-1">Total Facturas</div>
                    <div className="text-2xl font-bold">{invoices.length}</div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-600 mb-1">Pagadas</div>
                    <div className="text-2xl font-bold text-green-600">
                        {invoices.filter(inv => inv.status.toLowerCase() === 'paid' || inv.status === '0').length}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-600 mb-1">Pendientes</div>
                    <div className="text-2xl font-bold text-yellow-600">
                        {invoices.filter(inv => inv.status.toLowerCase() === 'pending' || inv.status === '1').length}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-600 mb-1">Total Facturado</div>
                    <div className="text-2xl font-bold text-blue-600">
                        €{totalAmount.toFixed(2)}
                    </div>
                </Card>
            </div>

            {/* Invoices Table */}
            <Card>
                <div className="overflow-x-auto">
                    <Table hoverable>
                        <TableHead>
                            <TableHeadCell>ID Factura</TableHeadCell>
                            <TableHeadCell>Suscripción</TableHeadCell>
                            <TableHeadCell>Fecha</TableHeadCell>
                            <TableHeadCell>Monto</TableHeadCell>
                            <TableHeadCell>Estado</TableHeadCell>
                            <TableHeadCell>Acciones</TableHeadCell>
                        </TableHead>
                        <TableBody className="divide-y">
                            {filteredInvoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        No se encontraron facturas
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell>
                                            <div className="font-medium">
                                                {invoice.providerInvoiceId || invoice.id.slice(0, 8)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-gray-500">
                                                {invoice.subscriptionId.slice(0, 8)}...
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center space-x-2">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                <span>
                                                    {new Date(invoice.paidAt).toLocaleDateString('es-ES')}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-semibold">
                                                €{invoice.amount.toFixed(2)}
                                            </div>
                                            <div className="text-sm text-gray-500">{invoice.currency}</div>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(invoice.status)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="xs"
                                                color="gray"
                                                onClick={() => handleDownloadInvoice(invoice.id)}
                                            >
                                                <Download className="w-4 h-4 mr-1" />
                                                Descargar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}

