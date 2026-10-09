import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Label, Select, TextInput } from 'flowbite-react';
import BookingPaymentsService from '../../../services/BookingPaymentsService';

const REFUND_STATUS_LABELS: Record<number, string> = {
  1: 'Pendiente',
  2: 'Parcial',
  3: 'Completo',
  4: 'Vencido',
};

export function BookingRefundsComplianceSection() {
  const [ownerSearch, setOwnerSearch] = useState('');
  const [refundStatus, setRefundStatus] = useState<string>('');
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await BookingPaymentsService.adminListRefunds({
        ownerSearch: ownerSearch.trim() || undefined,
        refundStatus: refundStatus ? Number(refundStatus) : null,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [ownerSearch, refundStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4" data-testid="booking-refunds-compliance">
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Seguimiento de reembolsos de reservas canceladas (si el anfitrión registró la devolución).
      </p>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <Label htmlFor="refundOwner">Propietario</Label>
          <TextInput
            id="refundOwner"
            value={ownerSearch}
            onChange={(e) => setOwnerSearch(e.target.value)}
            placeholder="Email o nombre"
          />
        </div>
        <div>
          <Label htmlFor="refundStatus">Estado</Label>
          <Select
            id="refundStatus"
            value={refundStatus}
            onChange={(e) => setRefundStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="1">Pendiente</option>
            <option value="2">Parcial</option>
            <option value="3">Completo</option>
            <option value="4">Vencido</option>
          </Select>
        </div>
        <Button onClick={() => void load()} disabled={loading}>
          {loading ? 'Cargando…' : 'Filtrar'}
        </Button>
      </div>

      {error && <Alert color="failure">{error}</Alert>}

      <p className="text-sm text-gray-500">{total} resultado(s)</p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-3">Reserva</th>
              <th className="py-2 pr-3">Propiedad</th>
              <th className="py-2 pr-3">Propietario</th>
              <th className="py-2 pr-3">Pagado</th>
              <th className="py-2 pr-3">Reembolsado</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3">Vence</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const status = Number(row.refund_status ?? 0);
              return (
                <tr key={String(row.booking_id)} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2 pr-3 font-mono text-xs">{String(row.reservation_code ?? '')}</td>
                  <td className="py-2 pr-3">{String(row.property_title ?? '')}</td>
                  <td className="py-2 pr-3">
                    <div>{String(row.owner_name ?? '')}</div>
                    <div className="text-xs text-gray-500">{String(row.owner_email ?? '')}</div>
                  </td>
                  <td className="py-2 pr-3">{Number(row.amount_paid ?? 0).toFixed(2)}</td>
                  <td className="py-2 pr-3">{Number(row.amount_refunded ?? 0).toFixed(2)}</td>
                  <td className="py-2 pr-3">{REFUND_STATUS_LABELS[status] ?? status}</td>
                  <td className="py-2 pr-3">
                    {row.refund_due_at
                      ? new Date(String(row.refund_due_at)).toLocaleDateString('es-UY')
                      : '—'}
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500">
                  Sin reembolsos para mostrar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
