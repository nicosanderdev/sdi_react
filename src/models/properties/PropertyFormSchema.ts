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
  type: z.enum(['house', 'apartment', 'commercial', 'land', 'other'], {
    errorMap: () => ({ message: 'El tipo de propiedad es requerido.' }),
  }),
  // end-purpose for this property (optional on create)
  propertyType: z
    .enum(['SummerRent', 'EventVenue', 'AnnualRent', 'RealEstate'])
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
  availableFrom: z.string().min(1, 'La fecha de disponibilidad es requerida.'),
  // price and status
  listingType: z
    .enum(['SummerRent', 'EventVenue', 'AnnualRent', 'RealEstate'])
    .optional() as z.ZodType<ListingType | undefined>,
  currency: z.enum(['USD', 'UYU', 'BRL', 'EUR', 'GBP']),
  salePrice: z.string().optional(),
  rentPrice: z.string().optional(),
  hasCommonExpenses: z.boolean(),
  commonExpensesValue: z.string().optional(),
  isElectricityIncluded: z.boolean(),
  isWaterIncluded: z.boolean(),
  isPriceVisible: z.boolean(),
  status: z.enum(['sale', 'rent', 'reserved', 'sold', 'unavailable']),
  isActive: z.boolean(),
  isPropertyVisible: z.boolean(),

  // --- Amenities ---
  amenities: z.array(z.string()).optional(),
});

export const propertyFormSchema = propertyFormBaseSchema
  .refine(data => data.salePrice || data.rentPrice, {
    message: 'Debes especificar un precio de venta o de alquiler.',
    path: ['salePrice'],
  })
  .refine(
    data => !data.hasCommonExpenses || (data.hasCommonExpenses && data.commonExpensesValue),
    {
      message: 'Debes especificar el monto de los gastos comunes.',
      path: ['commonExpensesValue'],
    }
  );

export type PropertyFormData = z.infer<typeof propertyFormSchema>;

