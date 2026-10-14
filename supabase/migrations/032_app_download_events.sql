-- Visits and store-button clicks on the public /get-app download page.

create table if not exists public.app_download_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('visit', 'app_store_click', 'play_store_click')),
  platform text not null
    check (platform in ('ios', 'android', 'desktop')),
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_download_events_created
  on public.app_download_events (created_at desc);

comment on table public.app_download_events is
  'Anonymous /get-app page events. Inserted server-side with the service role.';
comment on column public.app_download_events.source is
  'Optional ?src= value from the link, e.g. qr.';

alter table public.app_download_events enable row level security;

drop policy if exists "admin reads app download events" on public.app_download_events;
create policy "admin reads app download events"
  on public.app_download_events
  for select
  using (public.current_role() in ('ops_admin', 'super_admin'));
