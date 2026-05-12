-- Members onboarding columns required by get_admin_user_detail and reset_user_onboarding
-- (see 20260506154100_users_admin_rpcs_alignment.sql). Owner-facing flows may use separate RPCs.

begin;

alter table public."Members"
  add column if not exists "OnboardingStep" integer not null default 0;

alter table public."Members"
  add column if not exists "OnboardingComplete" boolean not null default false;

comment on column public."Members"."OnboardingStep" is
  'Admin RPC get_admin_user_detail / reset_user_onboarding; may diverge from get_owner_onboarding_state until unified.';

comment on column public."Members"."OnboardingComplete" is
  'Admin RPC get_admin_user_detail / reset_user_onboarding; may diverge from owner onboarding RPCs until unified.';

commit;
