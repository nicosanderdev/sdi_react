import { z } from 'zod';
import type { ListingType, PropertyType } from './PropertyData';

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
  location: z.object({ lat: z.number(), lng: z.number() }).refine(
    val => val.lat !== -34.9011 || val.lng !== -56.1645,
    {
      message: 'Por favor, confirma la ubicación en el mapa.',
    }
  ),
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
  currency: z.enum(['USD', 'UYU', 'BRL', 'EUR', 'GBP']).optional(),
  salePrice: z.string().optional(),
  rentPrice: z.string().optional(),
  hasCommonExpenses: z.boolean().optional(),
  commonExpensesValue: z.string().optional(),
  isElectricityIncluded: z.boolean().optional(),
  isWaterIncluded: z.boolean().optional(),
  isPriceVisible: z.boolean().optional(),
  status: z.enum(['sale', 'rent', 'reserved', 'sold', 'unavailable']).optional(),
  isActive: z.boolean().optional(),
  isPropertyVisible: z.boolean().optional(),

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
});

export const propertyFormSchema = propertyFormBaseSchema;

export type PropertyFormData = z.infer<typeof propertyFormSchema>;

