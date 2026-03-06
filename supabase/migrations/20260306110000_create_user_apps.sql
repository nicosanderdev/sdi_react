-- ============================================================================
-- user_apps: cross-application account awareness
-- ============================================================================
-- Tracks which apps (rentals_app, admin_app, venues_app) a user has used.
-- Apply this migration manually; the app does not run migrations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_apps (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    app_name text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT pk_user_apps PRIMARY KEY (id),
    CONSTRAINT uq_user_apps_user_id_app_name UNIQUE (user_id, app_name)
);

CREATE INDEX IF NOT EXISTS ix_user_apps_user_id_app_name
    ON public.user_apps (user_id, app_name);

COMMENT ON TABLE public.user_apps IS 'Tracks which platform apps (rentals_app, admin_app, venues_app) a user has used for first-time messaging.';
COMMENT ON COLUMN public.user_apps.app_name IS 'One of: rentals_app, admin_app, venues_app';

ALTER TABLE public.user_apps ENABLE ROW LEVEL SECURITY;

-- RLS: users can only read their own rows
CREATE POLICY "Users can select own user_apps"
    ON public.user_apps FOR SELECT
    USING (user_id = auth.uid());

-- RLS: users can only insert rows for themselves
CREATE POLICY "Users can insert own user_apps"
    ON public.user_apps FOR INSERT
    WITH CHECK (user_id = auth.uid());
