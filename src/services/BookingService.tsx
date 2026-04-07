import { supabase } from '../config/supabase';
import { SdiApiResponse } from '../models/SdiApiResponse';
import { Booking, BookingStatus, ValidationStatus } from '../models/calendar/CalendarSync';

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

// Extended for owner's list: booking with guest and property title
export interface BookingWithMemberAndProperty extends BookingWithMember {
  EstateProperty?: {
    Id: string;
    Title?: string;
    StreetName?: string;
    HouseNumber?: string;
    Neighborhood?: string;
    City?: string;
    State?: string;
    ZipCode?: string;
    Country?: string;
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

function buildEstatePropertyTitle(ep: BookingWithMemberAndProperty['EstateProperty'] | null | undefined): string | undefined {
  if (!ep) return undefined;

  const street = [ep.StreetName, ep.HouseNumber].filter(Boolean).join(' ').trim();
  const location = [ep.Neighborhood, ep.City, ep.State].filter(Boolean).join(', ').trim();
  const zipCountry = [ep.ZipCode, ep.Country].filter(Boolean).join(' ').trim();

  const suffix = [location, zipCountry].filter(Boolean).join(' - ').trim();
  const title = street ? (suffix ? `${street} - ${suffix}` : street) : (suffix || undefined);

  return title || undefined;
}

class BookingService {
  private static async resolveBillingMemberIdByPropertyId(propertyId: string): Promise<string | null> {
    const { data: property, error: propertyError } = await supabase
      .from('EstateProperties')
      .select('OwnerId')
      .eq('Id', propertyId)
      .eq('IsDeleted', false)
      .single();

    if (propertyError) throw propertyError;
    if (!property?.OwnerId) return null;

    const { data: owner, error: ownerError } = await supabase
      .from('Owners')
      .select('OwnerType,MemberId,CompanyId')
      .eq('Id', property.OwnerId)
      .eq('IsDeleted', false)
      .single();

    if (ownerError) throw ownerError;
    if (!owner) return null;

    if (owner.OwnerType === 'member') {
      return owner.MemberId ?? null;
    }

    if (owner.OwnerType === 'company' && owner.CompanyId) {
      const { data: ownerMap, error: ownerMapError } = await supabase
        .from('BillingOwnerMemberMap')
        .select('MemberId')
        .eq('OwnerId', owner.CompanyId)
        .eq('IsActive', true)
        .limit(1);

      if (ownerMapError) throw ownerMapError;
      return ownerMap?.[0]?.MemberId ?? null;
    }

    return null;
  }

  private static async ensureBookingUsageRecord(bookingId: string, propertyId: string): Promise<void> {
    const memberId = await this.resolveBillingMemberIdByPropertyId(propertyId);
    if (!memberId) {
      throw new Error('Unable to resolve billing member for booking usage record');
    }

    const payload = {
      MemberId: memberId,
      Type: 'booking',
      ReferenceId: bookingId,
      Amount: null
    };

    const { error } = await supabase
      .from('UsageRecords')
      .upsert(payload, { onConflict: 'MemberId,Type,ReferenceId', ignoreDuplicates: true });

    if (error) throw error;
  }

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

      if (status === BookingStatus.Confirmed && data?.Id && data?.EstatePropertyId) {
        await this.ensureBookingUsageRecord(data.Id, data.EstatePropertyId);
      }

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
   * Get all bookings for the current owner (all their properties).
   * RLS restricts to bookings for properties owned by the current user.
   */
  static async getOwnerBookings(): Promise<SdiApiResponse<BookingWithMemberAndProperty[]>> {
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
          ),
          EstateProperty:EstateProperties(
            Id,
            StreetName,
            HouseNumber,
            Neighborhood,
            City,
            State,
            ZipCode,
            Country
          )
        `)
        .eq('IsDeleted', false)
        .order('CheckInDate', { ascending: false });

      if (error) throw error;

      return {
        succeeded: true,
        data: (data || []).map((booking: any) => {
          const ep = booking.EstateProperty;
          if (!ep) return booking;

          const Title = buildEstatePropertyTitle(ep);
          return {
            ...booking,
            EstateProperty: {
              ...ep,
              Title
            }
          };
        }) as BookingWithMemberAndProperty[]
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to fetch bookings'
      };
    }
  }

  /**
   * Get all bookings for admin view (all members).
   * RLS allows admins to see all bookings; same query shape as getOwnerBookings.
   */
  static async getAdminBookings(): Promise<SdiApiResponse<BookingWithMemberAndProperty[]>> {
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
          ),
          EstateProperty:EstateProperties(
            Id,
            StreetName,
            HouseNumber,
            Neighborhood,
            City,
            State,
            ZipCode,
            Country
          )
        `)
        .eq('IsDeleted', false)
        .order('CheckInDate', { ascending: false });

      if (error) throw error;

      return {
        succeeded: true,
        data: (data || []).map((booking: any) => {
          const ep = booking.EstateProperty;
          if (!ep) return booking;

          const Title = buildEstatePropertyTitle(ep);
          return {
            ...booking,
            EstateProperty: {
              ...ep,
              Title
            }
          };
        }) as BookingWithMemberAndProperty[]
      };
    } catch (error: any) {
      return {
        succeeded: false,
        errorMessage: error.message || 'Failed to fetch bookings'
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
   * Create a new booking with validation.
   * Default status is Pending (e.g. guest submissions). Pass status: BookingStatus.Confirmed for owner-created bookings.
   */
  static async createBooking(
    bookingData: BookingFormData,
    options?: { status?: BookingStatus }
  ): Promise<SdiApiResponse<BookingWithMember>> {
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

      const status = options?.status ?? BookingStatus.Pending;

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
        Status: status,
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
          ),
          EstateProperty:EstateProperties(
            Id,
            StreetName,
            HouseNumber,
            Neighborhood,
            City,
            State,
            ZipCode,
            Country
          )
        `)
        .single();

      if (error) throw error;

      if (data?.EstateProperty) {
        data.EstateProperty.Title = buildEstatePropertyTitle(data.EstateProperty);
      }

      if (updates.status === BookingStatus.Confirmed && data?.Id && data?.EstatePropertyId) {
        await this.ensureBookingUsageRecord(data.Id, data.EstatePropertyId);
      }

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