-- Calendar Sync Background Jobs Migration
-- Sets up pg_cron jobs for periodic calendar sync operations
--
-- NOTE: pg_cron extension will be enabled automatically if available
-- This migration will only create jobs if the extension is available

-- Try to enable pg_cron extension (may fail if not available or insufficient privileges)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
    -- Extension not available or can't be enabled, will be handled below
    NULL;
END $$;

DO $outer$
DECLARE
    v_job_id bigint;
    v_cron_available boolean := false;
BEGIN
    -- Check if pg_cron extension is available and cron schema exists
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron'
    ) INTO v_cron_available;
    
    IF v_cron_available THEN
        -- Periodic calendar sync (every 15 minutes)
        -- Unschedule if it already exists to avoid conflicts
        BEGIN
            SELECT cron.unschedule('calendar-sync-periodic') INTO v_job_id;
        EXCEPTION WHEN OTHERS THEN
            -- Job doesn't exist, continue
            NULL;
        END;
        
        SELECT cron.schedule(
            'calendar-sync-periodic',
            '*/15 * * * *', -- Every 15 minutes
            $sql$
            SELECT trigger_periodic_calendar_sync();
            $sql$
        ) INTO v_job_id;

        -- Webhook cleanup (daily at 2 AM)
        BEGIN
            SELECT cron.unschedule('calendar-webhook-cleanup') INTO v_job_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
        
        SELECT cron.schedule(
            'calendar-webhook-cleanup',
            '0 2 * * *', -- Daily at 2 AM
            $sql$
            SELECT cleanup_expired_webhooks();
            $sql$
        ) INTO v_job_id;

        -- Old sync jobs cleanup (weekly on Sunday at 3 AM)
        BEGIN
            SELECT cron.unschedule('calendar-sync-jobs-cleanup') INTO v_job_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
        
        SELECT cron.schedule(
            'calendar-sync-jobs-cleanup',
            '0 3 * * 0', -- Weekly on Sunday at 3 AM
            $sql$
            SELECT cleanup_old_sync_jobs(30); -- Delete jobs older than 30 days
            $sql$
        ) INTO v_job_id;
        
        RAISE NOTICE 'Calendar sync cron jobs scheduled successfully';
    ELSE
        RAISE NOTICE 'pg_cron extension not available. Cron jobs will not be scheduled. Enable pg_cron in Supabase dashboard to use scheduled calendar sync.';
    END IF;
END $outer$;

-- Function to unschedule jobs (for cleanup/migrations)
-- Uncomment and run if you need to remove jobs:
-- SELECT cron.unschedule('calendar-sync-periodic');
-- SELECT cron.unschedule('calendar-webhook-cleanup');
-- SELECT cron.unschedule('calendar-sync-jobs-cleanup');
