-- Calendar Integration Schema Migration
-- Implements database schema for calendar integration system including availability blocks, calendar integrations, external events, and bookings

-- AvailabilityBlocks table - Manages property availability/unavailability periods with recurrence support
CREATE TABLE IF NOT EXISTS "public"."AvailabilityBlocks" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "EstatePropertyId" "uuid" NOT NULL,
    "IsAvailable" boolean NOT NULL,
    "StartDate" timestamp with time zone NOT NULL,
    "EndDate" timestamp with time zone NOT NULL,
    "RecurrencePattern" "jsonb",
    "BlockType" integer NOT NULL DEFAULT 0, -- 0: availability, 1: booking, 2: owner_block, 3: external_block
    "Source" character varying(50) DEFAULT 'internal', -- 'internal', 'google_calendar', 'ical'
    "ExternalEventId" character varying(500), -- ID from external calendar
    "Title" character varying(255),
    "Description" "text",
    "IsReadOnly" boolean NOT NULL DEFAULT false, -- External blocks are read-only
    "ConflictFlagged" boolean NOT NULL DEFAULT false, -- True if conflicts with internal booking
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" "text",
    CONSTRAINT "PK_AvailabilityBlocks" PRIMARY KEY ("Id"),
    CONSTRAINT "CHK_AvailabilityBlocks_DateRange" CHECK ("StartDate" < "EndDate"),
    CONSTRAINT "CHK_AvailabilityBlocks_BlockType" CHECK ("BlockType" IN (0, 1, 2, 3))
);

ALTER TABLE "public"."AvailabilityBlocks" OWNER TO "postgres";


-- CalendarIntegrations table - Stores calendar platform connections (Google Calendar, Apple Calendar)
CREATE TABLE IF NOT EXISTS "public"."CalendarIntegrations" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "EstatePropertyId" "uuid" NOT NULL,
    "PlatformType" integer NOT NULL CHECK ("PlatformType" IN (0, 1)), -- 0: Google Calendar, 1: Apple Calendar
    "ExternalCalendarId" character varying(500) NOT NULL,
    "ExternalCalendarName" character varying(255),
    "AccessToken" "text" NOT NULL, -- Encrypted OAuth access token
    "RefreshToken" "text", -- Encrypted OAuth refresh token
    "TokenExpiresAt" timestamp with time zone,
    "IsActive" boolean NOT NULL DEFAULT true,
    "LastSyncAt" timestamp with time zone,
    "SyncStatus" integer NOT NULL DEFAULT 0, -- 0: Idle, 1: Syncing, 2: Error
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" "text",
    CONSTRAINT "PK_CalendarIntegrations" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_CalendarIntegrations_Property_Platform" UNIQUE ("EstatePropertyId", "PlatformType", "ExternalCalendarId")
);

ALTER TABLE "public"."CalendarIntegrations" OWNER TO "postgres";


-- ExternalCalendarEvents table - Mirrors external calendar events without overriding internal logic
CREATE TABLE IF NOT EXISTS "public"."ExternalCalendarEvents" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "CalendarIntegrationId" "uuid" NOT NULL,
    "ExternalEventId" character varying(500) NOT NULL,
    "ExternalEventData" "jsonb" NOT NULL, -- Full external event data for reference
    "Title" character varying(500),
    "Description" "text",
    "StartDate" timestamp with time zone NOT NULL,
    "EndDate" timestamp with time zone NOT NULL,
    "IsAllDay" boolean NOT NULL DEFAULT false,
    "Location" character varying(500),
    "LastSyncedAt" timestamp with time zone NOT NULL DEFAULT now(),
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" "text",
    CONSTRAINT "PK_ExternalCalendarEvents" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_ExternalCalendarEvents_Integration_EventId" UNIQUE ("CalendarIntegrationId", "ExternalEventId"),
    CONSTRAINT "CHK_ExternalCalendarEvents_DateRange" CHECK ("StartDate" <= "EndDate")
);

