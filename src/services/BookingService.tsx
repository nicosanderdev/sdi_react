import { supabase } from '../config/supabase';
import { SdiApiResponse } from '../models/SdiApiResponse';
import { Booking, BookingStatus, BookingForm, ValidationStatus } from '../models/calendar/CalendarSync';

// Extended Booking interface with member information
export interface BookingWithMember extends Booking {
  Guest?: {
    Id: string;
    UserId: string;
    FirstName?: string;
    LastName?: string;
    Email?: string;
    Phone?: string;
    AvatarUrl?: string;
  };
}

// Booking creation/update form data
export interface BookingFormData {
  estatePropertyId: string;
  guestId: string | null | undefined;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  totalAmount?: number;
  currency: number; // Currency enum value
  notes?: string;
  bookingSource?: string;
  externalBookingId?: string;
}

// Booking validation result
export interface BookingValidationResult {
  isValid: boolean;
  conflicts: BookingWithMember[];
  message?: string;
}

class BookingService {
  /**
   * Get all bookings for a property with optional date range
   */
  static async getPropertyBookings(
    propertyId: string,
    startDate?: string,
    endDate?: string
  ): Promise<SdiApiResponse<BookingWithMember[]>> {
    try {
      let query = supabase
        .from('Bookings')
        .select(`
          *,
          Guest:Members!FK_Bookings_Members_GuestId(
            Id,
            UserId,
            FirstName,
            LastName,
            Email,
            Phone,
            AvatarUrl
          )
        `)
        .eq('EstatePropertyId', propertyId)
        .eq('IsDeleted', false)
        .order('CheckInDate', { ascending: true });

      if (startDate) {
        query = query.gte('CheckInDate', startDate);
      }

      if (endDate) {
        query = query.lte('CheckOutDate', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        succeeded: true,
        data: data || []
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to fetch property bookings'
      };
    }
  }

  /**
   * Get a single booking by ID with member information
   */
  static async getBookingById(bookingId: string): Promise<SdiApiResponse<BookingWithMember>> {
    try {
      const { data, error } = await supabase
        .from('Bookings')
        .select(`
          *,
          Guest:Members!FK_Bookings_Members_GuestId(
            Id,
            UserId,
            FirstName,
            LastName,
            Email,
            Phone,
            AvatarUrl
          )
        `)
        .eq('Id', bookingId)
        .eq('IsDeleted', false)
        .single();

      if (error) throw error;

      return {
        succeeded: true,
        data
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to fetch booking'
      };
    }
  }

  /**
   * Create a new booking with validation
   */
  static async createBooking(bookingData: BookingFormData): Promise<SdiApiResponse<BookingWithMember>> {
    try {
      // First validate for conflicts
      const validation = await this.validateBookingDates(
        bookingData.estatePropertyId,
        bookingData.checkInDate,
        bookingData.checkOutDate
      );

      if (!validation.succeeded || !validation.data?.isValid) {
        return {
          succeeded: false,
          errorMessage: validation.data?.message || 'Booking validation failed'
        };
      }

      const bookingPayload = {
        EstatePropertyId: bookingData.estatePropertyId,
        GuestId: bookingData.guestId && bookingData.guestId.trim() !== '' ? bookingData.guestId : null,
        CheckInDate: bookingData.checkInDate,
        CheckOutDate: bookingData.checkOutDate,
        GuestCount: bookingData.guestCount,
        TotalAmount: bookingData.totalAmount,
        Currency: bookingData.currency,
        Notes: bookingData.notes,
        BookingSource: bookingData.bookingSource,
        ExternalBookingId: bookingData.externalBookingId,
        Status: BookingStatus.Confirmed, // Default to confirmed
        ValidationStatus: ValidationStatus.Valid,
        HasConflict: validation.data.conflicts.length > 0,
        ConflictReason: validation.data.conflicts.length > 0
          ? `Conflicts with ${validation.data.conflicts.length} other booking(s)`
          : undefined,
        CreatedBy: (await supabase.auth.getUser()).data.user?.id
      };

      const { data, error } = await supabase
        .from('Bookings')
        .insert(bookingPayload)
        .select(`
          *,
          Guest:Members!FK_Bookings_Members_GuestId(
            Id,
            UserId,
            FirstName,
            LastName,
            Email,
            Phone,
            AvatarUrl
          )
        `)
        .single();

      if (error) throw error;

      return {
        succeeded: true,
        data
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to create booking'
      };
    }
  }

  /**
   * Update an existing booking
   */
  static async updateBooking(
    bookingId: string,
    updates: Partial<BookingFormData & {
      status?: BookingStatus;
      validationStatus?: ValidationStatus;
      hasConflict?: boolean;
      conflictReason?: string;
    }>
  ): Promise<SdiApiResponse<BookingWithMember>> {
    try {
      const updatePayload: any = {
        ...updates,
        LastModified: new Date().toISOString(),
        LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
      };

      // Map form field names to database field names
      if (updates.estatePropertyId) updatePayload.EstatePropertyId = updates.estatePropertyId;
      if (updates.guestId !== undefined) updatePayload.GuestId = updates.guestId && updates.guestId.trim() !== '' ? updates.guestId : null;
      if (updates.checkInDate) updatePayload.CheckInDate = updates.checkInDate;
      if (updates.checkOutDate) updatePayload.CheckOutDate = updates.checkOutDate;
      if (updates.guestCount !== undefined) updatePayload.GuestCount = updates.guestCount;
      if (updates.totalAmount !== undefined) updatePayload.TotalAmount = updates.totalAmount;
      if (updates.currency !== undefined) updatePayload.Currency = updates.currency;
      if (updates.notes !== undefined) updatePayload.Notes = updates.notes;
      if (updates.bookingSource !== undefined) updatePayload.BookingSource = updates.bookingSource;
      if (updates.externalBookingId !== undefined) updatePayload.ExternalBookingId = updates.externalBookingId;
      if (updates.status !== undefined) updatePayload.Status = updates.status;
      if (updates.validationStatus !== undefined) updatePayload.ValidationStatus = updates.validationStatus;
      if (updates.hasConflict !== undefined) updatePayload.HasConflict = updates.hasConflict;
      if (updates.conflictReason !== undefined) updatePayload.ConflictReason = updates.conflictReason;

      const { data, error } = await supabase
        .from('Bookings')
        .update(updatePayload)
        .eq('Id', bookingId)
        .select(`
          *,
          Guest:Members!FK_Bookings_Members_GuestId(
            Id,
            UserId,
            FirstName,
            LastName,
            Email,
            Phone,
            AvatarUrl
          )
        `)
        .single();

      if (error) throw error;

      return {
        succeeded: true,
        data
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to update booking'
      };
    }
  }

  /**
   * Soft delete a booking
   */
  static async deleteBooking(bookingId: string): Promise<SdiApiResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('Bookings')
        .update({
          IsDeleted: true,
          LastModified: new Date().toISOString(),
          LastModifiedBy: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('Id', bookingId);

      if (error) throw error;

      return {
        succeeded: true,
        data: true
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to delete booking'
      };
    }
  }

  /**
   * Validate booking dates for conflicts
   */
  static async validateBookingDates(
    propertyId: string,
    checkInDate: string,
    checkOutDate: string,
    excludeBookingId?: string
  ): Promise<SdiApiResponse<BookingValidationResult>> {
    try {
      // Check for overlapping bookings
      let query = supabase
        .from('Bookings')
        .select(`
          *,
          Guest:Members!FK_Bookings_Members_GuestId(
            Id,
            UserId,
            FirstName,
            LastName,
            Email,
            Phone,
            AvatarUrl
          )
        `)
        .eq('EstatePropertyId', propertyId)
        .eq('IsDeleted', false)
        .neq('Status', BookingStatus.Cancelled)
        .or(`and(CheckInDate.lt.${checkOutDate},CheckOutDate.gt.${checkInDate})`);

      if (excludeBookingId) {
        query = query.neq('Id', excludeBookingId);
      }

      const { data: conflictingBookings, error } = await query;

      if (error) throw error;

      const conflicts = conflictingBookings || [];

      return {
        succeeded: true,
        data: {
          isValid: conflicts.length === 0,
          conflicts,
          message: conflicts.length > 0
            ? `Found ${conflicts.length} conflicting booking(s) for the selected dates`
            : 'No conflicts found'
        }
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to validate booking dates'
      };
    }
  }

  /**
   * Search members for guest selection
   */
  static async searchMembers(searchTerm: string, limit: number = 10): Promise<SdiApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('Members')
        .select('Id, UserId, FirstName, LastName, Email, Phone, AvatarUrl')
        .eq('IsDeleted', false)
        .or(`FirstName.ilike.%${searchTerm}%,LastName.ilike.%${searchTerm}%,Email.ilike.%${searchTerm}%`)
        .limit(limit);

      if (error) throw error;

      return {
        succeeded: true,
        data: data || []
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to search members'
      };
    }
  }
}

export default BookingService;