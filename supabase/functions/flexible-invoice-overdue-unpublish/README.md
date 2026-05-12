# flexible-invoice-overdue-unpublish

Edge function for the **daily** job that finds **pending** flexible-billing `Invoices` past their effective due date plus grace, and **unpublishes** all `Listings` for properties owned by the billed `Member` (member owners and company owners via `BillingOwnerMemberMap`).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `INVOICE_OVERDUE_GRACE_DAYS` | `14` | Calendar days **after** effective due before unpublishing |
| `SUPABASE_URL` | (required) | Set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | (required) | Set by Supabase |

Effective due date per invoice: `coalesce(Invoices.DueDate, Invoices.CreatedAt + 7 days)`.

## Schedule

Create a **Supabase Scheduled Function** (or external cron) to send **POST** to this function’s URL **once per day** (e.g. off-peak UTC). Set `verify_jwt = false` in `config.toml` (already set) so the scheduler can call without a user JWT.

## Related

- [`receipts-generate`](../receipts-generate) — daily invoice finalization for ended `BillingCycles`.
- Migration [`20260506120000_generate_invoice_cycle_link_usage.sql`](../../migrations/20260506120000_generate_invoice_cycle_link_usage.sql) — `generate_invoice_for_cycle` + `cron_invoice_ready_cycles`.
