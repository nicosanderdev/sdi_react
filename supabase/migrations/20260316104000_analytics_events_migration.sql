-- Migration: create analytics_events table for first-party tracking

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  property_id text null,
  user_id text null,
  session_id text not null,
  source text null,
  medium text null,
  revenue numeric null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index analytics_events_event_name_idx on public.analytics_events (event_name);
create index analytics_events_property_id_idx on public.analytics_events (property_id);
create index analytics_events_session_id_idx on public.analytics_events (session_id);
create index analytics_events_created_at_idx on public.analytics_events (created_at);

