# Usage Tracking Audit Report

## Scope
- Reservation management flows for confirm/reject, including limit checks, usage creation, notification, and tracking-code requirements.
- Admin payment management flows for usage search, invoice generation, invoice status updates, and billing-cycle consistency.
- Data integrity between `Bookings`, `UsageRecords`, `Invoices`, and `BillingCycles`.

## Executive Result
- The main confirm path is partially correct: it enforces booking limits before status update and inserts usage idempotently.
- There is a critical bypass path where a booking can be created directly in confirmed state without pre-limit checks and without usage insertion.
- Billing flows contain strong basic controls, but there are high-impact consistency gaps in invoice total calculation and cycle assignment behavior.
- Confirmation email/tracking code requirements are not wired into active reservation confirmation flow.

## Confirmed Working Logic

### 1) Confirm from owner/admin bookings pages
- Both owner and admin booking pages confirm by calling `BookingService.updateBooking(..., { status: Confirmed })`.
- In this path, limit validation runs before the `Bookings` status update.
- After successful update, booking usage is inserted using upsert with unique conflict key to avoid duplicates.

### 2) Duplicate protection for booking usage
- Usage insertion for bookings uses `upsert` with conflict key `MemberId,Type,ReferenceId`.
- SQL limit-check function supports idempotent checks when the usage row for the same reference already exists.

### 3) Admin invoice generation baseline controls
- Admin invoice generation rejects mixed-member selections.
- It rejects already billed usage rows.
- Unique index enforces one invoice per billing cycle.
- Usage rows are linked to invoice (`UsageRecords.InvoiceId`) on generation.

## Findings By Severity

### Critical
1. **Confirmed-booking creation bypasses limit and usage logic**
   - `BookingDetailsPanel` creates bookings directly with `status: Confirmed`.
   - `BookingService.createBooking` does not call booking limit check and does not call booking usage insertion when status is confirmed.
   - Impact: confirmed reservations can exist without usage records and without limit enforcement.

### High
2. **Invoice total calculation is inconsistent between admin and cron paths**
   - App inserts booking usage with `Amount = null`.
   - Admin invoice generation computes per-booking totals using booking count x `PricePerBooking`.
   - Cron cycle invoice generation relies on `compute_billing_cycle_total`, which currently uses `sum(UsageRecords.Amount)` for booking/hybrid branches.
   - Impact: cron-generated invoices can underbill (including zero) while manual admin invoices bill correctly.

3. **Confirm update and usage insert are non-transactional**
   - `updateBooking` confirms status first, then inserts usage.
   - If usage insertion fails post-update, reservation stays confirmed without usage.
   - Impact: silent data drift between booking status and billable usage.

### Medium
4. **Manual invoice generation can assign usage to a cycle not aligned with usage dates**
   - Admin RPC selects the current open cycle for the member.
   - Selected usage rows are not validated against that cycle window.
   - Impact: incorrect cycle linkage and period reporting.

5. **Invoice paid-state is not synchronized to cycle paid-state**
   - `admin_set_invoice_status` updates `Invoices` only.
   - No corresponding update to `BillingCycles.Status = 'paid'` when paid.
   - Impact: invoice/cycle lifecycle can diverge.

6. **Admin billable-usage listing hides usage linked to deleted/missing bookings**
   - `admin_get_billable_usage` inner-joins `Bookings` with `IsDeleted = false`.
   - Orphaned usage rows are not visible to admin UI even if present in `UsageRecords`.
   - Impact: reconciliation blind spots.

### Low
7. **Parallel legacy billing system remains active**
   - Legacy `BookingReceipts` path exists and is still used by `useEnsureReceiptsAndBlock`.
   - Flexible billing path uses `UsageRecords` + `Invoices`.
   - Impact: conceptual overlap and operator confusion if both systems remain active.

8. **Confirmation notification functions are present but not integrated**
   - Edge functions exist for confirmation email/message, including payload contract for `reservationCode`.
   - No active invocation from booking confirm flow was found.
   - Impact: required tenant notifications/tracking code generation may not happen.

## Requirement Validation Matrix

### Reservation confirm
- **Limit enforcement BEFORE action execution:** Passes on `updateBooking` confirm path; fails on direct `createBooking(...Confirmed...)` path.
- **Usage record created if plan requires it:** Passes on `updateBooking` confirm path; fails on direct confirmed-create path.
- **No duplicate usage records:** Passes (upsert + unique key).
- **Email notification sent:** Not guaranteed in active code path.
- **Tracking code generated:** Not implemented in active code path.

### Reservation reject
- **No incorrect usage generation:** Current reject path (`status: Cancelled`) does not create usage.
- **Generate usage only by explicit plan rule:** No explicit reject-billable rule engine found; current behavior is always non-billable.

