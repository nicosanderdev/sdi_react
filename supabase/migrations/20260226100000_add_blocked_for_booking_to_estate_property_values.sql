-- ============================================================================
-- Add BlockedForBooking to EstatePropertyValues
-- ============================================================================
-- When true: property stays visible but cannot accept new bookings (e.g. overdue receipts).
-- Unblock when receipt is paid. Does not affect IsPropertyVisible.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'EstatePropertyValues'
        AND column_name = 'BlockedForBooking'
    ) THEN
        ALTER TABLE public."EstatePropertyValues"
        ADD COLUMN "BlockedForBooking" boolean NOT NULL DEFAULT false;
    END IF;
END $$;

COMMENT ON COLUMN public."EstatePropertyValues"."BlockedForBooking" IS 'When true, property is visible but cannot accept new bookings (e.g. owner has overdue unpaid receipt).';

CREATE INDEX IF NOT EXISTS "IX_EstatePropertyValues_BlockedForBooking"
ON public."EstatePropertyValues" ("BlockedForBooking")
WHERE "BlockedForBooking" = true;