ALTER TABLE "public"."ExternalCalendarEvents" OWNER TO "postgres";


-- Bookings table - Manages property bookings/reservations
CREATE TABLE IF NOT EXISTS "public"."Bookings" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "EstatePropertyId" "uuid" NOT NULL,
    "GuestId" "uuid" NOT NULL, -- References Members table
    "CheckInDate" date NOT NULL,
    "CheckOutDate" date NOT NULL,
    "Status" integer NOT NULL DEFAULT 0, -- 0: Pending, 1: Confirmed, 2: Cancelled, 3: Completed, 4: NoShow
    "ValidationStatus" integer NOT NULL DEFAULT 0, -- 0: Pending, 1: Valid, 2: Invalid, 3: Overridden
    "HasConflict" boolean NOT NULL DEFAULT false,
    "ConflictReason" "text",
    "GuestCount" integer NOT NULL DEFAULT 1,
    "TotalAmount" numeric,
    "Currency" integer NOT NULL DEFAULT 0, -- 0: USD, 1: UYU, 2: BRL, 3: EUR, 4: GBP
    "Notes" "text",
    "BookingSource" character varying(100), -- 'internal', 'airbnb', 'booking.com', etc.
    "ExternalBookingId" character varying(255), -- For external platform bookings
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" "text",
    CONSTRAINT "PK_Bookings" PRIMARY KEY ("Id"),
    CONSTRAINT "CHK_Bookings_DateRange" CHECK ("CheckInDate" < "CheckOutDate"),
    CONSTRAINT "CHK_Bookings_GuestCount" CHECK ("GuestCount" > 0)
);

ALTER TABLE "public"."Bookings" OWNER TO "postgres";


-- SyncJobs table - Tracks sync job execution history
CREATE TABLE IF NOT EXISTS "public"."SyncJobs" (
    "Id" "uuid" NOT NULL DEFAULT gen_random_uuid(),
    "CalendarIntegrationId" "uuid" NOT NULL,
    "JobType" integer NOT NULL DEFAULT 0, -- 0: manual, 1: scheduled, 2: webhook
    "Status" integer NOT NULL DEFAULT 0, -- 0: pending, 1: running, 2: completed, 3: failed
    "StartedAt" timestamp with time zone,
    "CompletedAt" timestamp with time zone,
    "Error" "text",
    "EventsProcessed" integer DEFAULT 0,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" "text",
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" "text",
    CONSTRAINT "PK_SyncJobs" PRIMARY KEY ("Id"),
    CONSTRAINT "CHK_SyncJobs_JobType" CHECK ("JobType" IN (0, 1, 2)),
    CONSTRAINT "CHK_SyncJobs_Status" CHECK ("Status" IN (0, 1, 2, 3))
);

ALTER TABLE "public"."SyncJobs" OWNER TO "postgres";


-- Add calendar configuration columns to EstateProperties table
ALTER TABLE "public"."EstateProperties"
ADD COLUMN IF NOT EXISTS "MinStayDays" integer,
ADD COLUMN IF NOT EXISTS "MaxStayDays" integer,
ADD COLUMN IF NOT EXISTS "LeadTimeDays" integer,
ADD COLUMN IF NOT EXISTS "BufferDays" integer;


-- Foreign Key Relationships

-- AvailabilityBlocks foreign keys
ALTER TABLE ONLY "public"."AvailabilityBlocks"
    ADD CONSTRAINT "FK_AvailabilityBlocks_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;

-- CalendarIntegrations foreign keys
ALTER TABLE ONLY "public"."CalendarIntegrations"
    ADD CONSTRAINT "FK_CalendarIntegrations_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;

-- ExternalCalendarEvents foreign keys
ALTER TABLE ONLY "public"."ExternalCalendarEvents"
    ADD CONSTRAINT "FK_ExternalCalendarEvents_CalendarIntegrations_CalendarIntegrationId" FOREIGN KEY ("CalendarIntegrationId") REFERENCES "public"."CalendarIntegrations"("Id") ON DELETE CASCADE;