### Payment management (admin)
- **Search reservation / usage:** Implemented via `admin_get_billable_usage`.
- **Generate invoice:** Implemented with key guards (single member, unbilled rows).
- **Search invoices:** Implemented via `admin_get_invoices`.
- **Mark invoice paid:** Implemented via `admin_set_invoice_status`.
- **Generate receipt:** Flexible path handles invoices; legacy receipt subsystem still separate.
- **Consistency across usage/invoice/cycle:** Partially passes; see high/medium gaps.

## Proposed Fixes (Not Applied)

### A) New backend/service functions
1. **Create unified confirm orchestration service**
   - Proposed function: `BookingBillingService.confirmBookingWithBillingGuards(bookingId: string): Promise<BookingWithMember>`
   - Responsibilities:
     - Resolve property/member billing owner
     - Enforce limit guard
     - Transition booking to confirmed
     - Insert usage idempotently
     - Trigger confirmation notification dispatch
   - Ensure both `updateBooking` and confirmed-create flow call this shared function.

2. **Create confirmed-create guarded function**
   - Proposed function: `BookingService.createConfirmedBooking(bookingData)`
   - Internally:
     - Create pending/temporary booking
     - Run confirm orchestrator
     - Return final confirmed booking
   - Prevent direct raw `createBooking(..., { status: Confirmed })` from UI-level use.

3. **Add explicit notification facade**
   - Proposed function: `BookingNotificationService.sendConfirmation({ bookingId })`
   - Behavior:
     - Generate deterministic reservation code (or retrieve from persisted column)
     - Invoke configured edge function
     - Return structured outcome for UI/API logging

### B) Supabase migration scripts (drafts)
1. **Fix cycle total computation for per-booking/hybrid**
   - Update `compute_billing_cycle_total`:
     - For `per_booking`: `booking_count * price_per_booking`
     - For `hybrid`: `greatest(min_monthly_fee, booking_count * price_per_booking)`
   - Do not depend on `UsageRecords.Amount` for booking rows.

2. **Add invoice/member-cycle consistency constraint**
   - Add trigger on `Invoices` insert/update:
     - Assert `Invoices.MemberId = BillingCycles.MemberId` for referenced cycle.

3. **Keep cycle status aligned when invoice is paid/unpaid**
   - Update `admin_set_invoice_status`:
     - On paid: set linked `BillingCycles.Status = 'paid'` if no pending invoice in same cycle.
     - On unpaid rollback: set cycle back to `closed` (or `open` based on policy).

4. **Harden admin manual invoice generation cycle assignment**
   - Extend `admin_generate_invoice_from_usage`:
     - Validate selected usage timestamps are within target cycle window, OR
     - Derive/create appropriate cycle from min/max usage dates.

5. **Optional reservation-code schema addition**
   - Add `Bookings.ReservationCode` with unique index if tracking code must be persisted.
   - Backfill strategy for existing confirmed bookings if required.

### C) Transactional integrity recommendation
- Move booking confirm + usage insertion into a single SQL RPC transaction (preferred), or
- Use compensation logic when post-confirm usage insert fails.

## Manual Test Scenarios

1. Confirm pending reservation under limit from owner page:
   - Expect status `confirmed`, one usage row created, no duplicates on retry.
2. Confirm pending reservation over limit from owner page:
   - Expect block before status change and clear error message.
3. Confirm pending reservation from admin page:
   - Same expectations as owner confirm.
4. Create booking directly as confirmed from property panel:
   - Current expected (bug): may confirm without limit check/usage row.
   - Post-fix expected: blocked or charged consistently.
5. Reject pending reservation:
   - Expect `cancelled`, no booking usage row unless explicit future rule says billable.
6. Repeat confirm action (double click/retry/network retry):
   - Expect one usage row only.
7. Generate admin invoice from unbilled usage:
   - Expect invoice created, selected usage linked, totals match pricing model.
8. Generate cron invoice for ended cycle with booking usage:
   - Current expected (bug-risk): totals may differ from admin path for per-booking/hybrid.
9. Mark invoice paid:
   - Verify invoice status, paid timestamp, and linked cycle status consistency.
10. Usage rows with deleted bookings:
   - Verify whether admin list can surface/reconcile them (currently likely hidden).

## Recommended Implementation Order
1. Fix confirmed-create bypass (critical correctness).
2. Fix cycle total math for per-booking/hybrid (billing correctness).
3. Add transactional confirm + usage pattern.
4. Add cycle/member consistency constraints and paid-state synchronization.
5. Integrate notification + tracking code flow.
6. Decide and deprecate/align legacy `BookingReceipts` path.
