import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  CalendarCheck,
  Check,
  X,
  User,
  Mail,
  Phone,
  Building2,
  Users,
  Search
} from 'lucide-react';
import {
  Button,
  Card,
  Spinner,
  Alert,
  Badge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextInput,
  Select
} from 'flowbite-react';
import DashboardPageTitle from '../../../components/dashboard/DashboardPageTitle';
import BookingService, {
  BookingWithMemberAndProperty
} from '../../../services/BookingService';
import { BookingStatus, BOOKING_STATUS_NAMES, CURRENCY_SYMBOLS, Currency } from '../../../models/calendar/CalendarSync';
import { useEnsureReceiptsAndBlock } from '../../../hooks/useEnsureReceiptsAndBlock';
import { AppDispatch, fetchNotificationCounts } from '../../../store';

const today = () => format(new Date(), 'yyyy-MM-dd');

function splitBookings(bookings: BookingWithMemberAndProperty[]) {
  const pending: BookingWithMemberAndProperty[] = [];
  const current: BookingWithMemberAndProperty[] = [];
  const past: BookingWithMemberAndProperty[] = [];
  const rejectedOrCancelled: BookingWithMemberAndProperty[] = [];
  const todayStr = today();

  for (const b of bookings) {
    if (b.Status === BookingStatus.Pending) {
      pending.push(b);
    } else if (b.Status === BookingStatus.Cancelled) {
      rejectedOrCancelled.push(b);
    } else if (b.CheckOutDate < todayStr) {
      past.push(b);
    } else if (b.Status === BookingStatus.Confirmed) {
      current.push(b);
    }
  }

  return { pending, current, past, rejectedOrCancelled };
}

