import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarCheck, User } from 'lucide-react';
import BookingService, { BookingWithMemberAndProperty } from '../../services/BookingService';
import { BookingStatus, CURRENCY_SYMBOLS, Currency } from '../../models/calendar/CalendarSync';

const PENDING_LIMIT = 5;

function formatGuestName(booking: BookingWithMemberAndProperty): string {
  const guest = booking.Guest;
  if (!guest) return '—';
  const name = [guest.FirstName, guest.LastName].filter(Boolean).join(' ');
  return name || '—';
}

function formatAmount(booking: BookingWithMemberAndProperty): string {
  const sym = CURRENCY_SYMBOLS[booking.Currency as Currency] ?? '';
  if (booking.TotalAmount == null) return '';
  return `${sym} ${Number(booking.TotalAmount).toLocaleString()}`;
}

export function PendingBookingsCard() {
  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: ['ownerBookings'],
    queryFn: () => BookingService.getOwnerBookings(),
  });

  const allBookings = response?.succeeded ? response.data ?? [] : [];
  const pendingBookings = allBookings
    .filter((b) => b.Status === BookingStatus.Pending)
    .slice(0, PENDING_LIMIT);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Reservas pendientes</h3>
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">Cargando...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Reservas pendientes</h3>
        <p className="text-red-500 dark:text-red-400 text-center py-4">
          Error al cargar reservas: {error?.message ?? 'Error desconocido'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Reservas pendientes</h3>
        <Link
          to="/dashboard/bookings"
          className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
        >
          Ver todas →
        </Link>
      </div>

      {pendingBookings.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay reservas pendientes.</p>
      )}

      <div className="space-y-4">
        {pendingBookings.map((booking) => {
          const guestName = formatGuestName(booking);
          const propertyTitle = booking.EstateProperty?.Title ?? 'Propiedad';
          const amount = formatAmount(booking);
          return (
            <Link
              key={booking.Id}
              to="/dashboard/bookings"
              className="block p-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-green-200 dark:hover:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            >
              <div className="flex items-start">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mr-3 flex-shrink-0">
                  <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate" title={guestName}>
                      {guestName}
                    </h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1" title={propertyTitle}>
                    {propertyTitle}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <CalendarCheck className="h-3.5 w-3.5 flex-shrink-0" />
                    {format(parseISO(booking.CheckInDate), 'd MMM yyyy', { locale: es })} –{' '}
                    {format(parseISO(booking.CheckOutDate), 'd MMM yyyy', { locale: es })}
                  </p>
                  {amount && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{amount}</p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
