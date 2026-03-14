-- iCal Sync Analytics Query
--
-- This query provides daily analytics for iCal sync operations.
-- Use this to monitor sync success rates and identify issues.
--
-- Platform Types:
-- 2 = Airbnb (iCal)
-- 3 = Booking.com (iCal)
-- 4 = Other iCal

SELECT
    DATE(sj."Created") as date,
    COUNT(*) as total_syncs,
    SUM(CASE WHEN sj."Status" = 2 THEN 1 ELSE 0 END) as successful_syncs,
    SUM(CASE WHEN sj."Status" = 3 THEN 1 ELSE 0 END) as failed_syncs,
    ROUND(
        (SUM(CASE WHEN sj."Status" = 2 THEN 1.0 ELSE 0 END) / COUNT(*)) * 100,
        2
    ) as success_rate_percentage,
    SUM(sj."EventsProcessed") as total_events_processed,
    AVG(EXTRACT(EPOCH FROM (sj."CompletedAt" - sj."StartedAt"))) as avg_sync_duration_seconds
FROM "SyncJobs" sj
JOIN "CalendarIntegrations" ci ON sj."CalendarIntegrationId" = ci."Id"
WHERE ci."PlatformType" IN (2, 3, 4)  -- iCal platform types only
    AND sj."Created" >= CURRENT_DATE - INTERVAL '30 days'  -- Last 30 days
GROUP BY DATE(sj."Created")
ORDER BY date DESC;

-- Additional query: Current sync status overview
SELECT
    ci."PlatformType",
    COUNT(*) as total_integrations,
    COUNT(CASE WHEN ci."IsActive" = true THEN 1 END) as active_integrations,
    COUNT(CASE WHEN ci."SyncStatus" = 0 THEN 1 END) as idle_integrations,
    COUNT(CASE WHEN ci."SyncStatus" = 1 THEN 1 END) as syncing_integrations,
    COUNT(CASE WHEN ci."SyncStatus" = 2 THEN 1 END) as error_integrations,
    MAX(ci."LastSyncAt") as latest_sync
FROM "CalendarIntegrations" ci
WHERE ci."PlatformType" IN (2, 3, 4)
    AND ci."IsDeleted" = false
GROUP BY ci."PlatformType"
ORDER BY ci."PlatformType";

-- Query: Recent sync failures for troubleshooting
SELECT
    sj."Id" as job_id,
    ci."CalendarName",
    ci."PlatformType",
    sj."Created",
    sj."Error",
    sj."EventsProcessed"
FROM "SyncJobs" sj
JOIN "CalendarIntegrations" ci ON sj."CalendarIntegrationId" = ci."Id"
WHERE ci."PlatformType" IN (2, 3, 4)
    AND sj."Status" = 3  -- Failed status
    AND sj."Created" >= CURRENT_DATE - INTERVAL '7 days'  -- Last 7 days
ORDER BY sj."Created" DESC
LIMIT 50;