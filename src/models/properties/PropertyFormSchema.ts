import { z } from 'zod';
import type { ListingType, PropertyType } from './PropertyData';

/** When `propertyType` is RealEstate, chooses sale listing vs annual rent listing. */
export const realEstateOfferModeSchema = z.enum(['sale', 'annual_rent']);
export type RealEstateOfferMode = z.infer<typeof realEstateOfferModeSchema>;

/** Listing row type for create flow from step 1 property type + RealEstate sub-choice. */
export function resolveCreationListingType(data: {
  propertyType?: PropertyType;
  realEstateOfferMode?: RealEstateOfferMode;
}): ListingType | undefined {
  const pt = data.propertyType;
  if (!pt) return undefined;
  if (pt === 'SummerRent') return 'SummerRent';
  if (pt === 'EventVenue') return 'EventVenue';
  if (pt === 'RealEstate') {
    return data.realEstateOfferMode === 'annual_rent' ? 'AnnualRent' : 'RealEstate';
  }
  return undefined;
}

export const rentPricePeriodSchema = z.enum(['PerNight', 'PerMonth']);
export type RentPricePeriod = z.infer<typeof rentPricePeriodSchema>;

export const propertySectionTypeSchema = z.enum(['SummerRent', 'EventVenue', 'RealEstate']);
export const propertySectionLayoutTypeSchema = z.enum(['split', 'carousel', 'stacked']);
export const propertySectionDisplayVariantSchema = z.enum(['default', 'compact', 'hero']);

export const propertyContentSectionSchema = z.object({
  name: z.string().min(1, 'El nombre de la sección es requerido.'),
  description: z.string().max(500, 'La descripción no puede exceder los 500 caracteres.').optional(),
  propertyType: propertySectionTypeSchema,
  layoutType: propertySectionLayoutTypeSchema.default('split'),
  displayVariant: propertySectionDisplayVariantSchema.default('default'),
  imageKeys: z.array(z.string()).default([]),
});

const locationBaseSchema = z.object({ lat: z.number(), lng: z.number() });

const strictCreateLocationSchema = locationBaseSchema.refine(
  val => val.lat !== -34.9011 || val.lng !== -56.1645,
  {
    message: 'Por favor, confirma la ubicación en el mapa.',
  }
);

export const propertyFormBaseSchema = z.object({
  // ESTATE PROPERTY
  // address
  streetName: z.string().min(5, 'La dirección debe tener al menos 5 caracteres.'),
  houseNumber: z.string().min(1, 'El número de casa es requerido.'),
  neighborhood: z.string().optional(),
  city: z.string().min(1, 'La ciudad es requerida.'),
  state: z.string().min(1, 'El estado/provincia es requerido.'),
  zipCode: z.string().min(1, 'El código postal es requerido.'),
  country: z.string().min(1, 'El país es requerido.'),
  location: locationBaseSchema,
  // description
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres.'),
  // end-purpose for this property (optional on create)
  propertyType: z
    .enum(['SummerRent', 'EventVenue', 'RealEstate'])
    .optional() as z.ZodType<PropertyType | undefined>,
  // structural / infrastructure
  areaValue: z.coerce.number().min(1, 'El área debe ser al menos 1.'),
  areaUnit: z.enum(['m²', 'ft²', 'yd²', 'acres', 'hectares', 'sq_km', 'sq_mi'], {
    errorMap: () => ({ message: 'La unidad de área es requerida.' }),
  }),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().min(0),
  hasGarage: z.boolean(),
  garageSpaces: z.coerce.number().int().min(0),
  hasLaundryRoom: z.boolean().optional(),
  hasPool: z.boolean().optional(),
  hasBalcony: z.boolean().optional(),
  isFurnished: z.boolean().optional(),
  capacity: z.coerce.number().int().min(1).optional(),

  // --- Values (Step 3) ---
  description: z.string().max(500, 'La descripción no puede exceder los 500 caracteres.').optional(),
  // price and publication fields are handled in later steps / extensions
  availableFrom: z.string().optional(),
  listingType: z
    .enum(['SummerRent', 'EventVenue', 'AnnualRent', 'RealEstate'])
    .optional() as z.ZodType<ListingType | undefined>,
  /** Only used when `propertyType` is RealEstate (step 5: venta vs alquiler anual). */
  realEstateOfferMode: realEstateOfferModeSchema.optional(),
  currency: z.enum(['USD', 'UYU', 'BRL', 'EUR', 'GBP']).optional(),
  salePrice: z.string().optional(),
  rentPrice: z.string().optional(),
  /** Dynamic pricing (SummerRent, EventVenue). */
  basePrice: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  longStayDiscountEnabled: z.boolean().optional(),
  longStayMinDays: z.coerce.number().int().min(1).optional(),
  longStayDiscountPercentage: z.coerce.number().min(0).max(100).optional(),
  /** Nightly/event vs monthly meaning for `RentPrice` (Listings.RentPricePeriod). */
  rentPricePeriod: rentPricePeriodSchema.optional(),
  hasCommonExpenses: z.boolean().optional(),
  commonExpensesValue: z.string().optional(),
  isElectricityIncluded: z.boolean().optional(),
  isWaterIncluded: z.boolean().optional(),
  isPriceVisible: z.boolean().optional(),
  status: z.enum(['sale', 'rent', 'reserved', 'sold', 'unavailable']).optional(),
  isActive: z.boolean().optional(),
  isPropertyVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  blockedForBooking: z.boolean().optional(),

  // --- Amenities ---
  amenities: z.array(z.string()).optional(),
  // --- Extension-specific fields (RealEstate, SummerRent, EventVenue) ---
  // RealEstateExtension-like fields
  allowsFinancing: z.boolean().optional(),
  isNewConstruction: z.boolean().optional(),
  hasMortgage: z.boolean().optional(),
  hoaFees: z.coerce.number().optional(),
  minContractMonths: z.coerce.number().int().optional(),
  requiresGuarantee: z.boolean().optional(),
  guaranteeType: z.string().optional(),
  allowsPets: z.boolean().optional(),
  // EventVenueExtension-like fields
  maxGuests: z.coerce.number().int().optional(),
  hasCatering: z.boolean().optional(),
  hasSoundSystem: z.boolean().optional(),
  closingHour: z.string().optional(),
  allowedEventsDescription: z.string().optional(),
  // SummerRentExtension-like fields
  minStayDays: z.coerce.number().int().optional(),
  maxStayDays: z.coerce.number().int().optional(),
  leadTimeDays: z.coerce.number().int().optional(),
  bufferDays: z.coerce.number().int().optional(),
  // Dynamic details sections for property detail pages.
  contentSections: z.array(propertyContentSectionSchema).default([]),
  // Edit flow: optional additive extension type.
  additionalExtensionType: z.enum(['SummerRent', 'EventVenue', 'RealEstate']).optional(),
});

