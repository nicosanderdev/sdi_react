import React, { useMemo, useState, useCallback } from 'react';
import {
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  addMonths,
  subMonths,
  isBefore,
  startOfDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BookingWithMember } from '../../../services/BookingService';
import { AvailabilityBlock, BlockType, SourceType } from '../../../models/calendar/CalendarSync';
import { AvailabilityUtils } from '../../../models/calendar/AvailabilityBlock';

interface BookingCalendarProps {
  bookings: BookingWithMember[];
  availabilityBlocks: AvailabilityBlock[];
  selectedDate: Date | null;
  selectedBooking: BookingWithMember | null;
  onSelect: (date: Date, bookings: BookingWithMember[]) => void;
}

const BookingCalendar: React.FC<BookingCalendarProps> = ({
  bookings,
  availabilityBlocks,
  selectedDate,
  selectedBooking,
  onSelect
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredBookingIds, setHoveredBookingIds] = useState<Set<string>>(new Set());

  // Helper functions for date comparisons
  const today = startOfDay(new Date());
  const isPastDate = (date: Date) => isBefore(date, today);
  const isTodayDate = (date: Date) => isSameDay(date, new Date());

  // Calculate tile content and styling for each date
  const tileData = useMemo(() => {
    const data: { [key: string]: {
      bookings: BookingWithMember[];
      bookingIds: string[];
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
            bookingIds: [],
            blocks: [],
            isAvailable: true,
            hasConflicts: false,
            bookingCount: 0
          };
        }
        data[dateKey].bookings.push(booking);
        data[dateKey].bookingIds.push(booking.Id);
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
            bookingIds: [],
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

  // Hover handlers for group highlighting
  const handleDayMouseEnter = useCallback((dateKey: string) => {
    const dayData = tileData[dateKey];
    if (dayData?.bookingIds && dayData.bookingIds.length > 0) {
      setHoveredBookingIds(new Set(dayData.bookingIds));
    }
  }, [tileData]);

  const handleDayMouseLeave = useCallback(() => {
    setHoveredBookingIds(new Set());
  }, []);

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      days.push(new Date(day));
      day = addDays(day, 1);
    }

    return days;
  }, [currentMonth]);

  // Navigation functions
  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Handle date click
  const handleDateClick = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayData = tileData[dateKey];

    // Pass all bookings for this date to the parent
    const bookingsForDate = dayData?.bookings || [];
    onSelect(date, bookingsForDate);
  };

  // Get status indicators for a day
  const getStatusIndicators = (dateKey: string) => {
    const dayData = tileData[dateKey];
    if (!dayData) return [];

    const indicators = [];
    const { hasConflicts, blocks, bookings } = dayData;

    // Conflicts get highest priority (red)
    if (hasConflicts) {
      indicators.push('red');
    }

    // Check for bookings from the bookings array
    if (bookings.length > 0) {
      indicators.push('emerald');
    }

    // Check all block types for indicators (not just unavailable dates)
    const hasBooking = blocks.some(b => b.BlockType === BlockType.Booking);
    const hasOwnerBlock = blocks.some(b => b.BlockType === BlockType.OwnerBlock);
    const hasExternalBlock = blocks.some(b => b.BlockType === BlockType.ExternalBlock);

    if (hasBooking) {
      indicators.push('emerald');
    }
    if (hasOwnerBlock) {
      indicators.push('amber');
    }
    if (hasExternalBlock) {
      indicators.push('teal');
    }

    return indicators;
  };

  // Get color class for indicator
  const getIndicatorColorClass = (color: string) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-500';
      case 'amber': return 'bg-amber-500';
      case 'red': return 'bg-red-500';
      case 'teal': return 'bg-teal-500';
      default: return 'bg-gray-500';
    }
  };

  // Get subtle background tint for days with indicators
  const getBackgroundTint = (indicators: string[]) => {
    if (indicators.includes('red')) return 'bg-red-100/50 dark:bg-red-900/20 ring-2 ring-red-200 dark:ring-red-800';
    if (indicators.includes('amber')) return 'bg-amber-100/50 dark:bg-amber-900/20 ring-2 ring-amber-200 dark:ring-amber-800';
    if (indicators.includes('emerald')) return 'bg-emerald-100/50 dark:bg-emerald-900/20 ring-2 ring-emerald-200 dark:ring-emerald-800';
    if (indicators.includes('teal')) return 'bg-teal-100/50 dark:bg-teal-900/20 ring-2 ring-teal-200 dark:ring-teal-800';
    return '';
  };

  return (
    <div className="booking-calendar">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePreviousMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
          <div key={day} className="text-center text-xs font-semibold uppercase text-gray-600 dark:text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {calendarDays.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayData = tileData[dateKey];
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const indicators = getStatusIndicators(dateKey);
          const isPast = isPastDate(date);
          const isToday = isTodayDate(date);
          const isGroupHovered = dayData?.bookingIds?.some(id => hoveredBookingIds.has(id)) ?? false;

          return (
            <button
              key={dateKey}
              onClick={() => handleDateClick(date)}
              onMouseEnter={() => handleDayMouseEnter(dateKey)}
              onMouseLeave={handleDayMouseLeave}
              className={`
                w-10 h-10 md:w-12 md:h-12 lg:w-full lg:h-14 rounded-lg border border-transparent
                flex flex-col items-center justify-between p-1 transition-all duration-200
                ${isSelected
                  ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-800/30 ring-2 ring-blue-500 dark:ring-blue-400 hover:ring-4 hover:ring-blue-400 dark:hover:ring-blue-300 hover:shadow-lg'
                  : isGroupHovered
                    ? 'bg-emerald-200 dark:bg-emerald-800 ring-4 ring-emerald-400 dark:ring-emerald-500 shadow-lg'
                    : `bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 ${indicators.length > 0 ? getBackgroundTint(indicators) : ''}`
                }
                ${!isCurrentMonth ? 'opacity-40' : ''}
                ${isToday ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}
                ${isPast ? 'relative after:absolute after:inset-0 after:bg-gray-500/20 after:rounded-lg after:pointer-events-none' : ''}
              `}
            >
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-none">
                {format(date, 'd')}
              </span>

              {/* Status indicators */}
              {indicators.length > 0 && (
                <div className="w-full mt-auto">
                  {indicators.slice(0, 3).map((color, index) => (
                    <div
                      key={index}
                      className={`h-1 w-full ${getIndicatorColorClass(color)} rounded-sm`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-emerald-500 rounded mr-2"></div>
          <span>Reservas</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-amber-500 rounded mr-2"></div>
          <span>Bloqueo Propietario</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-teal-500 rounded mr-2"></div>
          <span>Calendario Externo</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-0.5 bg-red-500 rounded mr-2"></div>
          <span>Conflictos</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-600 rounded mr-2"></div>
          <span>Disponible</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-gray-500/20 border border-gray-200 dark:bg-gray-600 dark:border-gray-600 rounded mr-2"></div>
          <span>Fechas pasadas</span>
        </div>
      </div>

      {/* Selected booking info */}
      {selectedBooking && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700 rounded-lg">
          <h4 className="font-medium text-emerald-900 dark:text-emerald-100">Reserva Seleccionada</h4>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            {selectedBooking.Guest?.FirstName} {selectedBooking.Guest?.LastName} - {selectedBooking.GuestCount} persona(s)
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{selectedBooking.Notes}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {format(parseISO(selectedBooking.CheckInDate), 'dd/MM/yyyy')} - {format(parseISO(selectedBooking.CheckOutDate), 'dd/MM/yyyy')}
          </p>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;