function BookingRow({
  booking,
  onAccept,
  onReject,
  onCancel,
  showActions,
  showCancel,
  rowTestId
}: {
  booking: BookingWithMemberAndProperty;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCancel?: (id: string) => void;
  showActions: boolean;
  showCancel?: boolean;
  rowTestId?: string;
}) {
  const ownerDisplay = booking.PropertyOwnerDisplay;
  const ownerName = ownerDisplay?.name || '—';
  const currencySym =
    CURRENCY_SYMBOLS[booking.Currency as Currency] ?? '';
  const amount =
    booking.TotalAmount != null
      ? `${currencySym} ${Number(booking.TotalAmount).toLocaleString()}`
      : '—';

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-4 py-3"
      data-testid={rowTestId}
    >
      <div className="space-y-2 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/dashboard/property/${booking.EstatePropertyId}/bookings`}
            className="font-medium text-green-700 dark:text-green-400 hover:underline flex items-center gap-1"
          >
            <Building2 className="h-4 w-4 flex-shrink-0" />
            {booking.EstateProperty?.Title ?? 'Propiedad'}
          </Link>
          <Badge
            color={
              booking.Status === BookingStatus.Pending
                ? 'warning'
                : booking.Status === BookingStatus.Confirmed
                ? 'success'
                : 'failure'
            }
          >
            {BOOKING_STATUS_NAMES[booking.Status as BookingStatus]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <CalendarCheck className="h-4 w-4" />
            {format(parseISO(booking.CheckInDate), 'd MMM yyyy', {
              locale: es
            })}{' '}
            –{' '}
            {format(parseISO(booking.CheckOutDate), 'd MMM yyyy', {
              locale: es
            })}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {booking.GuestCount} huésped{booking.GuestCount !== 1 ? 'es' : ''}
          </span>
          {amount !== '—' && <span>{amount}</span>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {ownerName}
          </span>
          {ownerDisplay?.email && (
            <a
              href={`mailto:${ownerDisplay.email}`}
              className="flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
            >
              <Mail className="h-4 w-4" />
              {ownerDisplay.email}
            </a>
          )}
          {ownerDisplay?.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              {ownerDisplay.phone}
            </span>
          )}
        </div>
      </div>
      {(showActions || showCancel) && (
        <div className="flex gap-2 flex-shrink-0">
          {showActions && (
            <>
              <Button
                size="xs"
                color="success"
                onClick={() => onAccept(booking.Id)}
                className="flex items-center gap-1"
              >
                <Check className="h-4 w-4" />
                Aceptar
              </Button>
              <Button
                size="xs"
                color="failure"
                onClick={() => onReject(booking.Id)}
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Rechazar
              </Button>
            </>
          )}
          {showCancel && onCancel && (
            <Button
              size="xs"
              color="failure"
              onClick={() => onCancel(booking.Id)}
              className="flex items-center gap-1"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminBookingsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const [bookings, setBookings] = useState<BookingWithMemberAndProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ bookingId: string; action: 'reject' | 'cancel' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'current' | 'past' | 'rejected'>('all');

  useEnsureReceiptsAndBlock();

  const fetchBookings = useCallback(async () => {
    setError(null);
    const res = await BookingService.getAdminBookings();
    if (res.succeeded && res.data) {
      setBookings(res.data);
    } else {
      setError(res.errorMessage ?? 'Error al cargar las reservas');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bookings;

    return bookings.filter((booking) => {
      const ownerDisplay = booking.PropertyOwnerDisplay;
      const fields: string[] = [
        booking.EstateProperty?.Title ?? '',
        ownerDisplay?.name ?? '',
        ownerDisplay?.email ?? '',
        ownerDisplay?.phone ?? ''
      ];

      try {
        const checkIn = format(parseISO(booking.CheckInDate), 'd MMM yyyy', {
          locale: es
        });
        const checkOut = format(parseISO(booking.CheckOutDate), 'd MMM yyyy', {
          locale: es
        });
        fields.push(checkIn, checkOut);
      } catch {
        // ignore date parse errors for filtering
      }

      return fields.some((field) => field.toLowerCase().includes(query));
    });
  }, [bookings, searchQuery]);

  const { pending, current, past, rejectedOrCancelled } = useMemo(
    () => splitBookings(filteredBookings),
    [filteredBookings]
  );

  const totalVisibleBookings = useMemo(() => {
    if (statusFilter === 'all') {
      return (
        pending.length +
        current.length +
        past.length +
        rejectedOrCancelled.length
      );
    }
    if (statusFilter === 'pending') return pending.length;
    if (statusFilter === 'current') return current.length;
    if (statusFilter === 'past') return past.length;
    if (statusFilter === 'rejected') return rejectedOrCancelled.length;
    return 0;
  }, [statusFilter, pending.length, current.length, past.length, rejectedOrCancelled.length]);

  const handleAccept = useCallback(
    async (id: string) => {
      setActionId(id);
      const res = await BookingService.updateBooking(id, {
        status: BookingStatus.Confirmed
      });
      setActionId(null);
      if (res.succeeded) {
        const updated = res.data as BookingWithMemberAndProperty;
        setBookings((prev) =>
          prev.map((b) => (b.Id === id ? { ...b, ...updated } : b))
        );
        dispatch(fetchNotificationCounts());
      } else {
        setError(res.errorMessage ?? 'Error al aceptar la reserva');
      }
    },
    [dispatch]
  );

  const handleReject = useCallback(
    async (id: string) => {
      setActionId(id);
      const res = await BookingService.updateBooking(id, {
        status: BookingStatus.Cancelled
      });
      setActionId(null);
      if (res.succeeded) {
        const updated = res.data as BookingWithMemberAndProperty;
        setBookings((prev) =>
          prev.map((b) => (b.Id === id ? { ...b, ...updated } : b))
        );
        dispatch(fetchNotificationCounts());
      } else {
        setError(res.errorMessage ?? 'Error al rechazar la reserva');
      }
    },
    [dispatch]
  );

  const handleCancel = useCallback(
    async (id: string) => {
      setActionId(id);
      const res = await BookingService.updateBooking(id, {
        status: BookingStatus.Cancelled
      });
      setActionId(null);
      if (res.succeeded) {
        const updated = res.data as BookingWithMemberAndProperty;
        setBookings((prev) =>
          prev.map((b) => (b.Id === id ? { ...b, ...updated } : b))
        );
        dispatch(fetchNotificationCounts());
      } else {
        setError(res.errorMessage ?? 'Error al cancelar la reserva');
      }
    },
    [dispatch]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Spinner size="xl" />
        <span className="ml-2">Cargando reservas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardPageTitle title="Reservas (Administrador)" />
        <Card>
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="h-8 w-8 flex-shrink-0" />
            <div>
              <p className="font-medium">Error al cargar las reservas</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
          <Button color="primary" onClick={() => { setError(null); setIsLoading(true); fetchBookings(); }}>
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-bookings-page">
      <DashboardPageTitle title="Reservas (Administrador)" />

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <TextInput
            type="text"
            placeholder="Buscar por huésped, email o propiedad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={Search}
          />
        </div>
        <div className="flex items-center gap-3">
          <div data-testid="admin-bookings-status-filter">
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'pending' | 'current' | 'past' | 'rejected')
            }
          >
            <option value="all">Todas las reservas</option>
            <option value="pending">Pendientes</option>
            <option value="current">Próximas / Actuales</option>
            <option value="rejected">Rechazadas / Canceladas</option>
            <option value="past">Pasadas</option>
          </Select>
          </div>
          {(searchQuery.trim() !== '' || statusFilter !== 'all') && (
            <Button
              color="light"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
            >
              Limpiar filtros
            </Button>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Mostrando {totalVisibleBookings} reserva{totalVisibleBookings === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          <span className="font-medium">Error:</span> {error}
        </Alert>
      )}

      {(statusFilter === 'all' || statusFilter === 'pending') && (
        <section>
          <Card>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-50">
                  Pendientes
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Reservas enviadas por usuarios que puedes aceptar o rechazar.
                </p>
              </div>
              <Badge color="warning" className="self-start">
                {pending.length}
              </Badge>
            </div>
            {pending.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                No hay reservas pendientes.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {pending.map((b) => (
                  <BookingRow
                    key={b.Id}
                    booking={b}
                    rowTestId={`reservation-${b.Id}`}
                    onAccept={handleAccept}
                    onReject={(id) =>
                      setConfirmModal({ bookingId: id, action: 'reject' })
                    }
                    showActions={true}
                  />
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {(statusFilter === 'all' || statusFilter === 'current') && (
        <section>
          <Card>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-50">
                  Próximas / Actuales
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Reservas aceptadas que aún no han terminado.
                </p>
              </div>
              <Badge color="success" className="self-start">
                {current.length}
              </Badge>
            </div>
            {current.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                No hay reservas próximas o en curso.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {current.map((b) => (
                  <BookingRow
                    key={b.Id}
                    booking={b}
                    rowTestId={`reservation-${b.Id}`}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onCancel={(id) =>
                      setConfirmModal({ bookingId: id, action: 'cancel' })
                    }
                    showActions={false}
                    showCancel={true}
                  />
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {(statusFilter === 'all' || statusFilter === 'rejected') && (
        <section>
          <Card>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-50">
                  Rechazadas / Canceladas
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Reservas que rechazaste o cancelaste.
                </p>
              </div>
              <Badge color="failure" className="self-start">
                {rejectedOrCancelled.length}
              </Badge>
            </div>
            {rejectedOrCancelled.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                No hay reservas rechazadas o canceladas.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {rejectedOrCancelled.map((b) => (
                  <BookingRow
                    key={b.Id}
                    booking={b}
                    rowTestId={`reservation-${b.Id}`}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    showActions={false}
                  />
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {(statusFilter === 'all' || statusFilter === 'past') && (
        <section>
          <Card>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-50">
                  Pasadas
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Historial de reservas ya finalizadas (aceptadas o rechazadas).
                </p>
              </div>
              <Badge color="gray" className="self-start">
                {past.length}
              </Badge>
            </div>
            {past.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                No hay reservas pasadas.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {past.map((b) => (
                  <BookingRow
                    key={b.Id}
                    booking={b}
                    rowTestId={`reservation-${b.Id}`}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    showActions={false}
                  />
                ))}
              </div>
            )}
          </Card>
        </section>
      )}

      {actionId && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          data-testid="admin-bookings-action-overlay"
        >
          <Spinner size="xl" />
        </div>
      )}

      <Modal
        show={confirmModal !== null}
        onClose={() => setConfirmModal(null)}
        size="md"
      >
        <ModalHeader>
          {confirmModal?.action === 'reject' ? 'Rechazar reserva' : 'Cancelar reserva'}
        </ModalHeader>
        <ModalBody>
          <p className="text-gray-600 dark:text-gray-300 mx-auto text-center">
            Esta acción no se puede deshacer. El usuario que realizó la reserva será notificado.
          </p>
          <p className="text-gray-600 dark:text-gray-300 mt-2 mx-auto text-center">
            ¿Deseas continuar?
          </p>
        </ModalBody>
        <ModalFooter className='flex justify-center gap-2'  >
          <Button color="green" onClick={() => setConfirmModal(null)}>
            No, volver
          </Button>
          <Button
            color="red"
            data-testid="admin-bookings-modal-confirm"
            onClick={() => {
              if (!confirmModal) return;
              const { bookingId, action } = confirmModal;
              setConfirmModal(null);
              if (action === 'reject') handleReject(bookingId);
              else handleCancel(bookingId);
            }}
          >
            Sí, {confirmModal?.action === 'reject' ? 'rechazar' : 'cancelar'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
