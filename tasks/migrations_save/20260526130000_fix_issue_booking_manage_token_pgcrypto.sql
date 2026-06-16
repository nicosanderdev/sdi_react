-- confirm_booking_from_hold calls issue_booking_manage_token after booking insert.
-- That function uses pgcrypto (gen_random_bytes, digest) but had no extensions on search_path.
-- Prerequisite: booking_manage_tokens table exists.
-- NOTE: Manual execution by project owner (idempotent).

begin;

drop function if exists public.issue_booking_manage_token(uuid);

create or replace function public.issue_booking_manage_token(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_raw_token text;
  v_token_hash text;
begin
  v_raw_token := encode(gen_random_bytes(24), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  insert into public.booking_manage_tokens (booking_id, token_hash, expires_at)
  values (p_booking_id, v_token_hash, now() + interval '30 days');

  return jsonb_build_object(
    'success', true,
    'token', v_raw_token,
    'expires_at', now() + interval '30 days'
  );
end;
$$;

grant execute on function public.issue_booking_manage_token(uuid)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
