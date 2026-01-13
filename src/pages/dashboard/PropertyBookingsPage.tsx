import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button, Card } from 'flowbite-react';
import DashboardPageTitle from '../../components/dashboard/DashboardPageTitle';
import { PropertyData } from '../../models/properties';
import BookingService, { BookingWithMember } from '../../services/BookingService';
import { AvailabilityBlock } from '../../models/calendar/CalendarSync';
import { CalendarSyncService, SyncStatus, SyncStatusResponse } from '../../services/CalendarSyncService';
import BookingCalendar from '../../components/dashboard/bookings/BookingCalendar';
import BookingDetailsPanel from '../../components/dashboard/bookings/BookingDetailsPanel';
import SyncStatusBar from '../../components/dashboard/bookings/SyncStatusBar';
import AvailabilityManager from '../../components/dashboard/bookings/AvailabilityManager';
import propertyService from '../../services/PropertyService';

interface PropertyBookingsPageState {
  property: PropertyData | null;
  bookings: BookingWithMember[];
  availabilityBlocks: AvailabilityBlock[];
  syncStatus: SyncStatusResponse | null;
  selectedBooking: BookingWithMember | null;
  selectedDate: Date | null;
  isLoading: boolean;
  isSyncing: boolean;
  hasUnsavedChanges: boolean;
  error: string | null;
  isAvailabilityMode: boolean;
}

