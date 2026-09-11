// src/services/SupabaseHelpers.ts
import { supabase } from '../config/supabase';
import { ProfileData, UserCompany } from './ProfileService';
import { SubscriptionData } from '../models/subscriptions/SubscriptionData';
import { PlanData } from '../models/subscriptions/PlanData';
import { CompanyInfo, CompanyUser } from './CompanyService';
import { PropertyData, PublicProperty } from '../models/properties';
import type { ListingType } from '../models/properties/PropertyData';
import { PropertyImage, PropertyDocument, PropertyVideo, Amenity } from '../models/properties';
import { Message, MessageDetail, TabCounts } from './MessageService';
import { PlanKey } from '../models/subscriptions/PlanKey';

/**
 * Database row types for type-safe mapping
 */
interface MembersRow {
  Id: string;
  UserId: string;
  FirstName: string | null;
  LastName: string | null;
  Email: string | null;
  Title: string | null;
  AvatarUrl: string | null;
  Street: string | null;
  Street2: string | null;
  City: string | null;
  State: string | null;
  PostalCode: string | null;
  Country: string | null;
  Phone: string | null;
  PhonePrefix: string | null;
  EmailVerifiedAt: string | null;
  PhoneVerifiedAt: string | null;
  Role: string | null;
  IsDeleted: boolean;
  Created: string;
  CreatedBy: string | null;
  LastModified: string;
  LastModifiedBy: string | null;
}

interface CompanyMembersRow {
  Id: string;
  MemberId: string;
  CompanyId: string;
  Role: string | number;
  AddedBy: string;
  JoinedAt: string;
  IsDeleted: boolean;
}

interface CompaniesRow {
  Id: string;
  Name: string;
  BillingContactUserId: string;
  BillingEmail: string;
  CreatedAt: string;
  LogoUrl: string | null;
  BannerUrl: string | null;
  Description: string | null;
  Street: string | null;
  Street2: string | null;
  City: string | null;
  State: string | null;
  PostalCode: string | null;
  Country: string | null;
  Phone: string | null;
  IsDeleted: boolean;
  Created: string;
  CreatedBy: string | null;
  LastModified: string;
  LastModifiedBy: string | null;
}

interface SubscriptionsRow {
  Id: string;
  OwnerType: number;
  OwnerId: string;
  ProviderCustomerId: string | null;
  ProviderSubscriptionId: string | null;
  PlanId: string;
  Status: number;
  CurrentPeriodStart: string;
  CurrentPeriodEnd: string;
  CancelAtPeriodEnd: boolean;
  CreatedAt: string;
  UpdatedAt: string;
  CompanyId: string | null;
  IsDeleted: boolean;
  Created: string;
  CreatedBy: string | null;
  LastModified: string;
  LastModifiedBy: string | null;
}

interface PlansRow {
  Id: string;
  Key: number; // Database stores Key as integer: 0 = FREE, 1 = MANAGER_PRO, 2 = COMPANY_SMALL/COMPANY_UNLIMITED
  Name: string;
  MonthlyPrice: number;
  Currency: string;
  MaxProperties: number | null;
  MaxPublishedProperties: number | null;
  MaxUsers: number | null;
  MaxStorageMb: number | null;
  MaxPhotosPerProperty?: number | null;
  BillingCycle: number;
  IsActive: boolean;
  IsDeleted: boolean;
  Created: string;
  CreatedBy: string | null;
  LastModified: string;
  LastModifiedBy: string | null;
  BookingReceiptMinimumAmount?: number | null;
}

/**
 * Maps database integer Key value to PlanKey enum
 * Database stores: 0 = FREE, 1 = MANAGER_PRO, 2 = COMPANY_SMALL/COMPANY_UNLIMITED
 */
const intToPlanKey = (keyInt: number): PlanKey => {
    const mapping: Record<number, PlanKey> = {
        0: PlanKey.FREE,
        1: PlanKey.MANAGER_PRO, // Default to MANAGER_PRO for 1
        2: PlanKey.COMPANY_SMALL,
        4: PlanKey.COMPANY_UNLIMITED,
        5: PlanKey.COMPANY_FREE
    };
    return mapping[keyInt] ?? PlanKey.FREE;
};

interface OwnersRow {
  Id: string;
  OwnerType: 'member' | 'company';
  MemberId: string | null;
  CompanyId: string | null;
  IsDeleted: boolean;
  Created: string;
  CreatedBy: string | null;
  LastModified: string;
  LastModifiedBy: string | null;
}

