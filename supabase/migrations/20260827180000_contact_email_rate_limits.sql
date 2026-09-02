-- Rate-limit counters for the public send-contact-email edge function.
-- Service role only: tighter than otp_rate_limits (which allows anon SELECT).

CREATE TABLE public.contact_email_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    hits integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contact_email_rate_limits_pkey PRIMARY KEY (id),
    CONSTRAINT contact_email_rate_limits_hits_check CHECK (hits >= 0),
    CONSTRAINT contact_email_rate_limits_scope_check CHECK (
      scope = ANY (ARRAY['email'::text, 'ip'::text, 'global'::text])
    ),
    CONSTRAINT contact_email_rate_limits_scope_key_window_start_key UNIQUE (scope, key, window_start)
);

COMMENT ON TABLE public.contact_email_rate_limits IS
  'Fixed-window counters for send-contact-email. Written only by check_and_increment_contact_email_rate_limit.';

CREATE INDEX idx_contact_email_rate_limits_lookup
  ON public.contact_email_rate_limits (scope, key, window_start DESC);

ALTER TABLE public.contact_email_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.contact_email_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.contact_email_rate_limits TO service_role;

CREATE FUNCTION public.check_and_increment_contact_email_rate_limit(
  p_email text,
  p_ip text DEFAULT NULL,
  p_email_max_hits integer DEFAULT 3,
  p_ip_max_hits integer DEFAULT 10,
  p_global_max_hits integer DEFAULT 60,
  p_window_minutes integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('minute', v_now)
    - ((extract(minute from v_now)::integer % p_window_minutes) * interval '1 minute');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ip text := nullif(trim(coalesce(p_ip, '')), '');
  v_email_hits integer;
  v_ip_hits integer;
  v_global_hits integer;
begin
  if v_email = '' then
    return jsonb_build_object('allowed', false, 'reason', 'email_rate_limited');
  end if;

  insert into public.contact_email_rate_limits (scope, key, window_start, hits)
  values ('email', v_email, v_window_start, 1)
  on conflict (scope, key, window_start)
  do update set
    hits = public.contact_email_rate_limits.hits + 1,
    updated_at = now()
  returning hits into v_email_hits;

  if v_email_hits > p_email_max_hits then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'email_rate_limited'
    );
  end if;

  if v_ip is not null then
    insert into public.contact_email_rate_limits (scope, key, window_start, hits)
    values ('ip', v_ip, v_window_start, 1)
    on conflict (scope, key, window_start)
    do update set
      hits = public.contact_email_rate_limits.hits + 1,
      updated_at = now()
    returning hits into v_ip_hits;

    if v_ip_hits > p_ip_max_hits then
      return jsonb_build_object(
        'allowed', false,
        'reason', 'ip_rate_limited'
      );
    end if;
  end if;

  insert into public.contact_email_rate_limits (scope, key, window_start, hits)
  values ('global', 'all', v_window_start, 1)
  on conflict (scope, key, window_start)
  do update set
    hits = public.contact_email_rate_limits.hits + 1,
    updated_at = now()
  returning hits into v_global_hits;

  if v_global_hits > p_global_max_hits then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'global_rate_limited'
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

COMMENT ON FUNCTION public.check_and_increment_contact_email_rate_limit(text, text, integer, integer, integer, integer) IS
  'Increment-then-check email, IP, then global buckets for send-contact-email. Stops on first deny so a blocked identity does not consume later buckets.';

REVOKE ALL ON FUNCTION public.check_and_increment_contact_email_rate_limit(text, text, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_contact_email_rate_limit(text, text, integer, integer, integer, integer) TO service_role;
