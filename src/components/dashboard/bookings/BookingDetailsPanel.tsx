import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import {
  User,
  Mail,
  Phone,
  DollarSign,
  Calendar as CalendarIcon,
  Users,
  Edit3,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  Ban,
  CheckSquare
} from 'lucide-react';
import { Button, Card, Label, TextInput, Textarea, Select, Modal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import BookingService, { BookingWithMember, BookingFormData } from '../../../services/BookingService';
import { BookingStatus, BOOKING_STATUS_NAMES, Currency, CURRENCY_NAMES, CURRENCY_SYMBOLS } from '../../../models/calendar/CalendarSync';

interface BookingDetailsPanelProps {
  propertyId: string;
  selectedBooking: BookingWithMember | null;
  selectedDate: Date | null;
  onBookingChange: (booking: BookingWithMember) => void;
  onNewBooking: (booking: BookingWithMember) => void;
  onBookingDelete: (bookingId: string) => void;
  onCancel: () => void;
}

interface BookingFormState {
  checkInDate: string;
  checkOutDate: string;
  guestId: string | null;
  guestCount: number;
  totalAmount: number;
  currency: Currency;
  notes: string;
  bookingSource: string;
  externalBookingId: string;
}

const BookingDetailsPanel: React.FC<BookingDetailsPanelProps> = ({
  propertyId,
  selectedBooking,
  selectedDate,
  onBookingChange,
  onNewBooking,
  onBookingDelete,
  onCancel
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [formData, setFormData] = useState<BookingFormState>({
    checkInDate: '',
    checkOutDate: '',
    guestId: '',
    guestCount: 1,
    totalAmount: 0,
    currency: Currency.UYU,
    notes: '',
    bookingSource: 'internal',
    externalBookingId: ''
  });

  // Initialize form data when booking is selected
  useEffect(() => {
    if (selectedBooking) {
      setFormData({
        checkInDate: selectedBooking.CheckInDate,
        checkOutDate: selectedBooking.CheckOutDate,
        guestId: selectedBooking.GuestId,
        guestCount: selectedBooking.GuestCount,
        totalAmount: selectedBooking.TotalAmount || 0,
        currency: selectedBooking.Currency,
        notes: selectedBooking.Notes || '',
        bookingSource: selectedBooking.BookingSource || 'internal',
        externalBookingId: selectedBooking.ExternalBookingId || ''
      });
      setIsEditing(false);
      setIsCreating(false);
    } else if (selectedDate) {
      // Initialize for new booking
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      setFormData({
        checkInDate: dateStr,
        checkOutDate: dateStr,
        guestId: '',
        guestCount: 1,
        totalAmount: 0,
        currency: Currency.UYU,
        notes: '',
        bookingSource: 'internal',
        externalBookingId: ''
      });
      setIsCreating(true);
      setIsEditing(true);
    } else {
      // Reset form
      setFormData({
        checkInDate: '',
        checkOutDate: '',
        guestId: '',
        guestCount: 1,
        totalAmount: 0,
        currency: Currency.UYU,
        notes: '',
        bookingSource: 'internal',
        externalBookingId: ''
      });
      setIsEditing(false);
      setIsCreating(false);
    }
    setErrors([]);
  }, [selectedBooking, selectedDate]);

  // Handle form input changes
  const handleInputChange = (field: keyof BookingFormState, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Start editing existing booking
  const handleEdit = () => {
    setIsEditing(true);
  };

  // Cancel editing
  const handleCancel = () => {
    if (selectedBooking) {
      // Reset to original values
      setFormData({
        checkInDate: selectedBooking.CheckInDate,
        checkOutDate: selectedBooking.CheckOutDate,
        guestId: selectedBooking.GuestId,
        guestCount: selectedBooking.GuestCount,
        totalAmount: selectedBooking.TotalAmount || 0,
        currency: selectedBooking.Currency,
        notes: selectedBooking.Notes || '',
        bookingSource: selectedBooking.BookingSource || 'internal',
        externalBookingId: selectedBooking.ExternalBookingId || ''
      });
      setIsEditing(false);
    } else {
      onCancel();
    }
    setErrors([]);
  };

  // Save booking changes
  const handleSave = async () => {
    setIsSaving(true);
    setErrors([]);

    try {
      const bookingFormData: BookingFormData = {
        estatePropertyId: propertyId,
        guestId: formData.guestId,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        guestCount: formData.guestCount,
        totalAmount: formData.totalAmount,
        currency: formData.currency,
        notes: formData.notes,
        bookingSource: formData.bookingSource,
        externalBookingId: formData.externalBookingId
      };

      let result;
      if (isCreating) {
        result = await BookingService.createBooking(bookingFormData);
        if (result.succeeded && result.data) {
          onNewBooking(result.data);
          setIsCreating(false);
          setIsEditing(false);
        }
      } else if (selectedBooking) {
        result = await BookingService.updateBooking(selectedBooking.Id, bookingFormData);
        if (result.succeeded && result.data) {
          onBookingChange(result.data);
          setIsEditing(false);
        }
      }

      if (!result?.succeeded) {
        setErrors([result?.errorMessage || 'Error saving booking']);
      }
    } catch (error: any) {
      setErrors([error.message || 'Error saving booking']);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle booking deletion
  const handleDelete = async () => {
    if (!selectedBooking) return;

    try {
      const result = await BookingService.deleteBooking(selectedBooking.Id);
      if (result.succeeded) {
        onBookingDelete(selectedBooking.Id);
        setShowDeleteModal(false);
        onCancel();
      } else {
        setErrors([result.errorMessage || 'Error deleting booking']);
      }
    } catch (error: any) {
      setErrors([error.message || 'Error deleting booking']);
    }
  };

  // Update booking status
  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (!selectedBooking) return;

    try {
      const result = await BookingService.updateBooking(selectedBooking.Id, { status: newStatus });
      if (result.succeeded && result.data) {
        onBookingChange(result.data);
      } else {
        setErrors([result.errorMessage || 'Error updating status']);
      }
    } catch (error: any) {
      setErrors([error.message || 'Error updating status']);
    }
  };

  // Get status icon and color
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

  if (!selectedBooking && !selectedDate) {
    return (
      <Card>
        <div className="text-center py-8">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-800 dark:text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Seleccionar Fecha</h3>
          <p className="text-gray-600 dark:text-gray-300">
            Haz clic en una fecha del calendario para ver reservas o crear una nueva.
          </p>
        </div>
      </Card>
    );
  }

  const StatusIcon = selectedBooking ? getStatusDisplay(selectedBooking.Status).icon : Clock;

  return (
    <>
      <Card>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              {isCreating ? 'Nueva Reserva' : selectedBooking ? 'Detalles de Reserva' : 'Seleccionar Fecha'}
            </h3>
            {selectedBooking && !isEditing && (
              <div className="flex space-x-2">
                <Button size="sm" color="alternative" onClick={handleEdit}>
                  <Edit3 className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button size="sm" color="red" onClick={() => setShowDeleteModal(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <ul className="list-disc list-inside">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Status */}
          {selectedBooking && (
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${getStatusDisplay(selectedBooking.Status).bgColor}`}>
                <StatusIcon className={`h-5 w-5 ${getStatusDisplay(selectedBooking.Status).color}`} />
              </div>
              <div>
                <p className="font-medium">{BOOKING_STATUS_NAMES[selectedBooking.Status]}</p>
                {!isEditing && (
                  <Select
                    value={selectedBooking.Status.toString()}
                    onChange={(e) => handleStatusChange(parseInt(e.target.value) as BookingStatus)}
                    className="mt-1"
                    sizing="sm"
                  >
                  {Object.entries(BOOKING_STATUS_NAMES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Booking Form */}
          <div className="space-y-4">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="checkInDate">Check-in</Label>
                <TextInput
                  id="checkInDate"
                  type="date"
                  value={formData.checkInDate}
                  onChange={(e) => handleInputChange('checkInDate', e.target.value)}
                  disabled={!isEditing}
                  sizing="sm"
                />
              </div>
              <div>
                <Label htmlFor="checkOutDate">Check-out</Label>
                <TextInput
                  id="checkOutDate"
                  type="date"
                  value={formData.checkOutDate}
                  onChange={(e) => handleInputChange('checkOutDate', e.target.value)}
                  disabled={!isEditing}
                  sizing="sm"
                />
              </div>
            </div>

            {/* Guest Count */}
            <div>
              <Label htmlFor="guestCount">Número de Huéspedes</Label>
              <TextInput
                id="guestCount"
                type="number"
                min="1"
                value={formData.guestCount}
                onChange={(e) => handleInputChange('guestCount', parseInt(e.target.value) || 1)}
                disabled={!isEditing}
                sizing="sm"
                icon={Users}
              />
            </div>

            {/* Amount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="totalAmount">Monto Total</Label>
                <TextInput
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  value={formData.totalAmount}
                  onChange={(e) => handleInputChange('totalAmount', parseFloat(e.target.value) || 0)}
                  disabled={!isEditing}
                  sizing="sm"
                  icon={DollarSign}
                />
              </div>
              <div>
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  id="currency"
                  value={formData.currency.toString()}
                  onChange={(e) => handleInputChange('currency', parseInt(e.target.value) as Currency)}
                  disabled={!isEditing}
                  sizing="sm"
                >
                  {Object.entries(CURRENCY_NAMES).map(([value, label]) => (
                    <option key={value} value={value}>{CURRENCY_SYMBOLS[parseInt(value) as Currency]} {label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                disabled={!isEditing}
                rows={3}
              />
            </div>
          </div>

          {/* Guest Information */}
          {selectedBooking?.Guest && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Información del Huésped
              </h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-gray-500" />
                  <span>{selectedBooking.Guest.FirstName} {selectedBooking.Guest.LastName}</span>
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

          {/* Action Buttons */}
          {isEditing && (
            <div className="flex space-x-2 pt-4 border-t">
              <Button
                color="alternative"
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1"
              >
                <X className="h-6 w-6 mr-2" />
                Cancelar
              </Button>
              <Button
                color="green"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-6 w-6 mr-2" />
                    {isCreating ? 'Crear Reserva' : 'Guardar'}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <ModalHeader>Confirmar Eliminación</ModalHeader>
        <ModalBody>
          <p className="text-gray-700">
            ¿Estás seguro de que quieres eliminar esta reserva? Esta acción no se puede deshacer.
          </p>
          {selectedBooking && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="font-medium">
                {selectedBooking.Guest?.FirstName} {selectedBooking.Guest?.LastName}
              </p>
              <p className="text-sm text-gray-600">
                {format(parseISO(selectedBooking.CheckInDate), 'dd/MM/yyyy')} - {format(parseISO(selectedBooking.CheckOutDate), 'dd/MM/yyyy')}
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="alternative" onClick={() => setShowDeleteModal(false)}>
            Cancelar
          </Button>
          <Button color="red" onClick={handleDelete}>
            Eliminar Reserva
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default BookingDetailsPanel;