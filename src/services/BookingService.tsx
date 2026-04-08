import { supabase } from '../config/supabase';
import { ensureBookingUsageIfApplicable } from './BillingUsageRecords';
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
  PropertyOwnerDisplay?: {
    ownerType: 'member' | 'company';
    name: string;
    email?: string;
    phone?: string;
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

function mapPropertyOwnerDisplay(owner: any): BookingWithMemberAndProperty['PropertyOwnerDisplay'] | undefined {
  if (owner?.OwnerType === 'member' && owner?.Member) {
    const fullName = [owner.Member.FirstName, owner.Member.LastName].filter(Boolean).join(' ').trim();
    return {
      ownerType: 'member',
      name: fullName || '—',
      email: owner.Member.Email ?? undefined,
      phone: owner.Member.Phone ?? undefined
    };
  }

  if (owner?.OwnerType === 'company' && owner?.Company) {
    return {
      ownerType: 'company',
      name: owner.Company.Name ?? '—',
      email: owner.Company.BillingEmail ?? undefined
    };
  }

  return undefined;
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
   * Get all bookings for the current owner (all their properties).
   * RLS restricts to bookings for properties owned by the current user.
   */
  static async getOwnerBookings(): Promise<SdiApiResponse<BookingWithMemberAndProperty[]>> {
    try {
      const { data, error } = await supabase
        .from('Bookings')
        .select(`
          *,
          EstateProperty:EstateProperties(
            Id,
            OwnerId,
            StreetName,
            HouseNumber,
            Neighborhood,
            City,
            State,
            ZipCode,
            Country,
            Owner:Owners(
              Id,
              OwnerType,
              MemberId,
              CompanyId,
              Member:Members(
                Id,
                UserId,
                FirstName,
                LastName,
                Email,
                Phone,
                AvatarUrl
              ),
              Company:Companies(
                Id,
                Name,
                BillingEmail
              )
            )
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

          const owner = ep.Owner;
          let ownerAsGuest: BookingWithMember['Guest'] | undefined;

          if (owner?.OwnerType === 'member' && owner?.Member) {
            ownerAsGuest = {
              Id: owner.Member.Id,
              UserId: owner.Member.UserId,
              FirstName: owner.Member.FirstName,
              LastName: owner.Member.LastName,
              Email: owner.Member.Email,
              Phone: owner.Member.Phone,
              AvatarUrl: owner.Member.AvatarUrl
            };
          } else if (owner?.OwnerType === 'company' && owner?.Company) {
            ownerAsGuest = {
              Id: owner.Company.Id,
              UserId: owner.Company.Id,
              FirstName: owner.Company.Name,
              LastName: '',
              Email: owner.Company.BillingEmail
            };
          }

          const { Owner: _owner, ...estatePropertyWithoutOwner } = ep;
          const Title = buildEstatePropertyTitle(ep);
          return {
            ...booking,
            Guest: ownerAsGuest,
            EstateProperty: {
              ...estatePropertyWithoutOwner,
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
          EstateProperty:EstateProperties(
            Id,
            OwnerId,
            StreetName,
            HouseNumber,
            Neighborhood,
            City,
            State,
            ZipCode,
            Country,
            Owner:Owners(
              Id,
              OwnerType,
              MemberId,
              CompanyId,
              Member:Members(
                Id,
                UserId,
                FirstName,
                LastName,
                Email,
                Phone,
                AvatarUrl
              ),
              Company:Companies(
                Id,
                Name,
                BillingEmail
              )
            )
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

          const owner = ep.Owner;
          const propertyOwnerDisplay = mapPropertyOwnerDisplay(owner);

          const { Owner: _owner, ...estatePropertyWithoutOwner } = ep;
          const Title = buildEstatePropertyTitle(ep);
          return {
            ...booking,
            PropertyOwnerDisplay: propertyOwnerDisplay,
            EstateProperty: {
              ...estatePropertyWithoutOwner,
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
        await ensureBookingUsageIfApplicable(data.Id, data.EstatePropertyId);
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