-- Display order for services in admin pricing and customer rate lists.
-- Backfill by name only while every row is still the default 0.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'sort_order'
  ) then
    alter table public.services
      add column sort_order integer not null default 0;
  end if;
end $$;

with ranked as (
  select id, (row_number() over (order by lower(name), id) - 1)::int as ord
  from public.services
  where not exists (
    select 1 from public.services existing where existing.sort_order <> 0
  )
)
update public.services as services
set sort_order = ranked.ord
from ranked
where services.id = ranked.id;

comment on column public.services.sort_order is
  'Display order in pricing and customer rate lists. Lower numbers come first.';
