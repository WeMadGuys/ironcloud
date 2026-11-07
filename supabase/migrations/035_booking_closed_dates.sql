-- Calendar closed dates: block pickup booking for a date globally or per community.
-- community_id NULL = all communities; otherwise that community only.

create table if not exists public.booking_closed_dates (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade,
  closed_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create unique index if not exists booking_closed_dates_global_unique
  on public.booking_closed_dates (closed_date)
  where community_id is null;

create unique index if not exists booking_closed_dates_community_unique
  on public.booking_closed_dates (community_id, closed_date)
  where community_id is not null;

create index if not exists booking_closed_dates_date_idx
  on public.booking_closed_dates (closed_date);

create index if not exists booking_closed_dates_community_idx
  on public.booking_closed_dates (community_id, closed_date);

comment on table public.booking_closed_dates is
  'Dates when pickup booking is disabled (null community_id = all communities).';

alter table public.booking_closed_dates enable row level security;

drop policy if exists "authenticated reads booking closed dates"
  on public.booking_closed_dates;
create policy "authenticated reads booking closed dates"
  on public.booking_closed_dates
  for select
  to authenticated
  using (true);

drop policy if exists "admin reads booking closed dates"
  on public.booking_closed_dates;
create policy "admin reads booking closed dates"
  on public.booking_closed_dates
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('ops_admin', 'super_admin')
    )
  );
