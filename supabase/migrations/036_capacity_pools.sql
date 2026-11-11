-- Hourly pickup cap for one community or a shared pool of communities.
-- A community belongs to at most one pool. No pool means no hourly limit.
-- The cap is per pickup window (same clock hour), counted from live orders.

create table if not exists public.capacity_pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_orders integer not null,
  created_at timestamptz not null default now(),
  constraint capacity_pools_max_orders_check
    check (max_orders > 0 and max_orders <= 500)
);

create table if not exists public.capacity_pool_communities (
  pool_id uuid not null references public.capacity_pools(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  primary key (pool_id, community_id),
  constraint capacity_pool_communities_one_pool unique (community_id)
);

create index if not exists capacity_pool_communities_pool_idx
  on public.capacity_pool_communities (pool_id);

create index if not exists orders_pickup_slot_active_idx
  on public.orders (pickup_slot_id)
  where status not in ('draft', 'cancelled');

comment on table public.capacity_pools is
  'Max pickup orders per hour, for one community or a shared group.';

comment on table public.capacity_pool_communities is
  'Communities that share one hourly order cap. One community, one pool.';

alter table public.capacity_pools enable row level security;
alter table public.capacity_pool_communities enable row level security;

-- Customers never read these tables. Admin uses the service role.
-- Availability is exposed only as counts through pickup_capacity_for_windows.

create or replace function public.pickup_capacity_for_windows(
  p_community_id uuid,
  p_window_starts timestamptz[]
)
returns table (
  window_start timestamptz,
  booked integer,
  max_orders integer,
  is_full boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(array_length(p_window_starts, 1), 0) > 200 then
    raise exception 'too many windows';
  end if;

  return query
  select
    w.window_start,
    coalesce(c.booked, 0)::integer,
    p.max_orders,
    (p.id is not null and coalesce(c.booked, 0) >= p.max_orders) as is_full
  from unnest(p_window_starts) as w(window_start)
  left join lateral (
    select cp.id, cp.max_orders
    from public.capacity_pool_communities m
    join public.capacity_pools cp on cp.id = m.pool_id
    where m.community_id = p_community_id
    limit 1
  ) p on true
  left join lateral (
    select count(*)::integer as booked
    from public.orders o
    join public.service_slots s on s.id = o.pickup_slot_id
    join public.capacity_pool_communities m
      on m.community_id = o.community_id
     and m.pool_id = p.id
    where p.id is not null
      and s.slot_type = 'pickup'
      and s.window_start = w.window_start
      and o.status not in ('draft', 'cancelled')
  ) c on true;
end;
$$;

revoke all on function public.pickup_capacity_for_windows(uuid, timestamptz[]) from public;
grant execute on function public.pickup_capacity_for_windows(uuid, timestamptz[]) to authenticated, service_role;

create or replace function public.enforce_pickup_order_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool_id uuid;
  v_max integer;
  v_window timestamptz;
  v_booked integer;
begin
  if new.pickup_slot_id is null
     or new.status in ('draft', 'cancelled') then
    return new;
  end if;

  -- Already holding this same seat. Cancel and a slot change fall through.
  if tg_op = 'UPDATE'
     and old.pickup_slot_id is not distinct from new.pickup_slot_id
     and old.community_id is not distinct from new.community_id
     and old.status not in ('draft', 'cancelled') then
    return new;
  end if;

  select cp.id, cp.max_orders
    into v_pool_id, v_max
  from public.capacity_pool_communities m
  join public.capacity_pools cp on cp.id = m.pool_id
  where m.community_id = new.community_id
  for update of cp;

  if v_pool_id is null then
    return new;
  end if;

  select s.window_start
    into v_window
  from public.service_slots s
  where s.id = new.pickup_slot_id
    and s.slot_type = 'pickup';

  if v_window is null then
    return new;
  end if;

  select count(*)::integer
    into v_booked
  from public.orders o
  join public.service_slots s on s.id = o.pickup_slot_id
  join public.capacity_pool_communities m on m.community_id = o.community_id
  where m.pool_id = v_pool_id
    and s.slot_type = 'pickup'
    and s.window_start = v_window
    and o.status not in ('draft', 'cancelled')
    and o.id is distinct from new.id;

  if v_booked >= v_max then
    raise exception 'This pickup time is full. Please choose the next available slot.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_pickup_order_capacity() from public;

drop trigger if exists orders_enforce_pickup_capacity on public.orders;
create trigger orders_enforce_pickup_capacity
  before insert or update of status, pickup_slot_id, community_id
  on public.orders
  for each row
  execute function public.enforce_pickup_order_capacity();
