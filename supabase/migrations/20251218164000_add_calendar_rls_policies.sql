-- Add RLS policies for calendar integration tables that reference Owners table
-- This migration runs after the Owners table is created

-- AvailabilityBlocks policies
DROP POLICY IF EXISTS "Property owners can manage their availability blocks" ON "public"."AvailabilityBlocks";
CREATE POLICY "Property owners can manage their availability blocks" ON "public"."AvailabilityBlocks"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "EstateProperties" ep
            JOIN "Owners" o ON ep."OwnerId" = o."Id"
            WHERE ep."Id" = "AvailabilityBlocks"."EstatePropertyId"
            AND ep."IsDeleted" = false
            AND o."IsDeleted" = false
            AND (
                -- Member ownership: owner is the user's member record
                (o."OwnerType" = 'member' AND o."MemberId" IN (
                    SELECT "Id" FROM "Members"
                    WHERE "UserId" = auth.uid()
                    AND "IsDeleted" = false
                )) OR
                -- Company ownership: owner company is in user's companies
                (o."OwnerType" = 'company' AND o."CompanyId" IN (
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
    );

-- CalendarIntegrations policies
DROP POLICY IF EXISTS "Property owners can manage their calendar integrations" ON "public"."CalendarIntegrations";
CREATE POLICY "Property owners can manage their calendar integrations" ON "public"."CalendarIntegrations"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "EstateProperties" ep
            JOIN "Owners" o ON ep."OwnerId" = o."Id"
            WHERE ep."Id" = "CalendarIntegrations"."EstatePropertyId"
            AND ep."IsDeleted" = false
            AND o."IsDeleted" = false
            AND (
                -- Member ownership: owner is the user's member record
                (o."OwnerType" = 'member' AND o."MemberId" IN (
                    SELECT "Id" FROM "Members"
                    WHERE "UserId" = auth.uid()
                    AND "IsDeleted" = false
                )) OR
                -- Company ownership: owner company is in user's companies
                (o."OwnerType" = 'company' AND o."CompanyId" IN (
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
    );

-- ExternalCalendarEvents policies
DROP POLICY IF EXISTS "Property owners can view their external calendar events" ON "public"."ExternalCalendarEvents";
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
                -- Member ownership: owner is the user's member record
                (o."OwnerType" = 'member' AND o."MemberId" IN (
                    SELECT "Id" FROM "Members"
                    WHERE "UserId" = auth.uid()
                    AND "IsDeleted" = false
                )) OR
                -- Company ownership: owner company is in user's companies
                (o."OwnerType" = 'company' AND o."CompanyId" IN (
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
    );

-- Bookings policies
DROP POLICY IF EXISTS "Property owners can manage their property bookings" ON "public"."Bookings";
CREATE POLICY "Property owners can manage their property bookings" ON "public"."Bookings"
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM "EstateProperties" ep
            JOIN "Owners" o ON ep."OwnerId" = o."Id"
            WHERE ep."Id" = "Bookings"."EstatePropertyId"
            AND ep."IsDeleted" = false
            AND o."IsDeleted" = false
            AND (
                -- Member ownership: owner is the user's member record
                (o."OwnerType" = 'member' AND o."MemberId" IN (
                    SELECT "Id" FROM "Members"
                    WHERE "UserId" = auth.uid()
                    AND "IsDeleted" = false
                )) OR
                -- Company ownership: owner company is in user's companies
                (o."OwnerType" = 'company' AND o."CompanyId" IN (
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
    );

-- SyncJobs policies
DROP POLICY IF EXISTS "Property owners can view their sync jobs" ON "public"."SyncJobs";
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
                -- Member ownership: owner is the user's member record
                (o."OwnerType" = 'member' AND o."MemberId" IN (
                    SELECT "Id" FROM "Members"
                    WHERE "UserId" = auth.uid()
                    AND "IsDeleted" = false
                )) OR
                -- Company ownership: owner company is in user's companies
                (o."OwnerType" = 'company' AND o."CompanyId" IN (
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
    );