-- Bookings foreign keys
ALTER TABLE ONLY "public"."Bookings"
    ADD CONSTRAINT "FK_Bookings_EstateProperties_EstatePropertyId" FOREIGN KEY ("EstatePropertyId") REFERENCES "public"."EstateProperties"("Id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."Bookings"
    ADD CONSTRAINT "FK_Bookings_Members_GuestId" FOREIGN KEY ("GuestId") REFERENCES "public"."Members"("Id") ON DELETE CASCADE;

-- SyncJobs foreign keys
ALTER TABLE ONLY "public"."SyncJobs"
    ADD CONSTRAINT "FK_SyncJobs_CalendarIntegrations_CalendarIntegrationId" FOREIGN KEY ("CalendarIntegrationId") REFERENCES "public"."CalendarIntegrations"("Id") ON DELETE CASCADE;


-- Performance Indexes

-- AvailabilityBlocks indexes
CREATE INDEX IF NOT EXISTS "IX_AvailabilityBlocks_EstatePropertyId" ON "public"."AvailabilityBlocks" ("EstatePropertyId");
CREATE INDEX IF NOT EXISTS "IX_AvailabilityBlocks_StartDate" ON "public"."AvailabilityBlocks" ("StartDate");
CREATE INDEX IF NOT EXISTS "IX_AvailabilityBlocks_EndDate" ON "public"."AvailabilityBlocks" ("EndDate");
CREATE INDEX IF NOT EXISTS "IX_AvailabilityBlocks_IsAvailable" ON "public"."AvailabilityBlocks" ("IsAvailable");
-- GIST index for date range queries using tstzrange
CREATE INDEX IF NOT EXISTS "IX_AvailabilityBlocks_DateRange" ON "public"."AvailabilityBlocks" USING gist (tstzrange("StartDate", "EndDate"));

-- CalendarIntegrations indexes
CREATE INDEX IF NOT EXISTS "IX_CalendarIntegrations_EstatePropertyId" ON "public"."CalendarIntegrations" ("EstatePropertyId");
CREATE INDEX IF NOT EXISTS "IX_CalendarIntegrations_PlatformType" ON "public"."CalendarIntegrations" ("PlatformType");
CREATE INDEX IF NOT EXISTS "IX_CalendarIntegrations_IsActive" ON "public"."CalendarIntegrations" ("IsActive");
CREATE INDEX IF NOT EXISTS "IX_CalendarIntegrations_LastSyncAt" ON "public"."CalendarIntegrations" ("LastSyncAt");

-- ExternalCalendarEvents indexes
CREATE INDEX IF NOT EXISTS "IX_ExternalCalendarEvents_CalendarIntegrationId" ON "public"."ExternalCalendarEvents" ("CalendarIntegrationId");
CREATE INDEX IF NOT EXISTS "IX_ExternalCalendarEvents_StartDate" ON "public"."ExternalCalendarEvents" ("StartDate");
CREATE INDEX IF NOT EXISTS "IX_ExternalCalendarEvents_EndDate" ON "public"."ExternalCalendarEvents" ("EndDate");
CREATE INDEX IF NOT EXISTS "IX_ExternalCalendarEvents_LastSyncedAt" ON "public"."ExternalCalendarEvents" ("LastSyncedAt");
-- GIST index for date range queries using tstzrange
CREATE INDEX IF NOT EXISTS "IX_ExternalCalendarEvents_DateRange" ON "public"."ExternalCalendarEvents" USING gist (tstzrange("StartDate", "EndDate"));

-- Bookings indexes
CREATE INDEX IF NOT EXISTS "IX_Bookings_EstatePropertyId" ON "public"."Bookings" ("EstatePropertyId");
CREATE INDEX IF NOT EXISTS "IX_Bookings_GuestId" ON "public"."Bookings" ("GuestId");
CREATE INDEX IF NOT EXISTS "IX_Bookings_CheckInDate" ON "public"."Bookings" ("CheckInDate");
CREATE INDEX IF NOT EXISTS "IX_Bookings_CheckOutDate" ON "public"."Bookings" ("CheckOutDate");
CREATE INDEX IF NOT EXISTS "IX_Bookings_Status" ON "public"."Bookings" ("Status");
CREATE INDEX IF NOT EXISTS "IX_Bookings_ValidationStatus" ON "public"."Bookings" ("ValidationStatus");
CREATE INDEX IF NOT EXISTS "IX_Bookings_HasConflict" ON "public"."Bookings" ("HasConflict");
-- GIST index for date range queries using daterange
CREATE INDEX IF NOT EXISTS "IX_Bookings_DateRange" ON "public"."Bookings" USING gist (daterange("CheckInDate", "CheckOutDate"));

-- SyncJobs indexes
CREATE INDEX IF NOT EXISTS "IX_SyncJobs_CalendarIntegrationId" ON "public"."SyncJobs" ("CalendarIntegrationId");
CREATE INDEX IF NOT EXISTS "IX_SyncJobs_JobType" ON "public"."SyncJobs" ("JobType");
CREATE INDEX IF NOT EXISTS "IX_SyncJobs_Status" ON "public"."SyncJobs" ("Status");
CREATE INDEX IF NOT EXISTS "IX_SyncJobs_StartedAt" ON "public"."SyncJobs" ("StartedAt");
CREATE INDEX IF NOT EXISTS "IX_SyncJobs_Created" ON "public"."SyncJobs" ("Created");


-- Row Level Security Policies

-- Enable RLS on new tables
ALTER TABLE "public"."AvailabilityBlocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CalendarIntegrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ExternalCalendarEvents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SyncJobs" ENABLE ROW LEVEL SECURITY;

-- AvailabilityBlocks policies
-- Only create policies that reference Owners table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Owners') THEN
        -- Property owners can manage their availability blocks
        DROP POLICY IF EXISTS "Property owners can manage their availability blocks" ON "public"."AvailabilityBlocks";
        EXECUTE '
        CREATE POLICY "Property owners can manage their availability blocks" ON "public"."AvailabilityBlocks"
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM "EstateProperties" ep
                    JOIN "Owners" o ON ep."OwnerId" = o."Id"
                    WHERE ep."Id" = "AvailabilityBlocks"."EstatePropertyId"
                    AND ep."IsDeleted" = false
                    AND o."IsDeleted" = false
                    AND (
                        -- Member ownership: owner is the user''s member record
                        (o."OwnerType" = ''member'' AND o."MemberId" IN (
                            SELECT "Id" FROM "Members"
                            WHERE "UserId" = auth.uid()
                            AND "IsDeleted" = false
                        )) OR
                        -- Company ownership: owner company is in user''s companies
                        (o."OwnerType" = ''company'' AND o."CompanyId" IN (
                            SELECT "CompanyId" FROM "UserCompanies"
                            WHERE "MemberId" IN (
                                SELECT "Id" FROM "Members"
                                WHERE "UserId" = auth.uid()
                                AND "IsDeleted" = false
                            )
                            AND "IsDeleted" = false
                        ))
                    )
                )
            )';
    END IF;
