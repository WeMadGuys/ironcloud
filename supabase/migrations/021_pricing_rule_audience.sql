-- Pricing rules: audience scope (all | city | community | user).
-- Most granular matching rule wins at estimate/pickup.

alter table public.pricing_rules
  add column if not exists scope text;

alter table public.pricing_rules
  add column if not exists city text;

alter table public.pricing_rules
  add column if not exists user_id uuid references public.profiles(id);

-- Backfill from legacy community_id (null = platform default).
update public.pricing_rules
set scope = case
  when community_id is not null then 'community'
  else 'all'
end
where scope is null;

alter table public.pricing_rules
  alter column scope set default 'all';

alter table public.pricing_rules
  alter column scope set not null;

alter table public.pricing_rules
  drop constraint if exists pricing_rules_scope_check;

alter table public.pricing_rules
  add constraint pricing_rules_scope_check
  check (scope in ('all', 'city', 'community', 'user'));

alter table public.pricing_rules
  drop constraint if exists pricing_rules_scope_target_check;

alter table public.pricing_rules
  add constraint pricing_rules_scope_target_check
  check (
    (scope = 'all' and city is null and community_id is null and user_id is null)
    or (scope = 'city' and city is not null and community_id is null and user_id is null)
    or (scope = 'community' and community_id is not null and city is null and user_id is null)
    or (scope = 'user' and user_id is not null and city is null and community_id is null)
  );

-- Seed / legacy data may have multiple defaults per service; keep newest.
delete from public.pricing_rules
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by
          service_id,
          scope,
          coalesce(city, ''),
          coalesce(community_id::text, ''),
          coalesce(user_id::text, '')
        order by effective_from desc nulls last, id desc
      ) as rn
    from public.pricing_rules
  ) ranked
  where rn > 1
);

drop index if exists pricing_rules_service_audience_uidx;
create unique index pricing_rules_service_audience_uidx
  on public.pricing_rules (
    service_id,
    scope,
    coalesce(city, ''),
    coalesce(community_id::text, ''),
    coalesce(user_id::text, '')
  );

comment on column public.pricing_rules.scope is
  'Audience level: all | city | community | user. Most granular match wins at lookup.';

comment on column public.pricing_rules.city is
  'Target city when scope = city (matches communities.city, case-insensitive).';

comment on column public.pricing_rules.user_id is
  'Target customer profile when scope = user.';

-- Admin write access (ops / super).
drop policy if exists "admin writes pricing rules" on public.pricing_rules;
create policy "admin writes pricing rules"
  on public.pricing_rules
  for all
  using (public.current_role() in ('ops_admin', 'super_admin'))
  with check (public.current_role() in ('ops_admin', 'super_admin'));
