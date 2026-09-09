-- Log plaintext booking manage tokens in local + staging only.
-- Tokens are hashed at rest; the raw value exists only at issue time.
-- Visible in: Edge Function logs (log-booking-manage-token), SQL table, postgres WARNING.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_net not available (%); manage tokens will still log to WARNING and booking_manage_token_dev_logs', SQLERRM;
END;
$$;

CREATE TABLE IF NOT EXISTS public.booking_manage_token_dev_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  reservation_code text,
  listing_type text,
  token text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.booking_manage_token_dev_logs IS
  'Plaintext manage tokens for local/staging debugging. Not written in production. Query: select * from booking_manage_token_dev_logs order by created_at desc limit 20;';

CREATE INDEX IF NOT EXISTS idx_booking_manage_token_dev_logs_created_at
  ON public.booking_manage_token_dev_logs (created_at DESC);

ALTER TABLE public.booking_manage_token_dev_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.booking_manage_token_dev_logs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.should_log_booking_dev_secrets()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
declare
  v_headers jsonb := '{}'::jsonb;
  v_host text := '';
  v_origin_host text := '';
  v_referer_host text := '';
begin
  if current_setting('app.log_booking_dev_secrets', true) = 'true' then
    return true;
  end if;

  begin
    v_headers := coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
  exception
    when others then
      v_headers := '{}'::jsonb;
  end;

  v_host := lower(split_part(coalesce(v_headers->>'host', ''), ':', 1));
  v_origin_host := lower(split_part(
    split_part(coalesce(v_headers->>'origin', ''), '://', 2),
    '/',
    1
  ));
  v_origin_host := split_part(v_origin_host, ':', 1);
  v_referer_host := lower(split_part(
    split_part(coalesce(v_headers->>'referer', ''), '://', 2),
    '/',
    1
  ));
  v_referer_host := split_part(v_referer_host, ':', 1);

  if v_host in ('127.0.0.1', 'localhost', 'kong')
     or v_origin_host in ('127.0.0.1', 'localhost', 'kong')
     or v_referer_host in ('127.0.0.1', 'localhost', 'kong') then
    return true;
  end if;

  -- Staging guest sites, e.g. staging-casas.encartelera.uy
  if v_origin_host like 'staging-%'
     or v_origin_host like 'staging.%'
     or v_origin_host like '%.staging.%'
     or v_origin_host like '%.staging'
     or v_referer_host like 'staging-%'
     or v_referer_host like 'staging.%'
     or v_referer_host like '%.staging.%'
     or v_referer_host like '%.staging' then
    return true;
  end if;

  return false;
end;
$$;

COMMENT ON FUNCTION public.should_log_booking_dev_secrets() IS
  'True on local Supabase, staging guest origins, or when app.log_booking_dev_secrets=true.';

REVOKE ALL ON FUNCTION public.should_log_booking_dev_secrets() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.issue_booking_manage_token(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $$
declare
  v_raw_token text;
  v_token_hash text;
  v_expires_at timestamptz;
  v_reservation_code text;
  v_listing_type text;
  v_log text;
  v_headers jsonb := '{}'::jsonb;
  v_api_host text := '';
  v_fn_url text;
  v_auth text;
  v_apikey text;
begin
  v_raw_token := encode(gen_random_bytes(24), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
  v_expires_at := now() + interval '30 days';

  insert into public.booking_manage_tokens (booking_id, token_hash, expires_at)
  values (p_booking_id, v_token_hash, v_expires_at);

  if public.should_log_booking_dev_secrets() then
    select b."ReservationCode", b."ListingType"::text
      into v_reservation_code, v_listing_type
    from public."Bookings" b
    where b."Id" = p_booking_id;

    insert into public.booking_manage_token_dev_logs (
      booking_id, reservation_code, listing_type, token, expires_at
    ) values (
      p_booking_id, v_reservation_code, v_listing_type, v_raw_token, v_expires_at
    );

    delete from public.booking_manage_token_dev_logs
    where created_at < now() - interval '14 days';

    v_log := array_to_string(
      array[
        '========== BOOKING MANAGE TOKEN ==========',
        'booking_id: ' || coalesce(p_booking_id::text, ''),
        'reservation_code: ' || coalesce(v_reservation_code, ''),
        'listing_type: ' || coalesce(v_listing_type, ''),
        'token: ' || v_raw_token,
        'expires_at: ' || v_expires_at::text,
        '=========================================='
      ],
      E'\n'
    );
    raise warning '%', v_log;

    begin
      v_headers := coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb,
        '{}'::jsonb
      );
      v_api_host := lower(split_part(coalesce(v_headers->>'host', ''), ':', 1));
      v_auth := coalesce(v_headers->>'authorization', '');
      v_apikey := coalesce(v_headers->>'apikey', '');

      if v_api_host in ('127.0.0.1', 'localhost', 'kong') then
        v_fn_url := 'http://kong:8000/functions/v1/log-booking-manage-token';
      elsif v_api_host <> '' then
        v_fn_url := 'https://' || v_api_host || '/functions/v1/log-booking-manage-token';
      else
        v_fn_url := null;
      end if;

      if v_fn_url is not null then
        perform net.http_post(
          url := v_fn_url,
          body := jsonb_build_object(
            'bookingId', p_booking_id,
            'reservationCode', v_reservation_code,
            'listingType', v_listing_type,
            'token', v_raw_token,
            'expiresAt', v_expires_at
          ),
          headers := jsonb_strip_nulls(jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', nullif(v_auth, ''),
            'apikey', nullif(v_apikey, '')
          ))
        );
      end if;
    exception
      when others then
        null;
    end;
  end if;

  return jsonb_build_object(
    'success', true,
    'token', v_raw_token,
    'expires_at', v_expires_at
  );
end;
$$;
