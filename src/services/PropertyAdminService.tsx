// src/services/PropertyAdminService.tsx
import { supabase } from '../config/supabase';
import { PropertyData } from '../models/properties';

// Property status types (matching enum values from database)
export type PropertyStatus = 'sale' | 'rent' | 'reserved' | 'sold' | 'unavailable';

// Property visibility and moderation types
export type PropertyVisibility = 'visible' | 'hidden';
export type PropertyActivity = 'active' | 'inactive';

// Moderation action types
export type ModerationActionType = 'hide' | 'mark_invalid' | 'mark_spam' | 'delete';

// Interfaces
export interface AdminPropertyListItem {
  id: string;
  title: string;
  ownerName: string;
  ownerEmail: string;
  city: string;
  state: string;
  status: PropertyStatus;
  isActive: boolean;
  isPropertyVisible: boolean;
  createdAt: string;
  lastModified: string;
}

// Admin detail payload mirrors `public.get_admin_property_detail`, which matches `PropertyData`.
export type AdminPropertyDetail = PropertyData;

export interface PropertyListResponse {
  properties: AdminPropertyListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PropertyFilters {
  page?: number;
  limit?: number;
  userId?: string;
  status?: PropertyStatus;
  location?: string;
  search?: string;
}

export interface PropertyStatistics {
  totalProperties: number;
  incompleteProperties: number;
  neverPublished: number;
  activeProperties: number;
  archivedProperties: number;
}

export interface ActionResult {
  success: boolean;
  message: string;
}

class PropertyAdminService {
  /**
   * Fetch paginated list of properties with filters for admin
   */
  async getPropertiesList(filters: PropertyFilters = {}): Promise<PropertyListResponse> {
    const params = {
      p_page: filters.page || 1,
      p_limit: filters.limit || 20,
      p_user_id: filters.userId || null,
      p_status: filters.status || null,
      p_location: filters.location || null,
      p_search: filters.search || null,
    };

    const { data, error } = await supabase.rpc('get_admin_properties_list', params);

    if (error) {
      throw new Error(`Failed to fetch properties list: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        properties: [],
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 20,
      };
    }

    // Transform the data to match our interface
    const properties: AdminPropertyListItem[] = data.map((property: any) => ({
      id: property.id,
      title: property.title,
      ownerName: property.owner_name,
      ownerEmail: property.owner_email,
      city: property.city,
      state: property.state,
      status: this.mapStatusToEnum(property.status),
      isActive: property.is_active,
      isPropertyVisible: property.is_property_visible,
      createdAt: property.created,
      lastModified: property.last_modified,
    }));

    return {
      properties,
      total: data[0].total_count,
      page: filters.page || 1,
      limit: filters.limit || 20,
    };
  }

  /**
   * Fetch detailed property information for admin
   */
  async getPropertyDetail(propertyId: string): Promise<PropertyData | null> {
    const { data, error } = await supabase.rpc('get_admin_property_detail', { p_property_id: propertyId });

    if (error) {
      throw new Error(`Failed to fetch property detail: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Supabase RPC returns columns matching the `PropertyData` field names.
    return data[0] as PropertyData;
  }

  /**
   * Fetch property statistics for admin dashboard
   */
  async getPropertyStatistics(): Promise<PropertyStatistics> {
    const { data, error } = await supabase.rpc('get_admin_property_statistics');

    if (error) {
      throw new Error(`Failed to fetch property statistics: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        totalProperties: 0,
        incompleteProperties: 0,
        neverPublished: 0,
        activeProperties: 0,
        archivedProperties: 0,
      };
    }

    const stats = data[0];

    return {
      totalProperties: stats.total_properties,
      incompleteProperties: stats.incomplete_properties,
      neverPublished: stats.never_published,
      activeProperties: stats.active_properties,
      archivedProperties: stats.archived_properties,
    };
  }

  /**
   * Hide a property (set IsPropertyVisible = false)
   */
  async hideProperty(propertyId: string, reason?: string): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('admin_hide_property', {
      p_property_id: propertyId,
      p_reason: reason,
    });

    if (error) {
      throw new Error(`Failed to hide property: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Mark property as invalid/spam
   */
  async markPropertyInvalid(propertyId: string, reason: string, markAsSpam?: boolean): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('admin_mark_property_invalid', {
      p_property_id: propertyId,
      p_reason: reason,
      p_mark_as_spam: markAsSpam || false,
    });

    if (error) {
      throw new Error(`Failed to mark property as invalid: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Delete property (hard delete for emergencies)
   */
  async deleteProperty(propertyId: string, reason: string): Promise<ActionResult> {
    const { data, error } = await supabase.rpc('admin_delete_property', {
      p_property_id: propertyId,
      p_reason: reason,
    });

    if (error) {
      throw new Error(`Failed to delete property: ${error.message}`);
    }

    return data as ActionResult;
  }

  /**
   * Helper function to map status number to enum
   */
  private mapStatusToEnum(status: number): PropertyStatus {
    switch (status) {
      case 0: return 'sale';
      case 1: return 'rent';
      case 2: return 'reserved';
      case 3: return 'sold';
      case 4: return 'unavailable';
      default: return 'unavailable';
    }
  }
}

const propertyAdminService = new PropertyAdminService();
export default propertyAdminService;