END $$;

CREATE POLICY "Admins can manage all availability blocks" ON "public"."AvailabilityBlocks"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Members" m
            WHERE m."UserId" = auth.uid()
            AND m."IsDeleted" = false
            AND m."Role" = 'admin'
        )
    );

-- CalendarIntegrations policies
-- Only create policies that reference Owners table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Owners') THEN
        -- Property owners can manage their calendar integrations
        DROP POLICY IF EXISTS "Property owners can manage their calendar integrations" ON "public"."CalendarIntegrations";
        EXECUTE '
        CREATE POLICY "Property owners can manage their calendar integrations" ON "public"."CalendarIntegrations"
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM "EstateProperties" ep
                    JOIN "Owners" o ON ep."OwnerId" = o."Id"
                    WHERE ep."Id" = "CalendarIntegrations"."EstatePropertyId"
                    AND ep."IsDeleted" = false
                    AND o."IsDeleted" = false
                    AND (
                        -- Member ownership: owner is the user''s member record
                        (o."OwnerType" = ''member'' AND o."MemberId" IN (
                            SELECT "Id" FROM "Members"
                            WHERE "UserId" = auth.uid()
                            AND "IsDeleted" = false
                        )) OR
                        -- Company ownership: owner company is in user''s companies
                        (o."OwnerType" = ''company'' AND o."CompanyId" IN (
                            SELECT "CompanyId" FROM "UserCompanies"
                            WHERE "MemberId" IN (
                                SELECT "Id" FROM "Members"
                                WHERE "UserId" = auth.uid()
                                AND "IsDeleted" = false
                            )
                            AND "IsDeleted" = false
                        ))
                    )
                )
            )';
    END IF;
