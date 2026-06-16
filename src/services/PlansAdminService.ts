import { supabase } from '../config/supabase';
import type { PropertyType } from '../models/properties/PropertyData';

export type PricingModel = 'per_booking' | 'per_listing' | 'hybrid';

export interface AdminPlanRow {
  id: string;
  key: number;
  name: string;
  monthlyPrice: number;
  currency: string;
  maxProperties: number | null;
  maxUsers: number | null;
  maxStorageMb: number | null;
  billingCycle: number;
  isActive: boolean;
  isDeleted: boolean;
  maxPublishedProperties: number | null;
  commissionPercentage: number | null;
  commissionMinimumAmount: number | null;
  extraPropertiesPrice11to30: number | null;
  extraPropertiesPrice31Plus: number | null;
  bookingReceiptMinimumAmount: number | null;
  propertyType: PropertyType | null;
  pricingModel: PricingModel | null;
  price: number | null;
  minMonthlyFee: number | null;
  pricePerBooking: number | null;
  listingLimit: number | null;
  durationDays: number | null;
  isActiveV2: boolean | null;
  bookingLimit: number | null;
  lastModified: string;
}

export type AdminPlanUpsertPayload = {
  Id?: string;
  Key?: number;
  Name: string;
  Currency: string;
  PricingModel: PricingModel;
  MonthlyPrice?: number | null;
  Price?: number | null;
  MinMonthlyFee?: number | null;
  PricePerBooking?: number | null;
  MaxProperties?: number | null;
  MaxPublishedProperties?: number | null;
  MaxUsers?: number | null;
  MaxStorageMb?: number | null;
  ListingLimit?: number | null;
  BookingLimit?: number | null;
  BillingCycle?: number | null;
  DurationDays?: number | null;
  IsActive?: boolean;
  IsActiveV2?: boolean;
  IsDeleted?: boolean;
  CommissionPercentage?: number | null;
  CommissionMinimumAmount?: number | null;
  ExtraPropertiesPrice11to30?: number | null;
  ExtraPropertiesPrice31Plus?: number | null;
  BookingReceiptMinimumAmount?: number | null;
  PropertyType?: PropertyType | null;
};

function mapRow(row: Record<string, unknown>): AdminPlanRow {
  return {
    id: row.Id as string,
    key: row.Key as number,
    name: row.Name as string,
    monthlyPrice: Number(row.MonthlyPrice ?? 0),
    currency: row.Currency as string,
    maxProperties: row.MaxProperties != null ? Number(row.MaxProperties) : null,
    maxUsers: row.MaxUsers != null ? Number(row.MaxUsers) : null,
    maxStorageMb: row.MaxStorageMb != null ? Number(row.MaxStorageMb) : null,
    billingCycle: Number(row.BillingCycle ?? 30),
    isActive: Boolean(row.IsActive),
    isDeleted: Boolean(row.IsDeleted),
    maxPublishedProperties:
      row.MaxPublishedProperties != null ? Number(row.MaxPublishedProperties) : null,
    commissionPercentage:
      row.CommissionPercentage != null ? Number(row.CommissionPercentage) : null,
    commissionMinimumAmount:
      row.CommissionMinimumAmount != null ? Number(row.CommissionMinimumAmount) : null,
    extraPropertiesPrice11to30:
      row.ExtraPropertiesPrice11to30 != null ? Number(row.ExtraPropertiesPrice11to30) : null,
    extraPropertiesPrice31Plus:
      row.ExtraPropertiesPrice31Plus != null ? Number(row.ExtraPropertiesPrice31Plus) : null,
    bookingReceiptMinimumAmount:
      row.BookingReceiptMinimumAmount != null
        ? Number(row.BookingReceiptMinimumAmount)
        : null,
    propertyType: (row.PropertyType as PropertyType) ?? null,
    pricingModel: (row.PricingModel as PricingModel) ?? null,
    price: row.Price != null ? Number(row.Price) : null,
    minMonthlyFee: row.MinMonthlyFee != null ? Number(row.MinMonthlyFee) : null,
    pricePerBooking: row.PricePerBooking != null ? Number(row.PricePerBooking) : null,
    listingLimit: row.ListingLimit != null ? Number(row.ListingLimit) : null,
    durationDays: row.DurationDays != null ? Number(row.DurationDays) : null,
    isActiveV2: row.IsActiveV2 != null ? Boolean(row.IsActiveV2) : null,
    bookingLimit: row.BookingLimit != null ? Number(row.BookingLimit) : null,
    lastModified: row.LastModified as string,
  };
}

export async function listAdminPlans(options?: {
  includeDeleted?: boolean;
}): Promise<AdminPlanRow[]> {
  let query = supabase.from('Plans').select('*').order('Key');

  if (!options?.includeDeleted) {
    query = query.eq('IsDeleted', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function upsertAdminPlan(payload: AdminPlanUpsertPayload): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_admin_plan', {
    p_payload: payload,
  });

  if (error) throw error;
  return data as string;
}
