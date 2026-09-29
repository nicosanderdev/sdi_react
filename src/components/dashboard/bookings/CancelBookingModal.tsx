import { useEffect, useState } from 'react';
import { Alert, Button, Label, Modal, ModalBody, ModalFooter, ModalHeader, Textarea } from 'flowbite-react';
import BookingPaymentsService, {
  type CancellationPreview,
} from '../../../services/BookingPaymentsService';
import { CancellationPolicyService } from '../../../services/CancellationPolicyService';

interface CancelBookingModalProps {
  open: boolean;
  bookingId: string;
  onClose: () => void;
  onCancelled: () => void;
}

export function CancelBookingModal({
  open,
  bookingId,
  onClose,
  onCancelled,
}: CancelBookingModalProps) {
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !bookingId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setPreview(null);
      try {
        const p = await BookingPaymentsService.previewCancellation(bookingId, 'host');
        if (!cancelled) setPreview(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al previsualizar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  const submit = async () => {
    if (!preview?.canCancel) return;
    if (!reason.trim()) {
      setError('Indicá el motivo de la cancelación.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await BookingPaymentsService.cancelAsHost(bookingId, reason.trim(), preview.previewHash);
      onCancelled();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={open} onClose={onClose} size="lg">
      <ModalHeader>Cancelar reserva</ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <Alert color="warning">
            Esta acción no se puede deshacer. La reserva quedará cancelada y las fechas se liberarán.
          </Alert>

          {loading && <p className="text-sm text-gray-600">Calculando política aplicable…</p>}
          {error && <Alert color="failure">{error}</Alert>}

          {preview && (
            <div className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
              {!preview.canCancel && (
                <Alert color="failure">{preview.message || 'No se puede cancelar esta reserva.'}</Alert>
              )}
              <p>
                <strong>Tipo:</strong> cancelación del anfitrión (reembolso 100% de lo pagado).
              </p>
              {preview.policySnapshot && (
                <p>
                  <strong>Política de la reserva:</strong>{' '}
                  {CancellationPolicyService.summarizeEs(preview.policySnapshot)}
                </p>
              )}
              <p>
                <strong>Pagado:</strong> {preview.amountPaid.toFixed(2)}
              </p>
              <p>
                <strong>Reembolso a registrar:</strong> {preview.refundAmount.toFixed(2)} (
                {preview.refundPercent}%)
              </p>
              {preview.refundDueAt && (
                <p>
                  <strong>Plazo para registrar el reembolso:</strong>{' '}
                  {new Date(preview.refundDueAt).toLocaleString('es-UY')}
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="cancelReason">Motivo (obligatorio)</Label>
            <Textarea
              id="cancelReason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: mantenimiento imprevisto, error de calendario…"
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="alternative" onClick={onClose} disabled={submitting}>
          Volver
        </Button>
        <Button
          color="failure"
          onClick={submit}
          disabled={submitting || loading || !preview?.canCancel}
        >
          {submitting ? 'Cancelando…' : 'Confirmar cancelación'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