END $$;

CREATE POLICY "Admins can manage all calendar integrations" ON "public"."CalendarIntegrations"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Members" m
            WHERE m."UserId" = auth.uid()
            AND m."IsDeleted" = false
            AND m."Role" = 'admin'
        )
    );

-- ExternalCalendarEvents policies (inherit from CalendarIntegrations)
-- Only create policies that reference Owners table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Owners') THEN
        -- Property owners can view their external calendar events
        DROP POLICY IF EXISTS "Property owners can view their external calendar events" ON "public"."ExternalCalendarEvents";
        EXECUTE '
        CREATE POLICY "Property owners can view their external calendar events" ON "public"."ExternalCalendarEvents"
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM "CalendarIntegrations" ci
                    JOIN "EstateProperties" ep ON ci."EstatePropertyId" = ep."Id"
                    JOIN "Owners" o ON ep."OwnerId" = o."Id"
                    WHERE ci."Id" = "ExternalCalendarEvents"."CalendarIntegrationId"
                    AND ep."IsDeleted" = false
                    AND o."IsDeleted" = false
                    AND (
                        -- Member ownership: owner is the user''s member record
                        (o."OwnerType" = ''member'' AND o."MemberId" IN (
                            SELECT "Id" FROM "Members"
                            WHERE "UserId" = auth.uid()
                            AND "IsDeleted" = false
                        )) OR
                        -- Company ownership: owner company is in user''s companies
                        (o."OwnerType" = ''company'' AND o."CompanyId" IN (
                            SELECT "CompanyId" FROM "UserCompanies"
                            WHERE "MemberId" IN (
                                SELECT "Id" FROM "Members"
                                WHERE "UserId" = auth.uid()
                                AND "IsDeleted" = false
                            )
                            AND "IsDeleted" = false
                        ))
                    )
                )
            )';
    END IF;
END $$;

CREATE POLICY "Admins can manage all external calendar events" ON "public"."ExternalCalendarEvents"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Members" m
            WHERE m."UserId" = auth.uid()
            AND m."IsDeleted" = false
            AND m."Role" = 'admin'
        )
    );

-- Bookings policies
-- Only create policies that reference Owners table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Owners') THEN
        -- Property owners can manage their property bookings
        DROP POLICY IF EXISTS "Property owners can manage their property bookings" ON "public"."Bookings";
        EXECUTE '
        CREATE POLICY "Property owners can manage their property bookings" ON "public"."Bookings"
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM "EstateProperties" ep
                    JOIN "Owners" o ON ep."OwnerId" = o."Id"
                    WHERE ep."Id" = "Bookings"."EstatePropertyId"
                    AND ep."IsDeleted" = false
                    AND o."IsDeleted" = false
                    AND (
                        -- Member ownership: owner is the user''s member record
                        (o."OwnerType" = ''member'' AND o."MemberId" IN (
                            SELECT "Id" FROM "Members"
                            WHERE "UserId" = auth.uid()
                            AND "IsDeleted" = false
                        )) OR
                        -- Company ownership: owner company is in user''s companies
                        (o."OwnerType" = ''company'' AND o."CompanyId" IN (
                            SELECT "CompanyId" FROM "UserCompanies"
                            WHERE "MemberId" IN (
                                SELECT "Id" FROM "Members"
                                WHERE "UserId" = auth.uid()
                                AND "IsDeleted" = false
                            )
                            AND "IsDeleted" = false
                        ))
                    )
                )
            )';
    END IF;
