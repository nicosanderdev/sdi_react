import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, Datepicker, Spinner, Table } from 'flowbite-react';
import { Calendar, FileText } from 'lucide-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import { getLogsForDate, type AdminLogEntry, type AdminLogEventType } from '../../../services/AdminLogsService';

const EVENT_TYPE_LABELS: Record<AdminLogEventType, string> = {
  user: 'Usuario',
  property: 'Propiedad',
  booking: 'Reserva',
};

const ACTION_LABELS: Record<string, string> = {
  suspend: 'Suspender',
  reactivate: 'Reactivar',
  role_change: 'Cambio de rol',
  reset_onboarding: 'Reiniciar onboarding',
  force_logout: 'Cerrar sesión forzado',
  delete: 'Eliminar',
  hide: 'Ocultar',
  mark_invalid: 'Marcar inválido',
  mark_spam: 'Marcar spam',
  created: 'Creado',
  updated: 'Actualizado',
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function AdminLogsPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLogsForDate(date);
      setLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar los logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(selectedDate);
  }, [selectedDate, fetchLogs]);

  const handleDateChange = (date: Date | null) => {
    if (date) setSelectedDate(date);
  };

  return (
    <div className="space-y-6">
      <DashboardPageTitle title="Logs" />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ver logs del día:
            </span>
          </div>
          <Datepicker
            value={selectedDate}
            onChange={handleDateChange}
            placeholder="Seleccionar fecha"
            language="es-ES"
          />
        </div>
      </Card>

      {error && (
        <div className="p-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Eventos del {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 py-8 text-center">
            No hay eventos registrados para esta fecha.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>Hora</Table.HeadCell>
                <Table.HeadCell>Tipo</Table.HeadCell>
                <Table.HeadCell>Acción</Table.HeadCell>
                <Table.HeadCell>Objetivo</Table.HeadCell>
                <Table.HeadCell>Realizado por</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {logs.map((entry, index) => (
                  <Table.Row key={`${entry.at}-${entry.target_id}-${index}`}>
                    <Table.Cell className="whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {format(new Date(entry.at), 'HH:mm:ss')}
                    </Table.Cell>
                    <Table.Cell>{EVENT_TYPE_LABELS[entry.event_type] ?? entry.event_type}</Table.Cell>
                    <Table.Cell>{actionLabel(entry.action)}</Table.Cell>
                    <Table.Cell className="max-w-xs truncate" title={entry.target_display}>
                      {entry.target_display || '—'}
                    </Table.Cell>
                    <Table.Cell className="max-w-xs truncate" title={entry.performed_by_display}>
                      {entry.performed_by_display || '—'}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