const PropertyBookingsPage: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();

  const [state, setState] = useState<PropertyBookingsPageState>({
    property: null,
    bookings: [],
    availabilityBlocks: [],
    syncStatus: null,
    selectedBooking: null,
    selectedDate: null,
    isLoading: true,
    isSyncing: false,
    hasUnsavedChanges: false,
    error: null,
    isAvailabilityMode: false
  });

  // Load property details, bookings, availability blocks, and sync status
  const loadData = useCallback(async () => {
    if (!propertyId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Load property details
      const property = await propertyService.getOwnersPropertyById(propertyId);

      // Load bookings for the property (next 12 months)
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const bookingsResponse = await BookingService.getPropertyBookings(propertyId, startDate, endDate);

      // Load availability blocks
      const availabilityResponse = await CalendarSyncService.getAvailabilityBlocks(propertyId, startDate, endDate);

      // Load sync status
      const syncStatusResponse = await CalendarSyncService.getSyncStatus(propertyId);

      setState(prev => ({
        ...prev,
        property: property,
        bookings: bookingsResponse.succeeded ? bookingsResponse.data! : [],
        availabilityBlocks: availabilityResponse.succeeded ? availabilityResponse.data! : [],
        syncStatus: syncStatusResponse.succeeded ? syncStatusResponse.data! : null,
        isLoading: false
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to load bookings data',
        isLoading: false
      }));
    }
  }, [propertyId]);

  // Load data on component mount and when propertyId changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle calendar date/booking selection
  const handleCalendarSelect = useCallback((date: Date, booking?: BookingWithMember) => {
    setState(prev => ({
      ...prev,
      selectedDate: date,
      selectedBooking: booking || null
    }));
  }, []);

  // Handle booking creation/update
  const handleBookingChange = useCallback((updatedBooking: BookingWithMember) => {
    setState(prev => ({
      ...prev,
      bookings: prev.bookings.map(b =>
        b.Id === updatedBooking.Id ? updatedBooking : b
      ),
      hasUnsavedChanges: true,
      selectedBooking: updatedBooking
    }));
  }, []);

  // Handle new booking creation
  const handleNewBooking = useCallback((booking: BookingWithMember) => {
    setState(prev => ({
      ...prev,
      bookings: [...prev.bookings, booking],
      hasUnsavedChanges: true,
      selectedBooking: booking
    }));
  }, []);

  // Handle booking deletion
  const handleBookingDelete = useCallback((bookingId: string) => {
    setState(prev => ({
      ...prev,
      bookings: prev.bookings.filter(b => b.Id !== bookingId),
      hasUnsavedChanges: true,
      selectedBooking: prev.selectedBooking?.Id === bookingId ? null : prev.selectedBooking
    }));
  }, []);

  // Handle availability changes
  const handleAvailabilityChange = useCallback((updatedBlocks: AvailabilityBlock[]) => {
    setState(prev => ({
      ...prev,
      availabilityBlocks: updatedBlocks,
      hasUnsavedChanges: true
    }));
  }, []);

  // Handle sync trigger
  const handleSync = useCallback(async () => {
    if (!propertyId) return;

    setState(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      const syncResponse = await CalendarSyncService.triggerBulkSync(propertyId);

      if (syncResponse.succeeded) {
        // Refresh data after sync
        await loadData();
      } else {
        setState(prev => ({
          ...prev,
          error: syncResponse.errorMessage || 'Sync failed'
        }));
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Sync failed'
      }));
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, [propertyId, loadData]);

  // Handle save changes
  const handleSaveChanges = useCallback(async () => {
    // TODO: Implement save logic for all pending changes
    setState(prev => ({ ...prev, hasUnsavedChanges: false }));
  }, []);

  // Handle cancel changes
  const handleCancelChanges = useCallback(() => {
    // Reload data to discard changes
    loadData();
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: false,
      selectedBooking: null,
      selectedDate: null
    }));
  }, [loadData]);

  // Toggle availability mode
  const toggleAvailabilityMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      isAvailabilityMode: !prev.isAvailabilityMode,
      selectedBooking: null
    }));
  }, []);

  if (state.isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Loader2 className="animate-spin h-8 w-8 text-[#62B6CB]" />
        <span className="ml-2">Cargando reservas...</span>
      </div>
    );
  }

  if (!state.property) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Propiedad no encontrada</h3>
        <p className="text-gray-600 mb-4">La propiedad solicitada no existe o no tienes acceso.</p>
        <Button onClick={() => navigate('/dashboard/properties')}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Volver a Propiedades
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            color="alternative"
            onClick={() => navigate('/dashboard/properties')}
            className="flex items-center"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
          <DashboardPageTitle title={`Reservas - ${state.property.title}`} />
        </div>
      </div>

      {/* Error Display */}
      {state.error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {state.error}
          </div>
        </div>
      )}

      {/* Sync Status Bar */}
      <SyncStatusBar
        syncStatus={state.syncStatus}
        onSync={handleSync}
        isSyncing={state.isSyncing}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Section */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Calendario de Reservas</h3>
              <Button
                color={state.isAvailabilityMode ? "primary" : "alternative"}
                size="sm"
                onClick={toggleAvailabilityMode}
              >
                {state.isAvailabilityMode ? "Modo Reserva" : "Modo Disponibilidad"}
              </Button>
            </div>

            {state.isAvailabilityMode ? (
              <AvailabilityManager
                propertyId={propertyId!}
                availabilityBlocks={state.availabilityBlocks}
                onAvailabilityChange={handleAvailabilityChange}
                selectedDate={state.selectedDate}
                onDateSelect={handleCalendarSelect}
              />
            ) : (
              <BookingCalendar
                bookings={state.bookings}
                availabilityBlocks={state.availabilityBlocks}
                selectedDate={state.selectedDate}
                selectedBooking={state.selectedBooking}
                onSelect={handleCalendarSelect}
              />
            )}
          </Card>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          <BookingDetailsPanel
            propertyId={propertyId!}
            selectedBooking={state.selectedBooking}
            selectedDate={state.selectedDate}
            onBookingChange={handleBookingChange}
            onNewBooking={handleNewBooking}
            onBookingDelete={handleBookingDelete}
            onCancel={() => setState(prev => ({ ...prev, selectedBooking: null, selectedDate: null }))}
          />
        </div>
      </div>

      {/* Action Buttons */}
      {state.hasUnsavedChanges && (
        <div className="fixed bottom-6 right-6 flex space-x-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <Button
            color="alternative"
            onClick={handleCancelChanges}
            disabled={state.isLoading}
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button
            color="primary"
            onClick={handleSaveChanges}
            disabled={state.isLoading}
          >
            <Save className="mr-2 h-4 w-4" />
            Guardar Cambios
          </Button>
        </div>
      )}
    </div>
  );
};

export default PropertyBookingsPage;