END $$;

CREATE POLICY "Users can view their own bookings" ON "public"."Bookings"
    FOR SELECT USING ("GuestId" = auth.uid());

CREATE POLICY "Users can create their own bookings" ON "public"."Bookings"
    FOR INSERT WITH CHECK ("GuestId" = auth.uid());

CREATE POLICY "Users can update their own bookings" ON "public"."Bookings"
    FOR UPDATE USING ("GuestId" = auth.uid());

CREATE POLICY "Admins can manage all bookings" ON "public"."Bookings"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Members" m
            WHERE m."UserId" = auth.uid()
            AND m."IsDeleted" = false
            AND m."Role" = 'admin'
        )
    );

-- SyncJobs policies (inherit from CalendarIntegrations)
-- Only create policies that reference Owners table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Owners') THEN
        -- Property owners can view their sync jobs
        DROP POLICY IF EXISTS "Property owners can view their sync jobs" ON "public"."SyncJobs";
        EXECUTE '
        CREATE POLICY "Property owners can view their sync jobs" ON "public"."SyncJobs"
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM "CalendarIntegrations" ci
                    JOIN "EstateProperties" ep ON ci."EstatePropertyId" = ep."Id"
                    JOIN "Owners" o ON ep."OwnerId" = o."Id"
                    WHERE ci."Id" = "SyncJobs"."CalendarIntegrationId"
                    AND ep."IsDeleted" = false
                    AND o."IsDeleted" = false
                    AND (
                        -- Member ownership: owner is the user''s member record
                        (o."OwnerType" = ''member'' AND o."MemberId" IN (
                            SELECT "Id" FROM "Members"
                            WHERE "UserId" = auth.uid()
                            AND "IsDeleted" = false
                        )) OR
                        -- Company ownership: owner company is in user''s companies
                        (o."OwnerType" = ''company'' AND o."CompanyId" IN (
                            SELECT "CompanyId" FROM "UserCompanies"
                            WHERE "MemberId" IN (
                                SELECT "Id" FROM "Members"
                                WHERE "UserId" = auth.uid()
                                AND "IsDeleted" = false
                            )
                            AND "IsDeleted" = false
                        ))
                    )
                )
            )';
    END IF;
END $$;

CREATE POLICY "Admins can manage all sync jobs" ON "public"."SyncJobs"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "Members" m
            WHERE m."UserId" = auth.uid()
            AND m."IsDeleted" = false
            AND m."Role" = 'admin'
        )
    );

-- Utility Functions for Calendar Sync

-- Function to encrypt OAuth tokens
CREATE OR REPLACE FUNCTION "public"."encrypt_oauth_token"(token_text text, encryption_key text DEFAULT 'default_key_change_in_prod')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    encrypted_token text;
BEGIN
    -- Use pgcrypto to encrypt the token
    SELECT encode(encrypt(token_text::bytea, encryption_key::bytea, 'aes'), 'base64') INTO encrypted_token;
    RETURN encrypted_token;
END;
$$;

-- Function to decrypt OAuth tokens
CREATE OR REPLACE FUNCTION "public"."decrypt_oauth_token"(encrypted_token text, encryption_key text DEFAULT 'default_key_change_in_prod')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    decrypted_token text;
BEGIN
    -- Use pgcrypto to decrypt the token
    SELECT convert_from(decrypt(decode(encrypted_token, 'base64'), encryption_key::bytea, 'aes'), 'utf8') INTO decrypted_token;
    RETURN decrypted_token;
END;
$$;

