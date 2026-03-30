import { Alert, Badge, Button, Card, Label, Spinner, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TextInput, Select } from 'flowbite-react';
import { Search } from 'lucide-react';
import { AdminPaymentBookingRow, PaymentFilterStatus } from '../../../services/PaymentsAdminService';

interface Props {
  userSearch: string;
  paymentStatus: PaymentFilterStatus;
  fromDate: string;
  toDate: string;
  bookings: AdminPaymentBookingRow[];
  loading: boolean;
  error: string | null;
  totalToCollect: number;
  canGenerateReceipt: boolean;
  submittingReceipt: boolean;
  onChangeFilter: (patch: Partial<{ userSearch: string; paymentStatus: PaymentFilterStatus; fromDate: string; toDate: string }>) => void;
  onResetFilters: () => void;
  onApplyFilters: () => void;
  onGenerateReceipt: () => void;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
}

function renderPaymentStatus(status: number) {
  if (status === 1) {
    return <Badge color="success">Paid</Badge>;
  }
  return <Badge color="warning">Unpaid</Badge>;
}

export function BookingsReceiptGenerationSection(props: Props) {
  const {
    userSearch,
    paymentStatus,
    fromDate,
    toDate,
    bookings,
    loading,
    error,
    totalToCollect,
    canGenerateReceipt,
    submittingReceipt,
    onChangeFilter,
    onResetFilters,
    onApplyFilters,
    onGenerateReceipt
  } = props;

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <Label htmlFor="payments-user-search">Buscar propietario (requerido)</Label>
            <TextInput
              id="payments-user-search"
              icon={Search}
              placeholder="Nombre, email o identificador del propietario"
              value={userSearch}
              onChange={(event) => onChangeFilter({ userSearch: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="payments-status-filter">Estado de pago</Label>
            <Select
              id="payments-status-filter"
              value={paymentStatus}
              onChange={(event) => onChangeFilter({ paymentStatus: event.target.value as PaymentFilterStatus })}
            >
              <option value="all">Todos</option>
              <option value="paid">Pagado</option>
              <option value="unpaid">Pendiente</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="payments-date-from">Desde</Label>
            <TextInput
              id="payments-date-from"
              type="date"
              value={fromDate}
              onChange={(event) => onChangeFilter({ fromDate: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="payments-date-to">Hasta</Label>
            <TextInput
              id="payments-date-to"
              type="date"
              value={toDate}
              onChange={(event) => onChangeFilter({ toDate: event.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-4">
          <Button color="primary" onClick={onApplyFilters}>
            Aplicar filtros
          </Button>
          <Button color="light" onClick={onResetFilters}>
            Limpiar
          </Button>
        </div>
      </Card>

      {error && (
        <Alert color="failure">
          <span className="font-medium">Error:</span> {error}
        </Alert>
      )}

      <Card>
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Spinner size="md" />
            <span>Cargando reservas...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableHeadCell>ID de reserva</TableHeadCell>
                <TableHeadCell>Propietario</TableHeadCell>
                <TableHeadCell>Propiedad / Espacio</TableHeadCell>
                <TableHeadCell>Fechas</TableHeadCell>
                <TableHeadCell>Monto total</TableHeadCell>
                <TableHeadCell>Estado de pago</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No bookings found with current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-mono text-xs">{booking.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{booking.userName}</div>
                        <div className="text-xs text-gray-500">{booking.userEmail || booking.userIdentifier || '—'}</div>
                      </TableCell>
                      <TableCell>{booking.propertyName}</TableCell>
                      <TableCell>
                        {booking.checkInDate} - {booking.checkOutDate}
                      </TableCell>
                      <TableCell>{formatAmount(booking.totalAmount)}</TableCell>
                      <TableCell>{renderPaymentStatus(booking.paymentStatus)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="pt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            Monto total a cobrar: <span className="text-primary-700 dark:text-primary-400">{formatAmount(totalToCollect)}</span>
          </p>
          <Button
            color="green"
            disabled={!canGenerateReceipt || submittingReceipt}
            onClick={onGenerateReceipt}
          >
            {submittingReceipt ? 'Generando...' : 'Generar recibo'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
