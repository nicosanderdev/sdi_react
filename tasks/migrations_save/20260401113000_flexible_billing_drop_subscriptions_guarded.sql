-- Guarded legacy table removal/deprecation: Subscriptions
-- NOTE: Manual execution by project owner.
-- This migration fails fast for unmapped data, and then:
--   - drops Subscriptions when safe, or
--   - deprecates it by renaming to SubscriptionsLegacy when dependencies remain.

begin;

do $$
declare
  v_unmapped_subs_count bigint := 0;
  v_unmapped_histories_count bigint := 0;
  v_fk_dependency_count bigint := 0;
  v_view_dependency_count bigint := 0;
  v_func_dependency_count bigint := 0;
  v_has_subscriptions boolean := false;
  v_has_legacy boolean := false;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'Subscriptions'
  ) into v_has_subscriptions;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'SubscriptionsLegacy'
  ) into v_has_legacy;

  -- Already deprecated/dropped: idempotent no-op.
  if not v_has_subscriptions then
    return;
  end if;

  -- Ensure all owner rows were explicitly mapped before deleting legacy source.
  select count(*)
  into v_unmapped_subs_count
  from public.billing_unmapped_subscriptions();

  select count(*)
  into v_unmapped_histories_count
  from public.billing_unmapped_histories();

  if v_unmapped_subs_count > 0 or v_unmapped_histories_count > 0 then
    raise exception
      'Cannot drop Subscriptions: unmapped_subscriptions=%, unmapped_histories=%',
      v_unmapped_subs_count,
      v_unmapped_histories_count;
  end if;

  -- Block drop if there are FKs still pointing to Subscriptions.
  select count(*)
  into v_fk_dependency_count
  from pg_constraint c
  join pg_class target_table
    on target_table.oid = c.confrelid
  join pg_namespace target_ns
    on target_ns.oid = target_table.relnamespace
  where c.contype = 'f'
    and target_ns.nspname = 'public'
    and target_table.relname = 'Subscriptions';

  -- Block drop if views still reference Subscriptions.
  select count(*)
  into v_view_dependency_count
  from information_schema.views v
  where v.table_schema = 'public'
    and v.view_definition ilike '%"Subscriptions"%';

  -- Block drop if SQL functions still reference Subscriptions textually.
  select count(*)
  into v_func_dependency_count
  from information_schema.routines r
  where r.routine_schema = 'public'
    and coalesce(r.routine_definition, '') ilike '%"Subscriptions"%';

  -- Hard delete only when there are no dependencies.
  if v_fk_dependency_count = 0
     and v_view_dependency_count = 0
     and v_func_dependency_count = 0 then
    execute 'drop table if exists public."Subscriptions"';
    return;
  end if;

  -- Safe fallback: deprecate (rename) so production keeps working.
  if not v_has_legacy then
    execute 'alter table public."Subscriptions" rename to "SubscriptionsLegacy"';
  end if;

  raise notice
    'Subscriptions not dropped due to dependencies (fk=%, views=%, funcs=%). Table deprecated as SubscriptionsLegacy.',
    v_fk_dependency_count,
    v_view_dependency_count,
    v_func_dependency_count;
end $$;

commit;
