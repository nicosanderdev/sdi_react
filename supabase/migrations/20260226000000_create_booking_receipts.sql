-- ============================================================================
-- MIGRATION: Create Booking Receipts (per-booking commission receipts)
-- ============================================================================
-- Adds:
--   - BookingReceipts: one receipt per batch of booking commissions
--   - BookingReceiptItems: links receipts to bookings
--   - Plans.BookingReceiptMinimumAmount: threshold for Free tier receipt creation
-- ============================================================================

-- Add BookingReceiptMinimumAmount to Plans (used for Free tier: create receipt when sum >= this or 15 days)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'Plans'
        AND column_name = 'BookingReceiptMinimumAmount'
    ) THEN
        ALTER TABLE public."Plans"
        ADD COLUMN "BookingReceiptMinimumAmount" numeric NULL;
    END IF;
END $$;

COMMENT ON COLUMN public."Plans"."BookingReceiptMinimumAmount" IS 'Minimum unpaid commission sum to create a receipt (Free tier). Set per plan in env.';

-- Create BookingReceipts table
CREATE TABLE IF NOT EXISTS public."BookingReceipts" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "SubscriptionId" uuid NOT NULL,
    "Amount" numeric NOT NULL,
    "Currency" character varying(10) NOT NULL,
    "DueDate" timestamp with time zone NOT NULL,
    "PaidAt" timestamp with time zone NULL,
    "Status" integer NOT NULL DEFAULT 0,
    "IsDeleted" boolean NOT NULL DEFAULT false,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    "CreatedBy" text NULL,
    "LastModified" timestamp with time zone NOT NULL DEFAULT now(),
    "LastModifiedBy" text NULL,
    CONSTRAINT "PK_BookingReceipts" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BookingReceipts_Subscriptions_SubscriptionId" FOREIGN KEY ("SubscriptionId") REFERENCES public."Subscriptions" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_BookingReceipts_SubscriptionId" ON public."BookingReceipts" ("SubscriptionId");
CREATE INDEX IF NOT EXISTS "IX_BookingReceipts_DueDate" ON public."BookingReceipts" ("DueDate");
CREATE INDEX IF NOT EXISTS "IX_BookingReceipts_Status" ON public."BookingReceipts" ("Status");
CREATE INDEX IF NOT EXISTS "IX_BookingReceipts_IsDeleted" ON public."BookingReceipts" ("IsDeleted");

COMMENT ON TABLE public."BookingReceipts" IS 'Per-booking commission receipts; owner must pay by DueDate or properties get blocked. Status: 0=pending, 1=paid, 2=overdue.';

-- Create BookingReceiptItems table
CREATE TABLE IF NOT EXISTS public."BookingReceiptItems" (
    "Id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "BookingReceiptId" uuid NOT NULL,
    "BookingId" uuid NOT NULL,
    "Amount" numeric NOT NULL,
    "Created" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "PK_BookingReceiptItems" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_BookingReceiptItems_BookingReceipts_BookingReceiptId" FOREIGN KEY ("BookingReceiptId") REFERENCES public."BookingReceipts" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_BookingReceiptItems_Bookings_BookingId" FOREIGN KEY ("BookingId") REFERENCES public."Bookings" ("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IX_BookingReceiptItems_BookingReceiptId" ON public."BookingReceiptItems" ("BookingReceiptId");
CREATE INDEX IF NOT EXISTS "IX_BookingReceiptItems_BookingId" ON public."BookingReceiptItems" ("BookingId");

COMMENT ON TABLE public."BookingReceiptItems" IS 'Links each booking to a receipt; when receipt is paid, these bookings are considered paid.';

-- RLS: owners can only see and manage their own receipts (via subscription ownership)
ALTER TABLE public."BookingReceipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookingReceiptItems" ENABLE ROW LEVEL SECURITY;

-- BookingReceipts: allow access when subscription belongs to current user (member or company)
CREATE POLICY "Users can view their booking receipts" ON public."BookingReceipts"
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public."Subscriptions" s
        WHERE s."Id" = "BookingReceipts"."SubscriptionId"
        AND s."IsDeleted" = false
        AND (
            (s."OwnerType" = 0 AND s."OwnerId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false))
            OR
            (s."OwnerType" = 1 AND s."OwnerId" IN (
                SELECT "CompanyId" FROM "UserCompanies"
                WHERE "MemberId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false)
                AND "IsDeleted" = false
            ))
        )
    )
);

CREATE POLICY "Users can insert their booking receipts" ON public."BookingReceipts"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public."Subscriptions" s
        WHERE s."Id" = "BookingReceipts"."SubscriptionId"
        AND s."IsDeleted" = false
        AND (
            (s."OwnerType" = 0 AND s."OwnerId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false))
            OR
            (s."OwnerType" = 1 AND s."OwnerId" IN (
                SELECT "CompanyId" FROM "UserCompanies"
                WHERE "MemberId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false)
                AND "IsDeleted" = false
            ))
        )
    )
);

CREATE POLICY "Users can update their booking receipts" ON public."BookingReceipts"
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public."Subscriptions" s
        WHERE s."Id" = "BookingReceipts"."SubscriptionId"
        AND s."IsDeleted" = false
        AND (
            (s."OwnerType" = 0 AND s."OwnerId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false))
            OR
            (s."OwnerType" = 1 AND s."OwnerId" IN (
                SELECT "CompanyId" FROM "UserCompanies"
                WHERE "MemberId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false)
                AND "IsDeleted" = false
            ))
        )
    )
);

-- BookingReceiptItems: allow access when parent receipt belongs to user (same subscription check via BookingReceipts)
CREATE POLICY "Users can view their booking receipt items" ON public."BookingReceiptItems"
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public."BookingReceipts" r
        JOIN public."Subscriptions" s ON s."Id" = r."SubscriptionId"
        WHERE r."Id" = "BookingReceiptItems"."BookingReceiptId"
        AND r."IsDeleted" = false
        AND s."IsDeleted" = false
        AND (
            (s."OwnerType" = 0 AND s."OwnerId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false))
            OR
            (s."OwnerType" = 1 AND s."OwnerId" IN (
                SELECT "CompanyId" FROM "UserCompanies"
                WHERE "MemberId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false)
                AND "IsDeleted" = false
            ))
        )
    )
);

CREATE POLICY "Users can insert their booking receipt items" ON public."BookingReceiptItems"
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public."BookingReceipts" r
        JOIN public."Subscriptions" s ON s."Id" = r."SubscriptionId"
        WHERE r."Id" = "BookingReceiptItems"."BookingReceiptId"
        AND r."IsDeleted" = false
        AND s."IsDeleted" = false
        AND (
            (s."OwnerType" = 0 AND s."OwnerId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false))
            OR
            (s."OwnerType" = 1 AND s."OwnerId" IN (
                SELECT "CompanyId" FROM "UserCompanies"
                WHERE "MemberId" IN (SELECT "Id" FROM "Members" WHERE "UserId" = auth.uid() AND "IsDeleted" = false)
                AND "IsDeleted" = false
            ))
        )
    )
);