interface EstatePropertiesRow {
  Id: string;
  StreetName: string;
  HouseNumber: string;
  Neighborhood: string | null;
  City: string;
  State: string;
  ZipCode: string;
  Country: string;
  LocationLatitude: number;
  LocationLongitude: number;
  Title: string;
  PropertyType: number;
  AreaValue: number;
  AreaUnit: number;
  Bedrooms: number;
  Bathrooms: number;
  HasGarage: boolean;
  GarageSpaces: number;
  /** References Owners.Id - unified ownership for members and companies */
  OwnerId: string;
  MainImageId: string | null;
  IsDeleted: boolean;
  /** Removed from DB in listing refactor; optional on client reads. */
  Created?: string;
  LastModified?: string;
  CreatedBy?: string | null;
  LastModifiedBy?: string | null;
}

interface EstatePropertyValuesRow {
  Id: string;
  EstatePropertyId: string;
  Description: string | null;
  AvailableFrom: string;
  Capacity: number;
  Currency: number;
  SalePrice: number | null;
  RentPrice: number | null;
  HasCommonExpenses: boolean;
  CommonExpensesValue: number | null;
  IsElectricityIncluded: boolean;
  IsWaterIncluded: boolean;
  IsPriceVisible: boolean;
  Status: number;
  IsActive: boolean;
  IsPropertyVisible: boolean;
  BlockedForBooking?: boolean;
  IsFeatured: boolean;
  IsDeleted: boolean;
  Created: string;
  LastModified: string;
  CreatedBy: string | null;
  LastModifiedBy: string | null;
}

interface PropertyImagesRow {
  Id: string;
  EstatePropertyId: string;
  Url: string;
  AltText: string | null;
  IsMain: boolean;
  IsPublic: boolean;
  FileName: string | null;
  IsDeleted: boolean;
  Created: string;
  LastModified: string;
  CreatedBy: string | null;
  LastModifiedBy: string | null;
}

interface PropertyDocumentsRow {
  Id: string;
  EstatePropertyId: string;
  Url: string;
  Name: string;
  FileName: string;
  IsPublic: boolean;
  IsDeleted: boolean;
  Created: string;
  LastModified: string;
  CreatedBy: string | null;
  LastModifiedBy: string | null;
}

interface PropertyVideosRow {
  Id: string;
  EstatePropertyId: string;
  Url: string;
  Title: string;
  Description: string | null;
  IsPublic: boolean;
  IsDeleted: boolean;
  Created: string;
  LastModified: string;
  CreatedBy: string | null;
  LastModifiedBy: string | null;
}

interface AmenitiesRow {
  Id: string;
  Name: string;
  IconId: string | null;
  IsDeleted: boolean;
  Created: string;
  LastModified: string;
  CreatedBy: string | null;
  LastModifiedBy: string | null;
}

interface EstatePropertyAmenityRow {
  EstatePropertyId: string;
  AmenityId: string;
  LocalizedDescriptions?: Record<string, string> | null;
  IsDeleted?: boolean;
  Created?: string;
  LastModified?: string;
  CreatedBy?: string | null;
  LastModifiedBy?: string | null;
}

