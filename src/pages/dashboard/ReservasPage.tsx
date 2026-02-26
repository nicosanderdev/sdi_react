import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Users
} from 'lucide-react';
import { Button, Card, Spinner, Alert, Badge } from 'flowbite-react';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import BookingService, {
  BookingWithMemberAndProperty
} from '../../services/BookingService';
import { BookingStatus, BOOKING_STATUS_NAMES, CURRENCY_SYMBOLS, Currency } from '../../models/calendar/CalendarSync';
import { useEnsureReceiptsAndBlock } from '../../hooks/useEnsureReceiptsAndBlock';

const today = () => format(new Date(), 'yyyy-MM-dd');

function splitBookings(bookings: BookingWithMemberAndProperty[]) {
  const pending: BookingWithMemberAndProperty[] = [];
  const current: BookingWithMemberAndProperty[] = [];
  const past: BookingWithMemberAndProperty[] = [];
  const todayStr = today();

  for (const b of bookings) {
    if (b.Status === BookingStatus.Pending) {
      pending.push(b);
    } else if (b.CheckOutDate < todayStr) {
      past.push(b);
    } else if (b.Status === BookingStatus.Confirmed) {
      current.push(b);
    }
    // Cancelled/other future bookings not shown in "current" (only confirmed upcoming)
  }

  return { pending, current, past };
}

function BookingRow({
  booking,
  onAccept,
  onReject,
  showActions
}: {
  booking: BookingWithMemberAndProperty;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  showActions: boolean;
}) {
  const guest = booking.Guest;
  const guestName = guest
    ? [guest.FirstName, guest.LastName].filter(Boolean).join(' ') || '—'
    : '—';
  const currencySym =
    CURRENCY_SYMBOLS[booking.Currency as Currency] ?? '';
  const amount =
    booking.TotalAmount != null
      ? `${currencySym} ${Number(booking.TotalAmount).toLocaleString()}`
      : '—';

  return (
    <Card className="mb-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/dashboard/property/${booking.EstatePropertyId}/bookings`}
              className="font-medium text-green-700 dark:text-green-400 hover:underline flex items-center gap-1"
            >
              <Building2 className="h-4 w-4 flex-shrink-0" />
              {booking.EstateProperty?.Title ?? 'Propiedad'}
            </Link>
            <Badge color={booking.Status === BookingStatus.Pending ? 'warning' : booking.Status === BookingStatus.Confirmed ? 'success' : 'failure'}>
              {BOOKING_STATUS_NAMES[booking.Status as BookingStatus]}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <CalendarCheck className="h-4 w-4" />
              {format(parseISO(booking.CheckInDate), 'd MMM yyyy', { locale: es })} –{' '}
              {format(parseISO(booking.CheckOutDate), 'd MMM yyyy', { locale: es })}
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
              {guestName}
            </span>
            {guest?.Email && (
              <a
                href={`mailto:${guest.Email}`}
                className="flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
              >
                <Mail className="h-4 w-4" />
                {guest.Email}
              </a>
            )}
            {guest?.Phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {guest.Phone}
              </span>
            )}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2 flex-shrink-0">
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
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ReservasPage() {
  const [bookings, setBookings] = useState<BookingWithMemberAndProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // On-demand receipt creation and property block (no cron)
  useEnsureReceiptsAndBlock();

  const fetchBookings = useCallback(async () => {
    setError(null);
    const res = await BookingService.getOwnerBookings();
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

  const { pending, current, past } = useMemo(
    () => splitBookings(bookings),
    [bookings]
  );

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
      } else {
        setError(res.errorMessage ?? 'Error al aceptar la reserva');
      }
    },
    []
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
      } else {
        setError(res.errorMessage ?? 'Error al rechazar la reserva');
      }
    },
    []
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
        <DashboardPageTitle title="Reservas" />
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
    <div className="space-y-6">
      <DashboardPageTitle
        title="Reservas"
        subtitle="Gestiona las reservas de tus propiedades"
      />

      {error && (
        <Alert color="failure" onDismiss={() => setError(null)}>
          <span className="font-medium">Error:</span> {error}
        </Alert>
      )}

      {/* Pendientes */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Pendientes
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Reservas enviadas por usuarios que puedes aceptar o rechazar.
        </p>
        {pending.length === 0 ? (
          <Card>
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No hay reservas pendientes.
            </p>
          </Card>
        ) : (
          pending.map((b) => (
            <BookingRow
              key={b.Id}
              booking={b}
              onAccept={handleAccept}
              onReject={handleReject}
              showActions={true}
            />
          ))
        )}
      </section>

      {/* Próximas / Actuales */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Próximas / Actuales
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Reservas aceptadas que aún no han terminado.
        </p>
        {current.length === 0 ? (
          <Card>
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No hay reservas próximas o en curso.
            </p>
          </Card>
        ) : (
          current.map((b) => (
            <BookingRow
              key={b.Id}
              booking={b}
              onAccept={handleAccept}
              onReject={handleReject}
              showActions={false}
            />
          ))
        )}
      </section>

      {/* Pasadas */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Pasadas
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Historial de reservas ya finalizadas (aceptadas o rechazadas).
        </p>
        {past.length === 0 ? (
          <Card>
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No hay reservas pasadas.
            </p>
          </Card>
        ) : (
          past.map((b) => (
            <BookingRow
              key={b.Id}
              booking={b}
              onAccept={handleAccept}
              onReject={handleReject}
              showActions={false}
            />
          ))
        )}
      </section>

      {actionId && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <Spinner size="xl" />
        </div>
      )}
    </div>
  );
}
