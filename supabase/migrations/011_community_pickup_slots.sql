-- Per-community hourly pickup slot templates (configured in admin community detail).
-- Actual dated booking windows still live in service_slots; these are the schedule options.

create table if not exists public.community_pickup_slots (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  start_hour integer not null,
  capacity integer not null default 50,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint community_pickup_slots_start_hour_check
    check (start_hour >= 0 and start_hour <= 23),
  constraint community_pickup_slots_capacity_check
    check (capacity > 0),
  constraint community_pickup_slots_unique_hour
    unique (community_id, start_hour)
);

create index if not exists community_pickup_slots_community_idx
  on public.community_pickup_slots (community_id, sort_order, start_hour);

comment on table public.community_pickup_slots is
  'Hourly pickup window templates per community (end = start_hour + 1).';

alter table public.community_pickup_slots enable row level security;

-- Customers need to see active slots for booking
drop policy if exists "authenticated reads active community pickup slots"
  on public.community_pickup_slots;
create policy "authenticated reads active community pickup slots"
  on public.community_pickup_slots
  for select
  to authenticated
  using (is_active = true);

-- Admins use service role via tRPC; optional admin read for authenticated admins
drop policy if exists "admin reads community pickup slots"
  on public.community_pickup_slots;
create policy "admin reads community pickup slots"
  on public.community_pickup_slots
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ops_admin', 'super_admin')
    )
  );
