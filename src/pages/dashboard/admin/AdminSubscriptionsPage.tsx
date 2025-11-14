import React, { useEffect, useState } from 'react';
import { Card, Button, Spinner, Badge, Table, Select, Label, TableHead, TableHeadCell, TableBody, TableCell, TableRow } from 'flowbite-react';
import { 
    Crown,
    Search,
    Filter,
    RefreshCw,
    Eye
} from 'lucide-react';
import subscriptionService from '../../../services/SubscriptionService';
import { SubscriptionData } from '../../../models/subscriptions/SubscriptionData';

export function AdminSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
    const [filteredSubscriptions, setFilteredSubscriptions] = useState<SubscriptionData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [overdueFilter, setOverdueFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [subscriptions, statusFilter, overdueFilter, searchTerm]);

    const fetchSubscriptions = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const filters: any = {};
            if (statusFilter !== 'all') filters.status = statusFilter;
            if (overdueFilter === 'true') filters.overdue = true;
            if (overdueFilter === 'false') filters.overdue = false;

            const data = await subscriptionService.getAdminSubscriptions(filters);
            setSubscriptions(data);
        } catch (err: any) {
            setError(err.message || 'Error al cargar las suscripciones');
        } finally {
            setIsLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...subscriptions];

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(sub => sub.status === statusFilter);
        }

        // Overdue filter
        if (overdueFilter === 'true') {
            const now = new Date();
            filtered = filtered.filter(sub => {
                const endDate = new Date(sub.currentPeriodEnd);
                return endDate < now && sub.status === 'active';
            });
        } else if (overdueFilter === 'false') {
            const now = new Date();
            filtered = filtered.filter(sub => {
                const endDate = new Date(sub.currentPeriodEnd);
                return endDate >= now || sub.status !== 'active';
            });
        }

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(sub =>
                sub.ownerId.toLowerCase().includes(term) ||
                sub.plan.name.toLowerCase().includes(term) ||
                sub.providerSubscriptionId?.toLowerCase().includes(term)
            );
        }

        setFilteredSubscriptions(filtered);
    };

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active':
                return <Badge color="success">Activa</Badge>;
            case 'canceled':
            case 'cancelled':
                return <Badge color="failure">Cancelada</Badge>;
            case 'expired':
                return <Badge color="gray">Expirada</Badge>;
            case 'pending':
                return <Badge color="warning">Pendiente</Badge>;
            default:
                return <Badge color="gray">{status}</Badge>;
        }
    };

    const isOverdue = (subscription: SubscriptionData) => {
        const now = new Date();
        const endDate = new Date(subscription.currentPeriodEnd);
        return endDate < now && subscription.status === 'active';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="xl" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Gestión de Suscripciones</h1>
                        <p>Administra todas las suscripciones de la plataforma</p>
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
                                placeholder="Buscar por ID, plan..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full rounded-lg border-gray-300"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="status">Estado</Label>
                        <Select
                            id="status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos</option>
                            <option value="active">Activas</option>
                            <option value="canceled">Canceladas</option>
                            <option value="expired">Expiradas</option>
                            <option value="pending">Pendientes</option>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="overdue">Vencidas</Label>
                        <Select
                            id="overdue"
                            value={overdueFilter}
                            onChange={(e) => setOverdueFilter(e.target.value)}
                        >
                            <option value="all">Todas</option>
                            <option value="true">Vencidas</option>
                            <option value="false">No Vencidas</option>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button
                            onClick={fetchSubscriptions}
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
                    <div className="text-sm text-gray-600 mb-1">Total Suscripciones</div>
                    <div className="text-2xl font-bold">{subscriptions.length}</div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-600 mb-1">Activas</div>
                    <div className="text-2xl font-bold text-green-600">
                        {subscriptions.filter(s => s.status === 'active').length}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-600 mb-1">Canceladas</div>
                    <div className="text-2xl font-bold text-red-600">
                        {subscriptions.filter(s => s.status === 'canceled' || s.status === 'cancelled').length}
                    </div>
                </Card>
                <Card>
                    <div className="text-sm text-gray-600 mb-1">Vencidas</div>
                    <div className="text-2xl font-bold text-orange-600">
                        {subscriptions.filter(isOverdue).length}
                    </div>
                </Card>
            </div>

            {/* Subscriptions Table */}
            <Card>
                <div className="overflow-x-auto">
                    <Table hoverable>
                        <TableHead>
                            <TableHeadCell>Propietario</TableHeadCell>
                            <TableHeadCell>Plan</TableHeadCell>
                            <TableHeadCell>Estado</TableHeadCell>
                            <TableHeadCell>Renovación</TableHeadCell>
                            <TableHeadCell>Precio</TableHeadCell>
                            <TableHeadCell>Acciones</TableHeadCell>
                        </TableHead>
                        <TableBody className="divide-y">
                            {filteredSubscriptions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        No se encontraron suscripciones
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSubscriptions.map((subscription) => (
                                    <TableRow
                                        key={subscription.id}
                                        className={isOverdue(subscription) ? 'bg-red-50' : ''}
                                    >
                                        <TableCell>
                                            <div>
                                                <div className="font-medium">{subscription.ownerType}</div>
                                                <div className="text-sm text-gray-500">{subscription.ownerId}</div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{subscription.plan.name}</div>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(subscription.status)}
                                            {isOverdue(subscription) && (
                                                <Badge color="failure" className="ml-2">Vencida</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
                                        </TableCell>
                                        <TableCell>
                                            €{subscription.plan.monthlyPrice}/{subscription.plan.billingCycle}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                size="xs"
                                                color="gray"
                                                onClick={() => {
                                                    // Navigate to company/user subscription page
                                                    if (subscription.ownerType === 'Company') {
                                                        window.location.href = `/company/${subscription.ownerId}/subscription`;
                                                    } else {
                                                        window.location.href = `/dashboard/subscription`;
                                                    }
                                                }}
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                Ver
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

