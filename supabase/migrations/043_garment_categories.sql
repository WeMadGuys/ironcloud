-- Display order for garment category tabs in pricing, customer rates, and rider pickup.
-- Defaults stay visible in admin even when no service uses them.

create table if not exists public.garment_categories (
  name text primary key,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

comment on table public.garment_categories is
  'Order of category tabs. Lower sort_order comes first. All stays pinned in the UI.';

insert into public.garment_categories (name, sort_order)
values
  ('Men', 0),
  ('Women', 1),
  ('Kids', 2),
  ('Others', 3)
on conflict (name) do nothing;

insert into public.garment_categories (name, sort_order)
select trimmed.name, 3 + trimmed.ord
from (
  select
    btrim(garment_category) as name,
    row_number() over (order by lower(btrim(garment_category)))::int as ord
  from (
    select distinct garment_category
    from public.services
    where btrim(coalesce(garment_category, '')) <> ''
  ) raw
) trimmed
where lower(trimmed.name) not in ('men', 'women', 'kids', 'others')
on conflict (name) do nothing;

alter table public.garment_categories enable row level security;

drop policy if exists "authenticated reads garment categories" on public.garment_categories;
create policy "authenticated reads garment categories"
  on public.garment_categories
  for select
  to authenticated
  using (true);

grant select on public.garment_categories to authenticated;
