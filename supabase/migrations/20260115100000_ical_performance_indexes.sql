-- iCal Performance Indexes Migration
--
-- Adds essential database indexes for iCal sync operations to improve query performance.
-- These indexes optimize the most common query patterns in iCal sync workflows.

-- Index for AvailabilityBlocks queries during iCal sync
-- Used when filtering by property, source type, and date ranges
-- Includes IsDeleted filter for better performance
CREATE INDEX IF NOT EXISTS "IX_AvailabilityBlocks_PropertyId_Source_Dates"
    ON "AvailabilityBlocks" ("EstatePropertyId", "Source", "StartDate", "EndDate")
    WHERE "IsDeleted" = false;

-- Index for CalendarIntegrations queries during sync scheduling
-- Used to find active iCal integrations that need syncing
-- Includes platform type filter for iCal-only operations
CREATE INDEX IF NOT EXISTS "IX_CalendarIntegrations_Platform_Active"
    ON "CalendarIntegrations" ("PlatformType", "IsActive", "LastSyncAt")
    WHERE "IsDeleted" = false;

-- Index for iCal URL lookups (for potential future features)
-- Used when validating or looking up iCal integrations by URL
CREATE INDEX IF NOT EXISTS "IX_CalendarIntegrations_ICalUrl"
    ON "CalendarIntegrations" ("ICalUrl")
    WHERE "ICalUrl" IS NOT NULL AND "IsDeleted" = false;

-- Index for ExternalCalendarEvents cleanup operations
-- Used when removing old external events during sync operations
CREATE INDEX IF NOT EXISTS "IX_ExternalCalendarEvents_Integration_LastModified"
    ON "ExternalCalendarEvents" ("CalendarIntegrationId", "LastModified")
    WHERE "IsDeleted" = false;

-- Index for SyncJobs monitoring and cleanup
-- Used for admin analytics queries and job cleanup operations
CREATE INDEX IF NOT EXISTS "IX_SyncJobs_Integration_Status_Created"
    ON "SyncJobs" ("CalendarIntegrationId", "Status", "Created");