function mapLocalizedDescriptions(
  raw: Record<string, unknown> | null | undefined
): import('../models/properties/Amenity').Amenity['descriptions'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<'en' | 'es' | 'pt', string>> = {};
  for (const lang of ['en', 'es', 'pt'] as const) {
    const v = raw[lang];
    if (typeof v === 'string' && v.trim()) out[lang] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mapEstatePropertyAmenityRows(
  epaSource: unknown
): import('../models/properties/Amenity').Amenity[] {
  const epaList = Array.isArray(epaSource) ? epaSource : epaSource ? [epaSource] : [];
  return epaList
    .filter((epa: any) => epa?.Amenities)
    .map((epa: EstatePropertyAmenityRow & { Amenities: AmenitiesRow }) => ({
      id: epa.Amenities.Id,
      name: epa.Amenities.Name,
      iconId: epa.Amenities.IconId || undefined,
      descriptions: mapLocalizedDescriptions(
        epa.LocalizedDescriptions as Record<string, unknown> | null | undefined
      ),
    }));
}

interface MessageThreadsRow {
  Id: string;
  Subject: string;
  PropertyId: string | null;
  CreatedAtUtc: string;
  LastMessageAtUtc: string;
  IsDeleted: boolean;
  Created: string;
  LastModified: string;
  CreatedBy: string | null;
  LastModifiedBy: string | null;
}

interface MessagesRow {
  Id: string;
  ThreadId: string;
  SenderId: string;
  Body: string;
  Snippet: string;
  CreatedAtUtc: string;
  InReplyToMessageId: string | null;
  IsDeleted: boolean;
  Created: string;
  LastModified: string;
  CreatedBy: string | null;
  LastModifiedBy: string | null;
}

interface MessageRecipientsRow {
  Id: string;
  MessageId: string;
  RecipientId: string;
  ReceivedAtUtc: string;
  IsRead: boolean;
  HasBeenRepliedToByRecipient: boolean;
  IsStarred: boolean;
  IsArchived: boolean;
  IsDeleted: boolean;
  Created: string;
  LastModified: string;
  CreatedBy: string | null;
  LastModifiedBy: string | null;
}

/**
 * Fetches a Member record by Supabase auth user ID
 */
export const getMemberByUserId = async (userId: string): Promise<MembersRow | null> => {
  try {
    const { data, error } = await supabase
      .from('Members')
      .select('*')
      .eq('UserId', userId)
      .eq('IsDeleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data;
  } catch (error: any) {
    console.error('Error fetching member by user ID:', error.message);
    throw error;
  }
};

/**
 * Maps a Members DB row to ProfileData interface
 */
export const mapDbToProfile = (
  member: MembersRow,
  userCompanies?: (CompanyMembersRow & { Companies: CompaniesRow })[]
): ProfileData => {
  const companies: UserCompany[] = userCompanies
    ?.filter(uc => !uc.IsDeleted && uc.Companies)
    .map(uc => ({
      id: uc.Companies.Id,
      name: uc.Companies.Name,
      role: uc.Role != null ? String(uc.Role) : undefined,
    })) || [];

  return {
    id: member.Id,
    firstName: member.FirstName || '',
    lastName: member.LastName || '',
    email: member.Email || '',
    phone: member.Phone || '',
    phonePrefix: member.PhonePrefix || '',
    emailVerified: !!member.EmailVerifiedAt,
    phoneVerified: !!member.PhoneVerifiedAt,
    title: member.Title || '',
    avatarUrl: member.AvatarUrl || undefined,
    address: {
      street: member.Street || '',
      street2: member.Street2 || '',
      city: member.City || '',
      state: member.State || '',
      postalCode: member.PostalCode || '',
      country: member.Country || ''
    },
    companies,
    role: member.Role ? String(member.Role).toLowerCase() : 'user'
  };
};

/**
 * Maps a Subscriptions DB row with Plans to SubscriptionData interface
 */
export const mapDbToSubscription = (subscription: SubscriptionsRow & { Plans: PlansRow }): SubscriptionData => {
  const plan: PlanData = {
    id: subscription.Plans.Id,
    key: intToPlanKey(subscription.Plans.Key),
    name: subscription.Plans.Name,
    monthlyPrice: subscription.Plans.MonthlyPrice,
    currency: subscription.Plans.Currency,
    maxProperties: subscription.Plans.MaxProperties ?? null,
    maxUsers: subscription.Plans.MaxUsers ?? null,
    maxStorageMb: subscription.Plans.MaxStorageMb ?? null,
    billingCycle: subscription.Plans.BillingCycle.toString(),
    isActive: subscription.Plans.IsActive,
    publishedProperties: subscription.Plans.MaxPublishedProperties ?? null,
    totalProperties: subscription.Plans.MaxProperties ?? null,
    bookingReceiptMinimumAmount: subscription.Plans.BookingReceiptMinimumAmount ?? undefined,
    maxPhotosPerProperty: subscription.Plans.MaxPhotosPerProperty ?? null
  };

  return {
    id: subscription.Id,
    ownerType: subscription.OwnerType.toString(),
    ownerId: subscription.OwnerId,
    providerCustomerId: subscription.ProviderCustomerId || '',
    providerSubscriptionId: subscription.ProviderSubscriptionId || '',
    planId: subscription.PlanId,
    plan,
    status: subscription.Status.toString(),
    currentPeriodStart: new Date(subscription.CurrentPeriodStart),
    currentPeriodEnd: new Date(subscription.CurrentPeriodEnd),
    cancelAtPeriodEnd: subscription.CancelAtPeriodEnd,
    createdAt: new Date(subscription.CreatedAt),
    updatedAt: new Date(subscription.UpdatedAt),
    propertyType: plan.propertyType,
    propertyTypes: plan.propertyType ? [plan.propertyType] : []
  };
};

/**
 * Maps a Companies DB row to CompanyInfo interface
 */
export const mapDbToCompany = (company: CompaniesRow): CompanyInfo => {
  return {
    id: company.Id,
    name: company.Name,
    billingEmail: company.BillingEmail || undefined,
    phone: company.Phone || undefined,
    description: company.Description || undefined,
    createdAt: company.CreatedAt,
    logoUrl: company.LogoUrl || undefined,
    bannerUrl: company.BannerUrl || undefined,
    address: company.Street ? {
      street: company.Street,
      street2: company.Street2 || '',
      city: company.City || '',
      state: company.State || '',
      postalCode: company.PostalCode || '',
      country: company.Country || ''
    } : undefined
  };
};

/**
 * Maps CompanyMembers + Members rows to CompanyUser interface
 */
export const mapDbToCompanyUser = (userCompany: CompanyMembersRow & { Members: MembersRow }): CompanyUser => {
  return {
    id: userCompany.Id,
    memberId: userCompany.Members.Id,
    firstName: userCompany.Members.FirstName || '',
    lastName: userCompany.Members.LastName || '',
    email: userCompany.Members.Email || '',
    role: mapRoleNumberToString(userCompany.Role),
    joinDate: userCompany.JoinedAt,
    avatarUrl: userCompany.Members.AvatarUrl || undefined
  };
};

/**
 * Maps role value from CompanyMembers to string role.
 * Supports both numeric (legacy) and string-based roles.
 */
export const mapRoleNumberToString = (role: number | string): string => {
  if (typeof role === 'string') {
    const normalized = role.trim().toLowerCase();
    if (normalized === 'admin') return 'Admin';
    if (normalized === 'manager') return 'Manager';
    if (normalized === 'member') return 'Member';

    // If it's a numeric string like "2" or "1", fall through to numeric mapping
    const parsed = parseInt(role, 10);
    if (!isNaN(parsed)) {
      role = parsed;
    } else {
      return 'Member';
    }
  }

  switch (role) {
    case 2:
      return 'Admin';
    case 1:
      return 'Manager';
    default:
      return 'Member';
  }
};

/**
 * Maps string role to role number for CompanyMembers (for legacy numeric storage).
 */
export const mapRoleStringToNumber = (roleString: string): number => {
  const normalized = roleString.trim().toLowerCase();
  if (normalized === 'admin') return 2;
  if (normalized === 'manager') return 1;
  if (normalized === 'member') return 0;

  const parsed = parseInt(roleString, 10);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Standardized error handling for Supabase operations
 */
export const handleSupabaseError = (error: any, operation: string): never => {
  console.error(`Supabase ${operation} error:`, error.message);

  // Map Supabase errors to consistent format
  if (error.code === 'PGRST116') {
    throw new Error(`No data found for ${operation}`);
  }

  throw new Error(`${operation} failed: ${error.message}`);
};

/**
 * Gets the current authenticated user's ID
 */
export const getCurrentUserId = async (user?: any): Promise<string> => {
  // If user is provided from AuthContext, use it to avoid API call
  if (user?.id) {
    return user.id;
  }

  // Fallback to API call if no user provided
  const { data: { user: authUser }, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Authentication error: ${error.message}`);
  }

  if (!authUser) {
    throw new Error('No authenticated user found');
  }

  return authUser.id;
};

/**
 * Get current user from AuthContext or fallback to API
 * This is a synchronous version that avoids API calls when possible
 */
export const getCurrentUser = (user?: any) => {
  return user || null;
};

/**
 * Parses period string to date range (matches SQL parse_period function)
 */
export const parsePeriod = (period: string): { startDate: Date; endDate: Date } => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (period.toLowerCase()) {
    case 'last7days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last30days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last90days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'thisyear':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      // Default to last 30 days
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  return { startDate, endDate };
};

/**
 * Fills date range with zero counts for missing dates (used for chart data)
 */
export const fillDateRange = (
  startDate: Date,
  endDate: Date,
  dateFormat: (date: Date) => string,
  existingData: { date: string; count: number }[]
): { date: string; count: number }[] => {
  const existingMap = new Map(existingData.map(item => [item.date, item.count]));
  const filledData: { date: string; count: number }[] = [];

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = dateFormat(currentDate);
    filledData.push({
      date: dateKey,
      count: existingMap.get(dateKey) || 0
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return filledData;
};

// PropertyCategory mapping (DB enum -> UI string)
const propertyCategoryDbToUi: { [key: string]: string } = {
  Casa: 'house',
  Apartamento: 'apartment',
  Terreno: 'land',
  Chacra: 'small_farm',
  Campo: 'farm',
};

// Enum reverse mappings (DB integer -> UI string). Kept for RPCs that still use integers.
const propertyTypeMapReverse: { [key: number]: string } = {
  0: 'house',
  1: 'apartment',
  2: 'land',
  3: 'small_farm',
  4: 'farm',
};

const areaUnitMapReverse: { [key: number]: string } = {
  0: 'm²', 1: 'ft²', 2: 'yd²', 3: 'acres', 4: 'hectares', 5: 'sq_km', 6: 'sq_mi'
};

const currencyMapReverse: { [key: number]: string } = {
  0: 'USD', 1: 'UYU', 2: 'BRL', 3: 'EUR', 4: 'GBP'
};

const statusMapReverse: { [key: number]: string } = {
  0: 'sale', 1: 'rent', 2: 'reserved', 3: 'sold', 4: 'unavailable'
};

// Forward mappings for consistency (UI string -> integer)
export const propertyTypeMapForward: { [key: string]: number } = {
  house: 0,
  apartment: 1,
  land: 2,
  small_farm: 3,
  farm: 4,
};

export const areaUnitMapForward: { [key: string]: number } = {
  'm²': 0, 'ft²': 1, 'yd²': 2, 'acres': 3, 'hectares': 4, 'sq_km': 5, 'sq_mi': 6
};

export const currencyMapForward: { [key: string]: number } = {
  USD: 0, UYU: 1, BRL: 2, EUR: 3, GBP: 4
};

export const statusMapForward: { [key: string]: number } = {
  sale: 0, rent: 1, reserved: 2, sold: 3, unavailable: 4
};

/**
 * Maps database rows to PropertyData interface (full property data for owners)
 */
function firstRelationRow<T>(rel: T | T[] | null | undefined): T | undefined {
  if (rel == null) return undefined;
  return Array.isArray(rel) ? rel[0] : rel;
}

export const mapDbToPropertyData = (
  property: EstatePropertiesRow & {
    EstatePropertyValues: EstatePropertyValuesRow[];
    PropertyImages?: PropertyImagesRow[];
    PropertyDocuments?: PropertyDocumentsRow[];
    PropertyVideos?: PropertyVideosRow[];
    EstatePropertyAmenities?: (EstatePropertyAmenityRow & { Amenities: AmenitiesRow })[];
  }
): PropertyData => {
  const raw = property as any;
  const listingRows: any[] = Array.isArray(raw.Listings) ? raw.Listings : [];
  const activeListingRows = listingRows.filter((l: any) => !l.IsDeleted);
  const activeListingTypes = [...new Set(activeListingRows.map((l: any) => l.ListingType as string))] as ListingType[];
  const sortedForFeatured = [...activeListingRows].sort((a: any, b: any) => {
    if (!!a.IsFeatured !== !!b.IsFeatured) return a.IsFeatured ? -1 : 1;
    return new Date(b.Created || 0).getTime() - new Date(a.Created || 0).getTime();
  });
  const featuredListing = sortedForFeatured[0];
  const listingType = featuredListing?.ListingType as ListingType | undefined;

  const re = firstRelationRow(raw.RealEstateExtension);
  const sr = firstRelationRow(raw.SummerRentExtension);
  const ev = firstRelationRow(raw.EventVenueExtension);

  const extensionFormFields: Record<string, unknown> = {};
  if (re) {
    extensionFormFields.allowsFinancing = !!re.AllowsFinancing;
    extensionFormFields.isNewConstruction = !!re.IsNewConstruction;
    extensionFormFields.hasMortgage = !!re.HasMortgage;
    extensionFormFields.hoaFees = re.HoaFees != null ? Number(re.HoaFees) : undefined;
    extensionFormFields.minContractMonths =
      re.MinContractMonths != null && re.MinContractMonths !== '' ? Number(re.MinContractMonths) : undefined;
    extensionFormFields.requiresGuarantee = !!re.RequiresGuarantee;
    extensionFormFields.guaranteeType = re.GuaranteeType ?? '';
    extensionFormFields.allowsPets = !!re.AllowsPets;
  }
  if (sr) {
    extensionFormFields.minStayDays =
      sr.MinStayDays != null && sr.MinStayDays !== '' ? Number(sr.MinStayDays) : undefined;
    extensionFormFields.maxStayDays =
      sr.MaxStayDays != null && sr.MaxStayDays !== '' ? Number(sr.MaxStayDays) : undefined;
    extensionFormFields.leadTimeDays =
      sr.LeadTimeDays != null && sr.LeadTimeDays !== '' ? Number(sr.LeadTimeDays) : undefined;
    extensionFormFields.bufferDays =
      sr.BufferDays != null && sr.BufferDays !== '' ? Number(sr.BufferDays) : undefined;
  }
  if (ev) {
    extensionFormFields.maxGuests =
      ev.MaxGuests != null && ev.MaxGuests !== '' ? Number(ev.MaxGuests) : undefined;
    extensionFormFields.hasCatering = !!ev.HasCatering;
    extensionFormFields.hasSoundSystem = !!ev.HasSoundSystem;
    extensionFormFields.closingHour = ev.ClosingHour ?? '';
    extensionFormFields.allowedEventsDescription = ev.AllowedEventsDescription ?? '';
  }

  // Get the latest property values (most recent)
  const latestValues = property.EstatePropertyValues?.sort(
    (a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime()
  )[0];

  const propertyImages: PropertyImage[] = property.PropertyImages?.map(img => ({
    id: img.Id,
    url: img.Url,
    altText: img.AltText || '',
    isMain: img.IsMain,
    estatePropertyId: img.EstatePropertyId,
    isPublic: img.IsPublic,
    fileName: img.FileName || ''
  })) || [];

  const propertyDocuments: PropertyDocument[] = property.PropertyDocuments?.map(doc => ({
    id: doc.Id,
    url: doc.Url,
    name: doc.Name,
    estatePropertyId: doc.EstatePropertyId,
    fileName: doc.FileName,
    isPublic: doc.IsPublic
  })) || [];

  const propertyVideos: PropertyVideo[] = property.PropertyVideos?.map(video => ({
    id: video.Id,
    title: video.Title,
    description: video.Description || '',
    url: video.Url,
    estatePropertyId: video.EstatePropertyId,
    isPublic: video.IsPublic
  })) || [];

  const epaSource =
    raw.EstatePropertyAmenity ?? property.EstatePropertyAmenities ?? [];
  const amenities: Amenity[] = mapEstatePropertyAmenityRows(epaSource);

  return {
    id: property.Id,
    streetName: property.StreetName,
    houseNumber: property.HouseNumber,
    neighborhood: property.Neighborhood || undefined,
    city: property.City,
    state: property.State,
    zipCode: property.ZipCode,
    country: property.Country,
    location: {
      lat: property.LocationLatitude,
      lng: property.LocationLongitude
    },
    // Title lives on Listings (EstateProperties has no Title column).
    title: featuredListing?.Title ?? '',
    type: (propertyCategoryDbToUi[(property as any)?.RealEstateExtension?.Category] ||
      propertyTypeMapReverse[(property as any).Type] ||
      'house') as 'house' | 'apartment' | 'land' | 'small_farm' | 'farm',
    areaValue: property.AreaValue,
    areaUnit: (areaUnitMapReverse[property.AreaUnit] || 'm²') as 'm²' | 'ft²' | 'yd²' | 'acres' | 'hectares' | 'sq_km' | 'sq_mi',
    bedrooms: property.Bedrooms,
    bathrooms: property.Bathrooms,
    hasGarage: property.HasGarage,
    garageSpaces: property.GarageSpaces,
    mainImageId: property.MainImageId || undefined,
    propertyImages,
    propertyDocuments,
    propertyVideos,
    amenities,
    description: featuredListing?.Description || latestValues?.Description || undefined,
    availableFrom: latestValues ? new Date(latestValues.AvailableFrom) : new Date(),
    availableFromText: latestValues ? new Date(latestValues.AvailableFrom).toLocaleDateString() : '',
    ownerId: property.OwnerId,
    currency: (currencyMapReverse[latestValues?.Currency || 0] || 'USD') as 'USD' | 'UYU' | 'BRL' | 'EUR' | 'GBP',
    salePrice: latestValues?.SalePrice?.toString(),
    rentPrice: latestValues?.RentPrice?.toString(),
    hasCommonExpenses: latestValues?.HasCommonExpenses || false,
    commonExpensesValue: latestValues?.CommonExpensesValue?.toString(),
    isElectricityIncluded: latestValues?.IsElectricityIncluded || false,
    isWaterIncluded: latestValues?.IsWaterIncluded || false,
    isPriceVisible: latestValues?.IsPriceVisible || true,
    status: (statusMapReverse[latestValues?.Status || 0] || 'sale') as 'sale' | 'rent' | 'reserved' | 'sold' | 'unavailable',
    isActive: latestValues?.IsActive || true,
    isPropertyVisible: latestValues?.IsPropertyVisible || true,
    blockedForBooking: latestValues?.BlockedForBooking ?? false,
    created: (() => {
      const ep = property as EstatePropertiesRow & { Created?: string };
      if (ep.Created) return new Date(ep.Created);
      const times = activeListingRows
        .map((l: any) => (l?.Created ? new Date(l.Created).getTime() : NaN))
        .filter((t: number) => !Number.isNaN(t));
      if (times.length > 0) return new Date(Math.min(...times));
      return new Date();
    })(),
    listings: activeListingRows.map((l: any) => ({
      id: l.Id,
      listingType: l.ListingType,
      isFeatured: !!l.IsFeatured,
    })),
    activeListingTypes,
    listingType,
    hasSummerRentExtension: !!sr,
    ...extensionFormFields,
  } as PropertyData;
};

/**
 * Maps database rows to PublicProperty interface (limited data for public viewing)
 */
interface ListingsRowLite {
  Id: string;
  ListingType?: string;
  Title?: string;
  Description?: string;
  SalePrice?: number | null;
  RentPrice?: number | null;
  BasePrice?: number | null;
  MinPrice?: number | null;
  MaxPrice?: number | null;
  LongStayDiscountEnabled?: boolean;
  LongStayMinDays?: number | null;
  LongStayDiscountPercentage?: number | null;
  Currency?: number;
  IsElectricityIncluded?: boolean;
  IsWaterIncluded?: boolean;
  BlockedForBooking?: boolean;
  IsFeatured?: boolean;
  IsDeleted?: boolean;
}

function pickFeaturedListing(raw: ListingsRowLite | ListingsRowLite[] | undefined): ListingsRowLite | undefined {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return (
    rows.find(l => l.IsFeatured && !l.IsDeleted) ??
    rows.find(l => !l.IsDeleted) ??
    rows[0]
  );
}

export const mapDbToPublicProperty = (
  property: EstatePropertiesRow & {
    EstatePropertyValues?: EstatePropertyValuesRow[];
    Listings?: ListingsRowLite | ListingsRowLite[];
    PropertyImages?: PropertyImagesRow[];
    PropertyVideos?: PropertyVideosRow[];
    EstatePropertyAmenities?: (EstatePropertyAmenityRow & { Amenities: AmenitiesRow })[];
  }
): PublicProperty => {
  const latestValues = property.EstatePropertyValues?.sort(
    (a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime()
  )[0];
  const listing = pickFeaturedListing(property.Listings);

  const propertyImages: PropertyImage[] = property.PropertyImages?.map(img => ({
    id: img.Id,
    url: img.Url,
    altText: img.AltText || '',
    isMain: img.IsMain,
    estatePropertyId: img.EstatePropertyId,
    isPublic: img.IsPublic,
    fileName: img.FileName || ''
  })) || [];

  const propertyVideos: PropertyVideo[] = property.PropertyVideos?.map(video => ({
    id: video.Id,
    title: video.Title,
    description: video.Description || '',
    url: video.Url,
    estatePropertyId: video.EstatePropertyId,
    isPublic: video.IsPublic
  })) || [];

  const epaSource =
    (property as any).EstatePropertyAmenity ??
    property.EstatePropertyAmenities ??
    [];
  const amenities: Amenity[] = mapEstatePropertyAmenityRows(epaSource);

  return {
    id: property.Id,
    streetName: property.StreetName,
    houseNumber: property.HouseNumber,
    neighborhood: property.Neighborhood || undefined,
    city: property.City,
    state: property.State,
    zipCode: property.ZipCode,
    country: property.Country,
    location: {
      lat: property.LocationLatitude,
      lng: property.LocationLongitude
    },
    title: listing?.Title ?? '',
    type:
      propertyCategoryDbToUi[(property as any)?.RealEstateExtension?.Category] ||
      propertyTypeMapReverse[(property as any).Type] ||
      'house',
    areaValue: property.AreaValue,
    areaUnit: property.AreaUnit === 0 ? 'sqm' : 'sqft', // Simplified for public view
    bedrooms: property.Bedrooms,
    bathrooms: property.Bathrooms,
    hasGarage: property.HasGarage,
    garageSpaces: property.GarageSpaces,
    propertyImages,
    propertyVideos,
    amenities,
    mainImageId: property.MainImageId || '',
    description: listing?.Description ?? latestValues?.Description ?? '',
    salePrice: listing?.SalePrice ?? latestValues?.SalePrice ?? undefined,
    rentPrice:
      listing?.RentPrice ??
      listing?.BasePrice ??
      latestValues?.RentPrice ??
      undefined,
    basePrice: listing?.BasePrice ?? listing?.RentPrice ?? undefined,
    minPrice: listing?.MinPrice ?? undefined,
    maxPrice: listing?.MaxPrice ?? undefined,
    longStayDiscountEnabled: listing?.LongStayDiscountEnabled ?? false,
    longStayMinDays: listing?.LongStayMinDays ?? null,
    longStayDiscountPercentage:
      listing?.LongStayDiscountPercentage != null
        ? Number(listing.LongStayDiscountPercentage)
        : null,
    listingId: listing?.Id,
    listingType: listing?.ListingType,
    currency: (currencyMapReverse[listing?.Currency ?? latestValues?.Currency ?? 0] ||
      'USD') as 'USD' | 'EUR' | 'GBP',
    isElectricityIncluded:
      listing?.IsElectricityIncluded ?? latestValues?.IsElectricityIncluded ?? false,
    isWaterIncluded: listing?.IsWaterIncluded ?? latestValues?.IsWaterIncluded ?? false,
    ownerId: property.OwnerId,
    blockedForBooking: listing?.BlockedForBooking ?? latestValues?.BlockedForBooking ?? false,
  };
};

/**
 * Maps database Message row to Message interface
 */
export const mapDbToMessage = (
  messageRow: MessagesRow & {
    MessageThreads?: MessageThreadsRow;
    Members?: MembersRow;
    MessageRecipients?: MessageRecipientsRow[];
  }
): Message => {
  const thread = messageRow.MessageThreads;
  const sender = messageRow.Members;
  const recipient = messageRow.MessageRecipients?.[0]; // First recipient for basic mapping

  return {
    id: messageRow.Id,
    threadId: messageRow.ThreadId,
    senderId: messageRow.SenderId,
    senderName: sender ? `${sender.FirstName || ''} ${sender.LastName || ''}`.trim() || sender.FirstName || '' : '',
    senderEmail: sender?.Email || undefined,
    recipientId: recipient?.RecipientId,
    propertyId: thread?.PropertyId || undefined,
    propertyTitle: undefined, // Would need to join with EstateProperties
    subject: thread?.Subject || '',
    snippet: messageRow.Snippet,
    createdAt: messageRow.CreatedAtUtc,
    isRead: recipient?.IsRead || false,
    isReplied: recipient?.HasBeenRepliedToByRecipient || false,
    isStarred: recipient?.IsStarred || false,
    isArchived: recipient?.IsArchived || false,
  };
};

/**
 * Maps database Message row to MessageDetail interface
 */
export const mapDbToMessageDetail = (
  messageRow: MessagesRow & {
    MessageThreads?: MessageThreadsRow;
    Members?: MembersRow;
    MessageRecipients?: MessageRecipientsRow[];
  }
): MessageDetail => {
  const baseMessage = mapDbToMessage(messageRow);

  return {
    ...baseMessage,
    fullBody: messageRow.Body,
  };
};

/**
 * Maps database rows to TabCounts interface
 */
export const mapDbToTabCounts = (counts: {
  inbox: number;
  starred: number;
  replied: number;
  archived: number;
  sent: number;
  trash: number;
}): TabCounts => {
  return {
    inbox: counts.inbox,
    starred: counts.starred,
    replied: counts.replied,
    archived: counts.archived,
    sent: counts.sent,
    trash: counts.trash,
  };
};