export const propertyFormSchema = propertyFormBaseSchema;

export const propertyCreateSchema = propertyFormBaseSchema.extend({
  location: strictCreateLocationSchema,
});

/** Create wizard + admin create: publishing requires currency and the correct price column. */
export const propertyCreatePublishSchema = propertyCreateSchema
  .refine(
    data => {
      if (data.isActive !== true) return true;
      return !!resolveCreationListingType(data);
    },
    {
      message: 'Selecciona el tipo de propiedad antes de publicar.',
      path: ['propertyType'],
    }
  )
  .refine(
    data => {
      if (data.isActive !== true) return true;
      return !!data.currency;
    },
    {
      message: 'Para publicar, selecciona la moneda.',
      path: ['currency'],
    }
  )
  .refine(
    data => {
      if (data.isActive !== true) return true;
      if (resolveCreationListingType(data) !== 'RealEstate') return true;
      return !!String(data.salePrice ?? '').trim();
    },
    {
      message: 'Para publicar, ingresa el precio de venta.',
      path: ['salePrice'],
    }
  )
  .refine(
    data => {
      if (data.isActive !== true) return true;
      const lt = resolveCreationListingType(data);
      if (!lt || lt === 'RealEstate' || lt === 'AnnualRent') return true;
      if (lt === 'SummerRent' || lt === 'EventVenue') {
        return (
          !!String(data.basePrice ?? '').trim() &&
          !!String(data.minPrice ?? '').trim() &&
          !!String(data.maxPrice ?? '').trim()
        );
      }
      return !!String(data.rentPrice ?? '').trim();
    },
    {
      message: 'Para publicar, ingresa precio base, mínimo y máximo.',
      path: ['basePrice'],
    }
  )
  .refine(
    data => {
      if (data.isActive !== true) return true;
      const lt = resolveCreationListingType(data);
      if (lt !== 'SummerRent' && lt !== 'EventVenue') return true;
      const base = parseFloat(String(data.basePrice ?? ''));
      const min = parseFloat(String(data.minPrice ?? ''));
      const max = parseFloat(String(data.maxPrice ?? ''));
      if (Number.isNaN(base) || Number.isNaN(min) || Number.isNaN(max)) return true;
      return min <= base && base <= max && min <= max;
    },
    {
      message: 'El precio base debe estar entre el mínimo y el máximo.',
      path: ['basePrice'],
    }
  )
  .refine(
    data => {
      if (data.isActive !== true) return true;
      const lt = resolveCreationListingType(data);
      if (lt !== 'SummerRent' && lt !== 'EventVenue') return true;
      if (!data.longStayDiscountEnabled) return true;
      return (
        data.longStayMinDays != null &&
        data.longStayMinDays >= 1 &&
        data.longStayDiscountPercentage != null &&
        data.longStayDiscountPercentage > 0
      );
    },
    {
      message: 'Indica días mínimos y porcentaje de descuento por estadía larga.',
      path: ['longStayMinDays'],
    }
  );

export function usesDynamicListingPricing(
  listingType: ListingType | PropertyType | undefined
): boolean {
  return listingType === 'SummerRent' || listingType === 'EventVenue';
}

export type PropertyContentSectionFormData = z.infer<typeof propertyContentSectionSchema>;
export type PropertyFormData = z.infer<typeof propertyFormSchema>;

