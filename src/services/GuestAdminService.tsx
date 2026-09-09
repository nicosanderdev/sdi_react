import { supabase } from '../config/supabase';

export interface GuestListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string;
  created: string;
  bookingsCount: number;
}

export interface GuestListResponse {
  guests: GuestListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface GuestDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string;
  created: string;
  lastModified: string;
  bookingsCount: number;
}

export interface GuestFilters {
  page?: number;
  limit?: number;
  search?: string;
}

class GuestAdminService {
  async getGuestsList(filters: GuestFilters = {}): Promise<GuestListResponse> {
    const params = {
      p_page: filters.page || 1,
      p_limit: filters.limit || 20,
      p_search: filters.search || null,
    };

    const { data, error } = await supabase.rpc('get_admin_guests_list', params);

    if (error) {
      throw new Error(`Failed to fetch guests list: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        guests: [],
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 20,
      };
    }

    const guests: GuestListItem[] = data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: (row.email as string | null) ?? null,
      phoneNumber: row.phone_number as string,
      created: row.created as string,
      bookingsCount: Number(row.bookings_count ?? 0),
    }));

    const total = Number(data[0]?.total_count ?? 0);

    return {
      guests,
      total,
      page: filters.page || 1,
      limit: filters.limit || 20,
    };
  }

  async getGuestDetail(guestId: string): Promise<GuestDetail | null> {
    const { data, error } = await supabase.rpc('get_admin_guest_detail', {
      p_guest_id: guestId,
    });

    if (error) {
      throw new Error(`Failed to fetch guest detail: ${error.message}`);
    }

    const payload = data as { success?: boolean; error?: string; guest?: Record<string, unknown> };

    if (!payload?.success || !payload.guest) {
      return null;
    }

    const g = payload.guest;
    return {
      id: g.id as string,
      firstName: g.firstName as string,
      lastName: g.lastName as string,
      email: (g.email as string | null) ?? null,
      phoneNumber: g.phoneNumber as string,
      created: g.created as string,
      lastModified: g.lastModified as string,
      bookingsCount: Number(g.bookingsCount ?? 0),
    };
  }
}

const guestAdminService = new GuestAdminService();
export default guestAdminService;
