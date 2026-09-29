import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  User,
  Mail,
  Phone,
  DollarSign,
  Calendar as CalendarIcon,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Ban,
  CheckSquare
} from 'lucide-react';
import { Button, Card, Label, TextInput, Textarea, Select, Modal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import BookingService, { BookingWithMember } from '../../../services/BookingService';
import BookingPaymentsService from '../../../services/BookingPaymentsService';
import BookingCancellationService from '../../../services/BookingCancellationService';
import { BookingStatus, Currency, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '../../../models/calendar/CalendarSync';
import { CancelBookingModal } from './CancelBookingModal';

const BOOKING_STATUS_ES: Record<BookingStatus, string> = {
  [BookingStatus.Pending]: 'Pendiente',
  [BookingStatus.Confirmed]: 'Confirmada',
  [BookingStatus.Cancelled]: 'Cancelada',
  [BookingStatus.Completed]: 'Completada',
  [BookingStatus.NoShow]: 'No se presentó'
};

const PAYMENT_STATUS_ES: Record<number, string> = {
  0: 'Sin pagar',
  1: 'Pagada',
  2: 'Pago parcial',
  3: 'Reembolso parcial',
  4: 'Reembolsada'
};

const REFUND_STATUS_ES: Record<number, string> = {
  0: 'No aplica',
  1: 'Reembolso pendiente',
  2: 'Reembolso parcial',
  3: 'Reembolsada',
  4: 'Reembolso vencido'
};

interface BookingDetailsPanelProps {
  propertyId: string;
  selectedBooking: BookingWithMember | null;
  selectedDate: Date | null;
  availableBookings?: BookingWithMember[];
  onBookingChange: (booking: BookingWithMember) => void;
  onNewBooking: (booking: BookingWithMember) => void;
  onBookingDelete: (bookingId: string) => void;
  onBookingSelect?: (booking: BookingWithMember) => void;
  onCancel: () => void;
}

const BookingDetailsPanel: React.FC<BookingDetailsPanelProps> = ({
  selectedBooking,
  selectedDate,
  availableBookings = [],
  onBookingChange,
  onBookingSelect,
  onCancel
}) => {
  const [errors, setErrors] = useState<string[]>([]);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setErrors([]);
    setShowCancelModal(false);
    setShowPayModal(false);
    setShowRefundModal(false);
  }, [selectedBooking?.Id]);

  const reloadBooking = async (id: string) => {
    const result = await BookingService.getBookingById(id);
    if (result.succeeded && result.data) {
      onBookingChange(result.data);
    }
  };

  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (!selectedBooking) return;
    if (newStatus === BookingStatus.Cancelled) {
      setShowCancelModal(true);
      return;
    }
    try {
      const result = await BookingService.updateBooking(selectedBooking.Id, { status: newStatus });
      if (result.succeeded && result.data) {
        onBookingChange(result.data);
      } else {
        setErrors([result.errorMessage || 'Error al actualizar el estado']);
      }
    } catch (error: unknown) {
      setErrors([(error as Error).message || 'Error al actualizar el estado']);
    }
  };

  const getStatusDisplay = (status: BookingStatus) => {
    switch (status) {
      case BookingStatus.Confirmed:
        return { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' };
      case BookingStatus.Pending:
        return { icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
      case BookingStatus.Cancelled:
        return { icon: Ban, color: 'text-red-600', bgColor: 'bg-red-100' };
      case BookingStatus.Completed:
        return { icon: CheckSquare, color: 'text-blue-600', bgColor: 'bg-blue-100' };
      case BookingStatus.NoShow:
        return { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100' };
      default:
        return { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }
  };

  const recordPayment = async () => {
    if (!selectedBooking) return;
    const amount = parseFloat(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrors(['Ingresá un monto válido']);
      return;
    }
    setIsBusy(true);
    setErrors([]);
    try {
      await BookingPaymentsService.recordPayment({
        bookingId: selectedBooking.Id,
        amount,
        method: 'transfer',
        note: payNote || undefined,
      });
      await reloadBooking(selectedBooking.Id);
      setShowPayModal(false);
      setPayAmount('');
      setPayNote('');
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Error al registrar pago']);
    } finally {
      setIsBusy(false);
    }
  };

  const recordRefund = async () => {
    if (!selectedBooking) return;
    const amount = parseFloat(refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrors(['Ingresá un monto válido']);
      return;
    }
    setIsBusy(true);
    setErrors([]);
    try {
      await BookingPaymentsService.recordRefund({
        bookingId: selectedBooking.Id,
        amount,
        method: 'transfer',
        note: refundNote || undefined,
      });
      await reloadBooking(selectedBooking.Id);
      setShowRefundModal(false);
      setRefundAmount('');
      setRefundNote('');
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Error al registrar reembolso']);
    } finally {
      setIsBusy(false);
    }
  };

  if (selectedDate && availableBookings.length > 1 && !selectedBooking) {
    return (
      <Card>
        <div className="space-y-6">
          <h3 className="text-lg font-medium">
            Múltiples Reservas - {format(selectedDate, 'dd/MM/yyyy')}
          </h3>
          <div className="space-y-3">
            {availableBookings.map((booking) => {
              const isCheckIn =
                format(parseISO(booking.CheckInDate), 'yyyy-MM-dd') ===
                format(selectedDate, 'yyyy-MM-dd');
              const isCheckOut =
                format(parseISO(booking.CheckOutDate), 'yyyy-MM-dd') ===
                format(selectedDate, 'yyyy-MM-dd');
              const statusDisplay = getStatusDisplay(booking.Status);
              const StatusIcon = statusDisplay.icon;

              return (
                <div
                  key={booking.Id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => onBookingSelect?.(booking)}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium">
                      Reserva {isCheckIn ? '(Entrada)' : isCheckOut ? '(Salida)' : ''}
                    </span>
                    <div
                      className={`px-2 py-1 text-xs rounded-full flex items-center space-x-1 ${statusDisplay.bgColor}`}
                    >
                      <StatusIcon className={`h-3 w-3 ${statusDisplay.color}`} />
                      <span className={statusDisplay.color}>{BOOKING_STATUS_ES[booking.Status]}</span>
                    </div>
                  </div>
                  {booking.Guest && (
                    <div className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                      {booking.Guest.FirstName} {booking.Guest.LastName}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {format(parseISO(booking.CheckInDate), 'dd/MM/yyyy')} →{' '}
                    {format(parseISO(booking.CheckOutDate), 'dd/MM/yyyy')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    );
  }

  if (!selectedBooking) {
    return (
      <Card>
        <div className="text-center py-8">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-800 dark:text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Seleccionar fecha
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Elegí una fecha del calendario para ver reservas. Para bloquear fechas usá el modo de
            disponibilidad (no se crean reservas manuales).
          </p>
          <Button color="alternative" className="mt-4" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </Card>
    );
  }

  const StatusIcon = getStatusDisplay(selectedBooking.Status).icon;
  const paymentStatus = Number((selectedBooking as BookingWithMember & { PaymentStatus?: number }).PaymentStatus ?? 0);
  const refundStatus = Number((selectedBooking as BookingWithMember & { RefundStatus?: number }).RefundStatus ?? 0);
  const amountPaid = Number((selectedBooking as BookingWithMember & { AmountPaid?: number }).AmountPaid ?? 0);
  const canCancel =
    selectedBooking.Status === BookingStatus.Pending ||
    selectedBooking.Status === BookingStatus.Confirmed;
  const canRecordPayment =
    selectedBooking.Status === BookingStatus.Pending ||
    selectedBooking.Status === BookingStatus.Confirmed;
  const canRecordRefund =
    amountPaid > 0 &&
    (selectedBooking.Status === BookingStatus.Cancelled ||
      selectedBooking.Status === BookingStatus.Completed ||
      selectedBooking.Status === BookingStatus.NoShow ||
      refundStatus === 1 ||
      refundStatus === 2 ||
      refundStatus === 4);

  return (
    <>
      <Card>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Detalles de Reserva</h3>
            <Button size="sm" color="alternative" onClick={onCancel}>
              Cerrar
            </Button>
          </div>

          {errors.length > 0 && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <ul className="list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${getStatusDisplay(selectedBooking.Status).bgColor}`}>
              <StatusIcon className={`h-5 w-5 ${getStatusDisplay(selectedBooking.Status).color}`} />
            </div>
            <div className="flex-1">
              <p className="font-medium">{BOOKING_STATUS_ES[selectedBooking.Status]}</p>
              {canCancel && (
                <Select
                  value={selectedBooking.Status.toString()}
                  onChange={(e) => handleStatusChange(parseInt(e.target.value, 10) as BookingStatus)}
                  className="mt-1"
                  sizing="sm"
                >
                  <option value={BookingStatus.Pending}>{BOOKING_STATUS_ES[BookingStatus.Pending]}</option>
                  <option value={BookingStatus.Confirmed}>
                    {BOOKING_STATUS_ES[BookingStatus.Confirmed]}
                  </option>
                  <option value={BookingStatus.Cancelled}>
                    {BOOKING_STATUS_ES[BookingStatus.Cancelled]}
                  </option>
                  <option value={BookingStatus.Completed}>
                    {BOOKING_STATUS_ES[BookingStatus.Completed]}
                  </option>
                  <option value={BookingStatus.NoShow}>{BOOKING_STATUS_ES[BookingStatus.NoShow]}</option>
                </Select>
              )}
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Entrada</Label>
                <p>{format(parseISO(selectedBooking.CheckInDate), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <Label>Salida</Label>
                <p>{format(parseISO(selectedBooking.CheckOutDate), 'dd/MM/yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span>{selectedBooking.GuestCount} huésped(es)</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-500" />
              <span>
                Total: {CURRENCY_SYMBOLS[selectedBooking.Currency]}{' '}
                {(selectedBooking.TotalAmount ?? 0).toFixed(2)}{' '}
                {CURRENCY_NAMES[selectedBooking.Currency]}
              </span>
            </div>
            <p>
              Pagado: {CURRENCY_SYMBOLS[selectedBooking.Currency]} {amountPaid.toFixed(2)} —{' '}
              {PAYMENT_STATUS_ES[paymentStatus] ?? '—'}
            </p>
            {selectedBooking.Status === BookingStatus.Cancelled && (
              <p>Reembolso: {REFUND_STATUS_ES[refundStatus] ?? '—'}</p>
            )}
            {selectedBooking.Notes && (
              <p className="text-gray-600 dark:text-gray-400">{selectedBooking.Notes}</p>
            )}
          </div>

          {selectedBooking.Guest && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Huésped
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  <span>
                    {selectedBooking.Guest.FirstName} {selectedBooking.Guest.LastName}
                  </span>
                </div>
                {selectedBooking.Guest.Email && (
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{selectedBooking.Guest.Email}</span>
                  </div>
                )}
                {selectedBooking.Guest.Phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{selectedBooking.Guest.Phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {canCancel && (
              <Button color="failure" size="sm" onClick={() => setShowCancelModal(true)}>
                Cancelar reserva
              </Button>
            )}
            {canRecordPayment && (
              <Button color="green" size="sm" onClick={() => setShowPayModal(true)}>
                Registrar pago
              </Button>
            )}
            {canRecordRefund && (
              <Button color="alternative" size="sm" onClick={() => setShowRefundModal(true)}>
                Registrar reembolso
              </Button>
            )}
          </div>
        </div>
      </Card>

      <CancelBookingModal
        open={showCancelModal}
        bookingId={selectedBooking.Id}
        onClose={() => setShowCancelModal(false)}
        onCancelled={async () => {
          try {
            await BookingCancellationService.handlePostCancellation({
              bookingId: selectedBooking.Id,
              estatePropertyId: selectedBooking.EstatePropertyId,
              checkInDate: selectedBooking.CheckInDate,
              checkOutDate: selectedBooking.CheckOutDate,
              guestEmail: selectedBooking.Guest?.Email,
              guestPhone: selectedBooking.Guest?.Phone,
            });
          } catch (e) {
            console.warn('Cancellation email failed', e);
          }
          await reloadBooking(selectedBooking.Id);
        }}
      />

      <Modal show={showPayModal} onClose={() => setShowPayModal(false)}>
        <ModalHeader>Registrar pago</ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            <div>
              <Label htmlFor="payAmount">Monto</Label>
              <TextInput
                id="payAmount"
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="payNote">Nota (opcional)</Label>
              <Textarea
                id="payNote"
                rows={2}
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="alternative" onClick={() => setShowPayModal(false)}>
            Volver
          </Button>
          <Button color="green" onClick={recordPayment} disabled={isBusy}>
            Guardar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal show={showRefundModal} onClose={() => setShowRefundModal(false)}>
        <ModalHeader>Registrar reembolso</ModalHeader>
        <ModalBody>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Registrá el reembolso que hiciste fuera de la plataforma (transferencia, Mercado Pago,
              etc.). Máximo pagado: {amountPaid.toFixed(2)}.
            </p>
            <div>
              <Label htmlFor="refundAmount">Monto</Label>
              <TextInput
                id="refundAmount"
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="refundNote">Referencia / nota</Label>
              <Textarea
                id="refundNote"
                rows={2}
                value={refundNote}
                onChange={(e) => setRefundNote(e.target.value)}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="alternative" onClick={() => setShowRefundModal(false)}>
            Volver
          </Button>
          <Button onClick={recordRefund} disabled={isBusy}>
            Guardar
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default BookingDetailsPanel;
