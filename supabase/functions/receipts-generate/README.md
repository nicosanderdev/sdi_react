# receipts-generate (flexible billing invoice cron)

POST-only Edge function for the **daily** job that:

1. Calls `cron_invoice_ready_cycles()` to list `BillingCycles` that are **open**, **ended** (`EndDate <= now()`), and have **no** `Invoices` row yet.
2. For each row, calls `generate_invoice_for_cycle` (service role), which closes the cycle, creates a **pending** invoice with `DueDate = now() + 7 days`, and sets `UsageRecords.InvoiceId` for usage in that cycle window.

## Schedule

Point a **Supabase Scheduled Function** or external cron at this function’s URL with **POST** once per day. `verify_jwt` is `false` in [`config.toml`](../../config.toml) for scheduler access.

## See also

- [`flexible-invoice-overdue-unpublish`](../flexible-invoice-overdue-unpublish) — overdue invoice → unpublish listings.
- DB migration [`20260506120000_generate_invoice_cycle_link_usage.sql`](../../migrations/20260506120000_generate_invoice_cycle_link_usage.sql).
