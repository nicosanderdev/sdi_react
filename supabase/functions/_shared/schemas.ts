import { z } from 'https://esm.sh/zod@3.22.4'

// Common types
const uuidSchema = z.string().uuid()
const timestampSchema = z.string().datetime()

// Availability Blocks Schemas
export const AvailabilityBlockSchema = z.object({
  id: uuidSchema,
  estatePropertyId: uuidSchema,
  isAvailable: z.boolean(),
  startDate: timestampSchema,
  endDate: timestampSchema,
  recurrencePattern: z.record(z.any()).nullable().optional(),
  title: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional(),
  created: timestampSchema,
  createdBy: z.string().nullable().optional(),
  lastModified: timestampSchema,
  lastModifiedBy: z.string().nullable().optional()
})

export const CreateAvailabilityBlockRequestSchema = z.object({
  estatePropertyId: uuidSchema,
  isAvailable: z.boolean(),
  startDate: timestampSchema,
  endDate: timestampSchema,
  recurrencePattern: z.record(z.any()).nullable().optional(),
  title: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional()
})

export const UpdateAvailabilityBlockRequestSchema = z.object({
  isAvailable: z.boolean().optional(),
  startDate: timestampSchema.optional(),
  endDate: timestampSchema.optional(),
  recurrencePattern: z.record(z.any()).nullable().optional(),
  title: z.string().max(255).nullable().optional(),
  description: z.string().nullable().optional()
})

export const ListAvailabilityBlocksQuerySchema = z.object({
  propertyId: uuidSchema,
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  startDate: timestampSchema.optional(),
  endDate: timestampSchema.optional()
})

// Calendar Integrations Schemas
export const CalendarIntegrationSchema = z.object({
  id: uuidSchema,
  estatePropertyId: uuidSchema,
  platformType: z.number().int().min(0).max(1), // 0: Google Calendar, 1: Apple Calendar
  externalCalendarId: z.string().max(500),
  externalCalendarName: z.string().max(255).nullable().optional(),
  isActive: z.boolean(),
  lastSyncAt: timestampSchema.nullable().optional(),
  syncStatus: z.number().int().min(0).max(2), // 0: Idle, 1: Syncing, 2: Error
  created: timestampSchema,
  createdBy: z.string().nullable().optional(),
  lastModified: timestampSchema,
  lastModifiedBy: z.string().nullable().optional()
})

export const CreateCalendarIntegrationRequestSchema = z.object({
  estatePropertyId: uuidSchema,
  platformType: z.number().int().min(0).max(1),
  externalCalendarId: z.string().max(500),
  externalCalendarName: z.string().max(255).nullable().optional(),
  accessToken: z.string(), // Will be encrypted
  refreshToken: z.string().nullable().optional(),
  tokenExpiresAt: timestampSchema.nullable().optional()
})

export const ListCalendarIntegrationsQuerySchema = z.object({
  propertyId: uuidSchema
})

// Booking Validation Schemas
export const BookingValidationRequestSchema = z.object({
  propertyId: uuidSchema,
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestCount: z.number().int().min(1).default(1)
})

export const ConflictInfoSchema = z.object({
  type: z.enum(['availability_block', 'existing_booking', 'external_event']),
  id: uuidSchema,
  title: z.string(),
  startDate: timestampSchema,
  endDate: timestampSchema,
  description: z.string().nullable().optional()
})

export const BookingValidationResponseSchema = z.object({
  isValid: z.boolean(),
  conflicts: z.array(ConflictInfoSchema),
  totalConflicts: z.number().int().min(0)
})

// Calendar Sync Schemas
export const CalendarSyncRequestSchema = z.object({
  propertyId: uuidSchema,
  integrationId: uuidSchema.optional() // If not provided, sync all integrations for property
})

// Conflicts Schemas
export const ConflictsQuerySchema = z.object({
  propertyId: uuidSchema,
  startDate: timestampSchema.optional(),
  endDate: timestampSchema.optional()
})

export const ConflictsResponseSchema = z.object({
  availabilityBlocks: z.array(ConflictInfoSchema),
  bookings: z.array(ConflictInfoSchema),
  externalEvents: z.array(ConflictInfoSchema),
  totalConflicts: z.number().int().min(0)
})

// Pagination response schema
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      total: z.number().int().min(0),
      limit: z.number().int().min(1),
      offset: z.number().int().min(0),
      hasMore: z.boolean()
    })
  })

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.record(z.any()).optional()
})

// Type exports
export type AvailabilityBlock = z.infer<typeof AvailabilityBlockSchema>
export type CreateAvailabilityBlockRequest = z.infer<typeof CreateAvailabilityBlockRequestSchema>
export type UpdateAvailabilityBlockRequest = z.infer<typeof UpdateAvailabilityBlockRequestSchema>
export type ListAvailabilityBlocksQuery = z.infer<typeof ListAvailabilityBlocksQuerySchema>

export type CalendarIntegration = z.infer<typeof CalendarIntegrationSchema>
export type CreateCalendarIntegrationRequest = z.infer<typeof CreateCalendarIntegrationRequestSchema>
export type ListCalendarIntegrationsQuery = z.infer<typeof ListCalendarIntegrationsQuerySchema>

export type BookingValidationRequest = z.infer<typeof BookingValidationRequestSchema>
export type ConflictInfo = z.infer<typeof ConflictInfoSchema>
export type BookingValidationResponse = z.infer<typeof BookingValidationResponseSchema>

export type CalendarSyncRequest = z.infer<typeof CalendarSyncRequestSchema>

export type ConflictsQuery = z.infer<typeof ConflictsQuerySchema>
export type ConflictsResponse = z.infer<typeof ConflictsResponseSchema>

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

// Validation helper functions
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ')
      return { success: false, error: errorMessage }
    }
    return { success: false, error: 'Validation failed' }
  }
}
