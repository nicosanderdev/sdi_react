-- Invoice generation from billing cycles: attach DueDate, link UsageRecords to Invoices,
-- and expose cron_invoice_ready_cycles for daily Edge cron.

begin;

create or replace function public.generate_invoice_for_cycle(
  p_member_id uuid,
  p_billing_cycle_id uuid,
  p_created_by text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_invoice_id uuid;
  v_cycle_status text;
  v_cycle_start timestamptz;
  v_cycle_end timestamptz;
  v_total numeric;
  v_new_invoice_id uuid;
  v_due_date timestamptz := now() + interval '7 days';
begin
  select i."Id"
  into v_existing_invoice_id
  from public."Invoices" i
  where i."BillingCycleId" = p_billing_cycle_id
  limit 1;

  if v_existing_invoice_id is not null then
    return v_existing_invoice_id;
  end if;

  select "Status", "StartDate", "EndDate"
  into v_cycle_status, v_cycle_start, v_cycle_end
  from public."BillingCycles"
  where "Id" = p_billing_cycle_id
    and "MemberId" = p_member_id
  limit 1;

  if v_cycle_status is null then
    raise exception 'Billing cycle % not found for member %', p_billing_cycle_id, p_member_id;
  end if;

  v_total := public.compute_billing_cycle_total(p_member_id, p_billing_cycle_id);

  update public."BillingCycles"
  set
    "TotalAmount" = v_total,
    "Status" = case when "Status" = 'open' then 'closed' else "Status" end,
    "UpdatedAt" = now(),
    "LastModifiedBy" = p_created_by
  where "Id" = p_billing_cycle_id
    and "MemberId" = p_member_id;

  insert into public."Invoices" (
    "MemberId",
    "BillingCycleId",
    "Total",
    "Status",
    "DueDate",
    "CreatedAt",
    "UpdatedAt",
    "CreatedBy",
    "LastModifiedBy"
  )
  values (
    p_member_id,
    p_billing_cycle_id,
    v_total,
    'pending',
    v_due_date,
    now(),
    now(),
    p_created_by,
    p_created_by
  )
  returning "Id" into v_new_invoice_id;

  update public."UsageRecords" ur
  set "InvoiceId" = v_new_invoice_id
  where ur."MemberId" = p_member_id
    and ur."InvoiceId" is null
    and ur."CreatedAt" >= v_cycle_start
    and ur."CreatedAt" < v_cycle_end;

  return v_new_invoice_id;
end;
$$;

comment on function public.generate_invoice_for_cycle(uuid, uuid, text) is
  'Closes billing cycle, inserts invoice with DueDate (+7d), links UsageRecords in cycle window to InvoiceId.';

-- -----------------------------------------------------------------------------
-- Rows ready for cron: open cycles that have ended and have no invoice yet
-- -----------------------------------------------------------------------------
create or replace function public.cron_invoice_ready_cycles()
returns table (
  billing_cycle_id uuid,
  member_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select bc."Id", bc."MemberId"
  from public."BillingCycles" bc
  where bc."Status" = 'open'
    and bc."EndDate" <= now()
    and not exists (
      select 1
      from public."Invoices" i
      where i."BillingCycleId" = bc."Id"
    );
$$;

comment on function public.cron_invoice_ready_cycles() is
  'Returns billing cycles eligible for generate_invoice_for_cycle (ended, open, no invoice).';

grant execute on function public.cron_invoice_ready_cycles() to authenticated;
grant execute on function public.cron_invoice_ready_cycles() to service_role;

commit;
