import React, { useMemo } from 'react';
import Calendar from 'react-calendar';
import { format, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookingWithMember } from '../../../services/BookingService';
import { AvailabilityBlock, BlockType, SourceType } from '../../../models/calendar/CalendarSync';
import { AvailabilityUtils } from '../../../models/calendar/AvailabilityBlock';

interface BookingCalendarProps {
  bookings: BookingWithMember[];
  availabilityBlocks: AvailabilityBlock[];
  selectedDate: Date | null;
  selectedBooking: BookingWithMember | null;
  onSelect: (date: Date, booking?: BookingWithMember) => void;
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  bookings,
  availabilityBlocks,
  selectedDate,
  selectedBooking,
  onSelect
}) => {
  // Calculate tile content and styling for each date
  const tileData = useMemo(() => {
    const data: { [key: string]: {
      bookings: BookingWithMember[];
      blocks: AvailabilityBlock[];
      isAvailable: boolean;
      hasConflicts: boolean;
      bookingCount: number;
    } } = {};

    // Process bookings
    bookings.forEach(booking => {
      const checkIn = parseISO(booking.CheckInDate);
      const checkOut = parseISO(booking.CheckOutDate);

      // Add booking to each day in the range
      let current = new Date(checkIn);
      while (current <= checkOut) {
        const dateKey = format(current, 'yyyy-MM-dd');
        if (!data[dateKey]) {
          data[dateKey] = {
            bookings: [],
            blocks: [],
            isAvailable: true,
            hasConflicts: false,
            bookingCount: 0
          };
        }
        data[dateKey].bookings.push(booking);
        data[dateKey].bookingCount++;
        current.setDate(current.getDate() + 1);
      }
    });

    // Process availability blocks
    availabilityBlocks.forEach(block => {
      const startDate = parseISO(block.StartDate);
      const endDate = parseISO(block.EndDate);

      let current = new Date(startDate);
      while (current <= endDate) {
        const dateKey = format(current, 'yyyy-MM-dd');
        if (!data[dateKey]) {
          data[dateKey] = {
            bookings: [],
            blocks: [],
            isAvailable: true,
            hasConflicts: false,
            bookingCount: 0
          };
        }
        data[dateKey].blocks.push(block);

        // Update availability based on block type
        if (block.BlockType === BlockType.Booking ||
            block.BlockType === BlockType.OwnerBlock ||
            (block.BlockType === BlockType.ExternalBlock && !block.IsAvailable)) {
          data[dateKey].isAvailable = false;
        }

        if (block.ConflictFlagged) {
          data[dateKey].hasConflicts = true;
        }

        current.setDate(current.getDate() + 1);
      }
    });

    return data;
  }, [bookings, availabilityBlocks]);

  // Custom tile content
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return null;

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = tileData[dateKey];

    if (!dayData) return null;

    const { bookingCount, hasConflicts } = dayData;

    return (
      <div className="flex flex-col items-center justify-center h-full">
        {bookingCount > 0 && (
          <div className="text-xs font-semibold text-blue-600">
            {bookingCount}
          </div>
        )}
        {hasConflicts && (
          <div className="w-1 h-1 bg-red-500 rounded-full mt-1"></div>
        )}
      </div>
    );
  };

  // Custom tile class name for styling
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== 'month') return '';

    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = tileData[dateKey];

    const classes = ['relative'];

    if (!dayData) {
      classes.push('bg-white');
      return classes.join(' ');
    }

    const { isAvailable, hasConflicts, blocks } = dayData;

    // Selected date styling
    if (selectedDate && isSameDay(date, selectedDate)) {
      classes.push('ring-2 ring-blue-500 ring-inset');
    }

    // Conflict styling (highest priority)
    if (hasConflicts) {
      classes.push('bg-red-100 text-red-800');
      return classes.join(' ');
    }

    // Availability/block styling
    if (!isAvailable) {
      // Check block types for specific colors
      const hasBooking = blocks.some(b => b.BlockType === BlockType.Booking);
      const hasOwnerBlock = blocks.some(b => b.BlockType === BlockType.OwnerBlock);
      const hasExternalBlock = blocks.some(b => b.BlockType === BlockType.ExternalBlock);

      if (hasBooking) {
        classes.push('bg-blue-100 text-blue-800');
      } else if (hasOwnerBlock) {
        classes.push('bg-amber-100 text-amber-800');
      } else if (hasExternalBlock) {
        classes.push('bg-violet-100 text-violet-800');
      } else {
        classes.push('bg-gray-100 text-gray-800');
      }
    } else {
      classes.push('bg-white hover:bg-gray-50');
    }

    return classes.join(' ');
  };

  // Handle date click
  const handleDateClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = tileData[dateKey];

    // If there are bookings on this date, select the first one
    const booking = dayData?.bookings?.[0];
    onSelect(date, booking);
  };

  return (
    <div className="booking-calendar">
      <Calendar
        onClickDay={handleDateClick}
        tileContent={tileContent}
        tileClassName={tileClassName}
        value={selectedDate}
        locale="es-ES"
        className="w-full border-none"
        showNeighboringMonth={false}
        formatMonthYear={(locale, date) => format(date, 'MMMM yyyy', { locale: es })}
        formatShortWeekday={(locale, date) => format(date, 'EEEEEE', { locale: es })}
        prevLabel={<span>&lt;</span>}
        nextLabel={<span>&gt;</span>}
      />

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
          <span>Reservas</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-amber-100 border border-amber-200 rounded mr-2"></div>
          <span>Bloqueo Propietario</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-violet-100 border border-violet-200 rounded mr-2"></div>
          <span>Calendario Externo</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-2"></div>
          <span>Conflictos</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-white border border-gray-200 rounded mr-2"></div>
          <span>Disponible</span>
        </div>
      </div>

      {/* Selected booking info */}
      {selectedBooking && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900">Reserva Seleccionada</h4>
          <p className="text-sm text-blue-700">
            {selectedBooking.Guest?.FirstName} {selectedBooking.Guest?.LastName} - {selectedBooking.GuestCount} persona(s)
          </p>
          <p className="text-xs text-blue-600">
            {format(parseISO(selectedBooking.CheckInDate), 'dd/MM/yyyy')} - {format(parseISO(selectedBooking.CheckOutDate), 'dd/MM/yyyy')}
          </p>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;