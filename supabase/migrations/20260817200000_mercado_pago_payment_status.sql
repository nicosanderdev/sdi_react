-- Mercado Pago: persist Bookings.PaymentStatus on verified approval,
-- clear paid flags on refund/chargeback, and tighten guest RPC grants.
-- Does not change Bookings.Status (confirmed = matched intentions, not paid).

COMMENT ON COLUMN public."Bookings"."MercadoPagoApprovedAt" IS
  'Set after a verified Mercado Pago webhook + GET /v1/payments approval. Also sets PaymentStatus = 1. Cleared on refund/chargeback. Does not change Status.';

CREATE OR REPLACE FUNCTION public.mark_booking_mercado_pago_approved(
  p_booking_id uuid,
  p_attempt_id uuid,
  p_mp_payment_id text,
  p_provider_status text,
  p_provider_status_detail text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_currency_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_attempt record;
  v_booking record;
  v_now timestamptz := timezone('utc', now());
begin
  select *
  into v_attempt
  from public.mercado_pago_payment_attempts a
  where a.id = p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Payment attempt not found');
  end if;

  if v_attempt.booking_id <> p_booking_id then
    return jsonb_build_object('success', false, 'error', 'Attempt booking mismatch');
  end if;

  select *
  into v_booking
  from public."Bookings" b
  where b."Id" = p_booking_id
    and b."IsDeleted" = false
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Booking not found');
  end if;

  if p_amount is not null and abs(coalesce(v_attempt.expected_amount, 0) - p_amount) > 0.01 then
    return jsonb_build_object('success', false, 'error', 'Amount mismatch', 'error_code', 'AMOUNT_MISMATCH');
  end if;

  if p_currency_code is not null
     and upper(trim(p_currency_code)) <> upper(trim(v_attempt.expected_currency_code)) then
    return jsonb_build_object('success', false, 'error', 'Currency mismatch', 'error_code', 'CURRENCY_MISMATCH');
  end if;

  update public.mercado_pago_payment_attempts
  set
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
    status = 'approved',
    provider_status = p_provider_status,
    provider_status_detail = p_provider_status_detail,
    payer_email = coalesce(p_payer_email, payer_email),
    approved_at = coalesce(approved_at, v_now),
    updated_at = v_now
  where id = p_attempt_id;

  update public."Bookings"
  set
    "MercadoPagoApprovedAt" = coalesce("MercadoPagoApprovedAt", v_now),
    "PaymentStatus" = 1,
    "LastModified" = v_now,
    "LastModifiedBy" = 'mercado-pago-webhook'
  where "Id" = p_booking_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'attempt_id', p_attempt_id,
    'already_approved', v_booking."MercadoPagoApprovedAt" is not null
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.clear_booking_mercado_pago_approval(
  p_booking_id uuid,
  p_attempt_id uuid,
  p_mp_payment_id text,
  p_provider_status text,
  p_provider_status_detail text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_currency_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_attempt record;
  v_booking record;
  v_now timestamptz := timezone('utc', now());
  v_status text;
begin
  v_status := case
    when p_provider_status = 'charged_back' then 'charged_back'
    else 'refunded'
  end;

  select *
  into v_attempt
  from public.mercado_pago_payment_attempts a
  where a.id = p_attempt_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Payment attempt not found');
  end if;

  if v_attempt.booking_id <> p_booking_id then
    return jsonb_build_object('success', false, 'error', 'Attempt booking mismatch');
  end if;

  select *
  into v_booking
  from public."Bookings" b
  where b."Id" = p_booking_id
    and b."IsDeleted" = false
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Booking not found');
  end if;

  if p_amount is not null and abs(coalesce(v_attempt.expected_amount, 0) - p_amount) > 0.01 then
    return jsonb_build_object('success', false, 'error', 'Amount mismatch', 'error_code', 'AMOUNT_MISMATCH');
  end if;

  if p_currency_code is not null
     and upper(trim(p_currency_code)) <> upper(trim(v_attempt.expected_currency_code)) then
    return jsonb_build_object('success', false, 'error', 'Currency mismatch', 'error_code', 'CURRENCY_MISMATCH');
  end if;

  update public.mercado_pago_payment_attempts
  set
    mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
    status = v_status,
    provider_status = p_provider_status,
    provider_status_detail = p_provider_status_detail,
    payer_email = coalesce(p_payer_email, payer_email),
    updated_at = v_now
  where id = p_attempt_id;

  update public."Bookings"
  set
    "MercadoPagoApprovedAt" = null,
    "PaymentStatus" = 0,
    "LastModified" = v_now,
    "LastModifiedBy" = 'mercado-pago-webhook'
  where "Id" = p_booking_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'attempt_id', p_attempt_id,
    'status', v_status
  );
end;
$$;

REVOKE ALL ON FUNCTION public.clear_booking_mercado_pago_approval(uuid, uuid, text, text, text, text, numeric, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_booking_mercado_pago_approval(uuid, uuid, text, text, text, text, numeric, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_member_mercado_pago_status(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_mercado_pago_status(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_booking_payment_status_by_manage_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
declare
  v_token_hash text;
  v_booking_id uuid;
  v_info jsonb;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return jsonb_build_object('success', false, 'error', 'Missing token');
  end if;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  select t.booking_id
  into v_booking_id
  from public.booking_manage_tokens t
  where t.token_hash = v_token_hash
    and t.revoked_at is null
    and t.expires_at > now()
  limit 1;

  if v_booking_id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid or expired token');
  end if;

  v_info := public.get_booking_mercado_pago_payment_info(v_booking_id);
  if v_info is null then
    return jsonb_build_object('success', false, 'error', 'Unable to load payment info');
  end if;

  return v_info - 'seller_member_id';
end;
$$;
