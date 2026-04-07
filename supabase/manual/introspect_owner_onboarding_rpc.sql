-- Manual: run against your DB before/while aligning migrations.
-- Use output to reconcile column names if your schema already differs.

SELECT pg_get_functiondef('public.get_owner_onboarding_state'::regprocedure);
SELECT pg_get_functiondef('public.update_owner_onboarding_step'::regprocedure);
SELECT pg_get_functiondef('public.set_owner_onboarding_complete'::regprocedure);
SELECT pg_get_functiondef('public.set_member_verification'::regprocedure);

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'Members'
  AND (column_name ILIKE '%onboard%' OR column_name ILIKE '%verif%')
ORDER BY column_name;
