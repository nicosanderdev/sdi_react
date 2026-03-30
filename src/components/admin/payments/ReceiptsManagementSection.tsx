import { useState } from 'react';
import { Alert, Badge, Button, Card, Spinner, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { AdminReceiptRow } from '../../../services/PaymentsAdminService';
import { ReceiptDetailsModal } from './ReceiptDetailsModal';

interface Props {
  receipts: AdminReceiptRow[];
  loading: boolean;
  error: string | null;
  updatingReceiptId: string | null;
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
  if (status === 1) return <Badge color="success">Paid</Badge>;
  return <Badge color="warning">Unpaid</Badge>;
}

export function ReceiptsManagementSection({
  receipts,
  loading,
  error,
  updatingReceiptId,
  onRefresh,
  onUpdateStatus
}: Props) {
  const [selectedReceipt, setSelectedReceipt] = useState<AdminReceiptRow | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gestiona recibos ya generados y su estado de pago.
          </p>
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
            <span>Cargando recibos...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableHeadCell>ID de recibo</TableHeadCell>
                <TableHeadCell>Propietario</TableHeadCell>
                <TableHeadCell>Monto total</TableHeadCell>
                <TableHeadCell>Ítems</TableHeadCell>
                <TableHeadCell>Fecha de creación</TableHeadCell>
                <TableHeadCell>Estado de pago</TableHeadCell>
                <TableHeadCell>Acciones</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron recibos.
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
                          <Button size="xs" color="light" onClick={() => setSelectedReceipt(receipt)}>
                            Ver detalle
                          </Button>
                          {receipt.status === 1 ? (
                            <Button
                              size="xs"
                              color="warning"
                              disabled={updatingReceiptId === receipt.id}
                              onClick={() => onUpdateStatus(receipt.id, false)}
                            >
                              Mark Unpaid
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              color="success"
                              disabled={updatingReceiptId === receipt.id}
                              onClick={() => onUpdateStatus(receipt.id, true)}
                            >
                              Mark Paid
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
