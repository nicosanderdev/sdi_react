import { Badge, Modal, ModalBody, ModalHeader, Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from 'flowbite-react';
import { AdminReceiptRow } from '../../../services/PaymentsAdminService';

interface Props {
  receipt: AdminReceiptRow | null;
  open: boolean;
  onClose: () => void;
}

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
}

export function ReceiptDetailsModal({ receipt, open, onClose }: Props) {
  return (
    <Modal show={open} onClose={onClose} size="4xl">
      <ModalHeader>Detalle de recibo</ModalHeader>
      <ModalBody>
        {!receipt ? (
          <p className="text-sm text-gray-500">No receipt selected.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge color="info">{receipt.id}</Badge>
              <span className="text-sm text-gray-600">{receipt.userName}</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHead>
                  <TableHeadCell>Booking ID</TableHeadCell>
                  <TableHeadCell>Amount</TableHeadCell>
                  <TableHeadCell>Reference</TableHeadCell>
                </TableHead>
                <TableBody className="divide-y">
                  {receipt.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-gray-500">
                        No items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    receipt.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{item.bookingId}</TableCell>
                        <TableCell>{formatAmount(item.amount, receipt.currency)}</TableCell>
                        <TableCell>
                          {item.bookingCheckInDate} - {item.bookingCheckOutDate}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
