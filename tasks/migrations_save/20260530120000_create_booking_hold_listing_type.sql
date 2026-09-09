-- create_booking_hold: accept p_listing_type and persist on booking_holds.
-- Prerequisite: 20260529120000_guest_booking_overlap.sql (already applied).
-- NOTE: Manual execution by project owner (idempotent).

begin;

drop function if exists public.create_booking_hold(
  uuid, date, date, integer, text, text, date, integer
);

create or replace function public.create_booking_hold(
  p_property_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer,
  p_ip_hash text default null,
  p_idempotency_key text default null,
  p_visible_check_out date default null,
  p_estimated_guests integer default null,
  p_listing_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_validation jsonb;
  v_hold_id uuid;
  v_listing_type text := null;
begin
  if coalesce(trim(p_listing_type), '') <> '' then
    begin
      v_listing_type := public.validate_guest_site_listing_type(p_listing_type)::text;
    exception
      when others then
        return jsonb_build_object('success', false, 'error', 'Invalid listing type');
    end;
  end if;

  v_validation := public.validate_booking_selection(
    p_property_id,
    p_check_in,
    coalesce(p_visible_check_out, p_check_out),
    p_guests
  );

  if not coalesce((v_validation->>'is_valid')::boolean, false) then
    return jsonb_build_object('success', false, 'error', 'Validation failed', 'validation', v_validation);
  end if;

  if exists (
    select 1
    from public.booking_holds h
    where h.property_id = p_property_id
      and h.status = 'pending'
      and h.expires_at > now()
      and daterange(h.check_in, h.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
  ) then
    return jsonb_build_object('success', false, 'error', 'Selected dates are temporarily held by another guest');
  end if;

  insert into public.booking_holds (
    property_id,
    check_in,
    check_out,
    guests,
    estimated_guests,
    ip_hash,
    idempotency_key,
    listing_type
  ) values (
    p_property_id,
    p_check_in,
    p_check_out,
    p_guests,
    p_estimated_guests,
    p_ip_hash,
    p_idempotency_key,
    v_listing_type
  )
  returning id into v_hold_id;

  return jsonb_build_object(
    'success', true,
    'hold', jsonb_build_object(
      'id', v_hold_id,
      'expires_at', (select expires_at from public.booking_holds where id = v_hold_id),
      'listing_type', v_listing_type
    ),
    'validation', v_validation
  );
end;
$$;

comment on function public.create_booking_hold(
  uuid, date, date, integer, text, text, date, integer, text
) is
  'Create a pending booking hold. Validates dates/guests, stores listing_type for guest-site scoping.';

grant execute on function public.create_booking_hold(
  uuid, date, date, integer, text, text, date, integer, text
) to anon, authenticated, service_role;

commit;
