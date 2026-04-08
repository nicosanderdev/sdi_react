import { useState } from 'react';
import { Alert, Badge, Button, Card, Label, Select, Spinner, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, TextInput } from 'flowbite-react';
import { Search } from 'lucide-react';
import { AdminReceiptRow, ReceiptFilterStatus } from '../../../services/PaymentsAdminService';
import { ReceiptDetailsModal } from './ReceiptDetailsModal';

interface Props {
  receipts: AdminReceiptRow[];
  ownerName: string;
  ownerEmail: string;
  dueDateFrom: string;
  dueDateTo: string;
  status: ReceiptFilterStatus;
  loading: boolean;
  error: string | null;
  updatingReceiptId: string | null;
  onChangeFilter: (patch: Partial<{
    ownerName: string;
    ownerEmail: string;
    dueDateFrom: string;
    dueDateTo: string;
    status: ReceiptFilterStatus;
  }>) => void;
  onResetFilters: () => void;
  onApplyFilters: () => void;
  onRefresh: () => void;
  onUpdateStatus: (receiptId: string, isPaid: boolean) => Promise<void>;
}

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
}

function statusBadge(status: number) {
  if (status === 1) return <Badge color="success">Pagada</Badge>;
  return <Badge color="warning">No pagada</Badge>;
}

export function ReceiptsManagementSection({
  receipts,
  ownerName,
  ownerEmail,
  dueDateFrom,
  dueDateTo,
  status,
  loading,
  error,
  updatingReceiptId,
  onChangeFilter,
  onResetFilters,
  onApplyFilters,
  onRefresh,
  onUpdateStatus
}: Props) {
  const [selectedReceipt, setSelectedReceipt] = useState<AdminReceiptRow | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="receipts-owner-name-filter">Nombre del propietario</Label>
            <TextInput
              id="receipts-owner-name-filter"
              icon={Search}
              placeholder="Nombre del propietario"
              value={ownerName}
              onChange={(event) => onChangeFilter({ ownerName: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="receipts-owner-email-filter">Email del propietario</Label>
            <TextInput
              id="receipts-owner-email-filter"
              placeholder="Email del propietario"
              value={ownerEmail}
              onChange={(event) => onChangeFilter({ ownerEmail: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="receipts-status-filter">Estado de factura</Label>
            <Select
              id="receipts-status-filter"
              value={status}
              onChange={(event) => onChangeFilter({ status: event.target.value as ReceiptFilterStatus })}
            >
              <option value="all">Todos</option>
              <option value="paid">Pagado</option>
              <option value="unpaid">Pendiente</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="receipts-due-date-from">Vence desde</Label>
            <TextInput
              id="receipts-due-date-from"
              type="date"
              value={dueDateFrom}
              onChange={(event) => onChangeFilter({ dueDateFrom: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="receipts-due-date-to">Vence hasta</Label>
            <TextInput
              id="receipts-due-date-to"
              type="date"
              value={dueDateTo}
              onChange={(event) => onChangeFilter({ dueDateTo: event.target.value })}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-4">
          <Button color="green" onClick={onApplyFilters}>
            Aplicar filtros
          </Button>
          <Button color="alternative" onClick={onResetFilters}>
            Limpiar
          </Button>
          <Button color="light" onClick={onRefresh}>
            Recargar
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
            <span>Cargando facturas...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableHeadCell>ID de factura</TableHeadCell>
                <TableHeadCell>Propietario</TableHeadCell>
                <TableHeadCell>Monto total</TableHeadCell>
                <TableHeadCell>Ítems</TableHeadCell>
                <TableHeadCell>Fecha de creación</TableHeadCell>
                <TableHeadCell>Estado de factura</TableHeadCell>
                <TableHeadCell>Acciones</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron facturas.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((receipt) => (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono text-xs">{receipt.id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{receipt.userName}</div>
                        <div className="text-xs text-gray-500">{receipt.userEmail || '—'}</div>
                      </TableCell>
                      <TableCell>{formatAmount(receipt.amount, receipt.currency)}</TableCell>
                      <TableCell>{receipt.itemCount}</TableCell>
                      <TableCell>{new Date(receipt.created).toLocaleDateString('es-UY')}</TableCell>
                      <TableCell>{statusBadge(receipt.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="xs" color="alternative" onClick={() => setSelectedReceipt(receipt)}>
                            Ver detalle
                          </Button>
                          {receipt.status === 1 ? (
                            <Button
                              size="xs"
                              color="red"
                              disabled={updatingReceiptId === receipt.id}
                              onClick={() => onUpdateStatus(receipt.id, false)}
                            >
                              Marcar como No Pagada
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              color="green"
                              disabled={updatingReceiptId === receipt.id}
                              onClick={() => onUpdateStatus(receipt.id, true)}
                            >
                              Marcar como Pagada
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ReceiptDetailsModal
        receipt={selectedReceipt}
        open={selectedReceipt !== null}
        onClose={() => setSelectedReceipt(null)}
      />
    </div>
  );
}