-- Function to detect conflicts between availability blocks
CREATE OR REPLACE FUNCTION "public"."detect_availability_conflicts"(property_id uuid, start_date timestamp with time zone, end_date timestamp with time zone)
RETURNS TABLE (
    "Id" uuid,
    "Title" text,
    "BlockType" integer,
    "Source" text,
    "IsReadOnly" boolean,
    "ConflictFlagged" boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ab."Id",
        ab."Title",
        ab."BlockType",
        ab."Source",
        ab."IsReadOnly",
        ab."ConflictFlagged"
    FROM "AvailabilityBlocks" ab
    WHERE ab."EstatePropertyId" = property_id
        AND ab."IsDeleted" = false
        AND ab."IsAvailable" = false
        AND (
            (ab."StartDate" <= start_date AND ab."EndDate" > start_date) OR
            (ab."StartDate" < end_date AND ab."EndDate" >= end_date) OR
            (ab."StartDate" >= start_date AND ab."EndDate" <= end_date)
        );
END;
$$;

-- Function to find overlapping bookings (helper for conflict detection)
CREATE OR REPLACE FUNCTION "public"."find_overlapping_bookings"(property_id uuid, check_in_date date, check_out_date date)
RETURNS TABLE (
    "Id" uuid,
    "CheckInDate" date,
    "CheckOutDate" date,
    "Status" integer,
    "HasConflict" boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        b."Id",
        b."CheckInDate",
        b."CheckOutDate",
        b."Status",
        b."HasConflict"
    FROM "Bookings" b
    WHERE b."EstatePropertyId" = property_id
        AND b."IsDeleted" = false
        AND b."Status" IN (0, 1, 2) -- Pending, Confirmed, Cancelled
        AND (
            (b."CheckInDate" <= check_in_date AND b."CheckOutDate" > check_in_date) OR
            (b."CheckInDate" < check_out_date AND b."CheckOutDate" >= check_out_date) OR
            (b."CheckInDate" >= check_in_date AND b."CheckOutDate" <= check_out_date)
        );
END;
$$;

-- Function to clean up expired webhook channels (call periodically)
CREATE OR REPLACE FUNCTION "public"."cleanup_expired_webhooks"()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Mark integrations as inactive if tokens are expired (simplified logic)
    -- In practice, this would be more sophisticated
    UPDATE "CalendarIntegrations"
    SET "IsActive" = false,
        "LastModified" = now()
    WHERE "TokenExpiresAt" < now()
        AND "IsActive" = true;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Function to trigger calendar sync for active integrations (call periodically)
CREATE OR REPLACE FUNCTION "public"."trigger_periodic_calendar_sync"()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sync_count integer := 0;
    integration_record record;
BEGIN
    -- Loop through active calendar integrations and trigger sync
    FOR integration_record IN
        SELECT ci."Id", ci."EstatePropertyId", ci."PlatformType"
        FROM "CalendarIntegrations" ci
        WHERE ci."IsActive" = true
        AND ci."IsDeleted" = false
        AND ci."LastSyncAt" < (now() - interval '15 minutes') -- Only sync if not synced in last 15 minutes
        ORDER BY ci."LastSyncAt" ASC NULLS FIRST
        LIMIT 10 -- Process in batches
    LOOP
        -- Insert sync job record (will be processed by Edge Function)
        INSERT INTO "SyncJobs" (
            "CalendarIntegrationId",
            "JobType",
            "Status",
            "CreatedBy"
        ) VALUES (
            integration_record."Id",
            1, -- scheduled
            0, -- pending
            'system'
        );

        sync_count := sync_count + 1;
    END LOOP;

    RETURN sync_count;
END;
$$;

-- Function to clean up old sync jobs (call weekly)
CREATE OR REPLACE FUNCTION "public"."cleanup_old_sync_jobs"(days_old integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM "SyncJobs"
    WHERE "Created" < (now() - (days_old || ' days')::interval)
        AND "Status" IN (2, 3); -- completed or failed

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
