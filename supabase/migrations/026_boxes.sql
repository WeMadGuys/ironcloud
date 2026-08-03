-- ============================================================
-- Iron Cloud — Physical box master + multi-box order linkage
-- ============================================================

create table if not exists public.boxes (
  id uuid primary key default gen_random_uuid(),
  box_code text not null,
  qr_code text not null,
  community_id uuid not null references public.communities(id),
  status text not null default 'AVAILABLE'
    check (status in ('AVAILABLE', 'OCCUPIED')),
  current_order_id uuid references public.orders(id) on delete set null,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boxes_box_code_unique unique (box_code),
  constraint boxes_qr_code_unique unique (qr_code)
);

create index if not exists idx_boxes_community on public.boxes (community_id);
create index if not exists idx_boxes_status on public.boxes (status) where is_active = true;
create index if not exists idx_boxes_current_order on public.boxes (current_order_id)
  where current_order_id is not null;

create table if not exists public.order_boxes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  box_id uuid not null references public.boxes(id),
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  assigned_by uuid references public.profiles(id),
  constraint order_boxes_order_box_unique unique (order_id, box_id)
);

-- One active assignment per box
create unique index if not exists idx_order_boxes_box_active
  on public.order_boxes (box_id)
  where released_at is null;

create index if not exists idx_order_boxes_order_active
  on public.order_boxes (order_id)
  where released_at is null;

create table if not exists public.box_events (
  id uuid primary key default gen_random_uuid(),
  box_id uuid references public.boxes(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  rider_id uuid references public.profiles(id) on delete set null,
  event_type text not null
    check (event_type in ('BOX_ASSIGNED', 'BOX_RELEASED', 'WRONG_BOX_SCAN')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_box_events_box on public.box_events (box_id, created_at desc);
create index if not exists idx_box_events_order on public.box_events (order_id, created_at desc);

-- updated_at touch
create or replace function public.set_boxes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boxes_set_updated_at on public.boxes;
create trigger boxes_set_updated_at
  before update on public.boxes
  for each row execute function public.set_boxes_updated_at();

-- Normalize scanned / typed codes
create or replace function public.normalize_box_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(trim(both from coalesce(p_code, '')));
$$;

-- ----------------------------------------------------------
-- Resolve scan: generic for rider now / warehouse later
-- ----------------------------------------------------------
create or replace function public.resolve_box_scan(
  p_box_code text,
  p_order_id uuid default null,
  p_mode text default 'lookup' -- lookup | pickup | delivery
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_box_code(p_box_code);
  v_box public.boxes%rowtype;
  v_order public.orders%rowtype;
  v_community_name text;
  v_customer_name text;
  v_customer_phone text;
  v_tower text;
  v_flat text;
  v_action text := 'none';
  v_can_act boolean := false;
  v_error text := null;
  v_linked boolean := false;
begin
  if v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'Empty box code');
  end if;

  select * into v_box
  from public.boxes
  where box_code = v_code
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Unknown box code');
  end if;

  select c.name into v_community_name
  from public.communities c
  where c.id = v_box.community_id;

  -- Prefer context order (pickup), else box's current order
  if p_order_id is not null then
    select * into v_order from public.orders where id = p_order_id;
  elsif v_box.current_order_id is not null then
    select * into v_order from public.orders where id = v_box.current_order_id;
  end if;

  if v_order.id is not null then
    select p.full_name, p.phone
      into v_customer_name, v_customer_phone
    from public.profiles p
    where p.id = v_order.customer_id;

    select a.tower, a.flat_number
      into v_tower, v_flat
    from public.addresses a
    where a.id = v_order.address_id;

    select exists (
      select 1
      from public.order_boxes ob
      where ob.order_id = v_order.id
        and ob.box_id = v_box.id
        and ob.released_at is null
    ) into v_linked;
  end if;

  if not v_box.is_active then
    v_error := 'This box is deactivated.';
  elsif p_mode = 'pickup' then
    if v_box.status = 'AVAILABLE' then
      v_action := 'attach';
      v_can_act := p_order_id is not null;
      if p_order_id is null then
        v_error := 'Order context required to attach.';
      elsif v_order.id is not null and v_box.community_id is distinct from v_order.community_id then
        v_can_act := false;
        v_error := 'Box community does not match this order.';
      end if;
    else
      v_error := 'This box is already occupied. Please scan another box.';
    end if;
  elsif p_mode = 'delivery' then
    if p_order_id is null then
      v_error := 'Order context required to release.';
    elsif not v_linked then
      v_error := 'Wrong box scanned.';
      v_action := 'none';
      v_can_act := false;
    elsif v_box.status = 'OCCUPIED' then
      v_action := 'release';
      v_can_act := true;
    else
      v_error := 'This box is already released.';
    end if;
  else
    -- generic lookup
    if v_box.status = 'AVAILABLE' and v_box.is_active then
      v_action := 'attach';
    elsif v_box.status = 'OCCUPIED' then
      v_action := 'release';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'error', v_error,
    'action', v_action,
    'canAct', v_can_act,
    'linkedToOrder', v_linked,
    'box', jsonb_build_object(
      'id', v_box.id,
      'boxCode', v_box.box_code,
      'status', v_box.status,
      'isActive', v_box.is_active,
      'communityId', v_box.community_id,
      'communityName', v_community_name,
      'currentOrderId', v_box.current_order_id,
      'lastUsedAt', v_box.last_used_at
    ),
    'order', case when v_order.id is null then null else jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'status', v_order.status,
      'communityId', v_order.community_id,
      'customerName', v_customer_name,
      'customerPhone', v_customer_phone,
      'tower', v_tower,
      'flatNumber', v_flat
    ) end
  );
end;
$$;

-- ----------------------------------------------------------
-- Attach one box to an order (pickup)
-- ----------------------------------------------------------
create or replace function public.attach_box_to_order(
  p_order_id uuid,
  p_box_code text,
  p_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_box_code(p_box_code);
  v_box public.boxes%rowtype;
  v_order public.orders%rowtype;
begin
  if p_order_id is null or v_code = '' then
    raise exception 'Order and box code are required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  select * into v_box from public.boxes where box_code = v_code for update;
  if not found then
    raise exception 'Unknown box code';
  end if;

  if not v_box.is_active then
    raise exception 'This box is deactivated';
  end if;

  if v_box.status <> 'AVAILABLE' then
    raise exception 'This box is already occupied. Please scan another box.';
  end if;

  if v_box.community_id is distinct from v_order.community_id then
    raise exception 'Box community does not match this order';
  end if;

  if exists (
    select 1 from public.order_boxes
    where order_id = p_order_id and box_id = v_box.id and released_at is null
  ) then
    return jsonb_build_object(
      'ok', true,
      'boxId', v_box.id,
      'boxCode', v_box.box_code,
      'alreadyAttached', true
    );
  end if;

  insert into public.order_boxes (order_id, box_id, assigned_by)
  values (p_order_id, v_box.id, p_rider_id);

  update public.boxes
  set
    status = 'OCCUPIED',
    current_order_id = p_order_id,
    last_used_at = now()
  where id = v_box.id;

  insert into public.box_events (box_id, order_id, rider_id, event_type, metadata)
  values (
    v_box.id,
    p_order_id,
    p_rider_id,
    'BOX_ASSIGNED',
    jsonb_build_object('boxCode', v_box.box_code, 'source', 'attach_box_to_order')
  );

  return jsonb_build_object(
    'ok', true,
    'boxId', v_box.id,
    'boxCode', v_box.box_code,
    'alreadyAttached', false
  );
end;
$$;

-- ----------------------------------------------------------
-- Release one box from an order (delivery)
-- ----------------------------------------------------------
create or replace function public.release_box_from_order(
  p_order_id uuid,
  p_box_code text,
  p_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := public.normalize_box_code(p_box_code);
  v_box public.boxes%rowtype;
  v_link public.order_boxes%rowtype;
begin
  if p_order_id is null or v_code = '' then
    raise exception 'Order and box code are required';
  end if;

  select * into v_box from public.boxes where box_code = v_code for update;
  if not found then
    raise exception 'Unknown box code';
  end if;

  select * into v_link
  from public.order_boxes
  where order_id = p_order_id
    and box_id = v_box.id
    and released_at is null
  for update;

  if not found then
    insert into public.box_events (box_id, order_id, rider_id, event_type, metadata)
    values (
      v_box.id,
      p_order_id,
      p_rider_id,
      'WRONG_BOX_SCAN',
      jsonb_build_object('boxCode', v_code, 'source', 'release_box_from_order')
    );
    raise exception 'Wrong box scanned.';
  end if;

  update public.order_boxes
  set released_at = now()
  where id = v_link.id;

  update public.boxes
  set
    status = 'AVAILABLE',
    current_order_id = null,
    last_used_at = now()
  where id = v_box.id;

  insert into public.box_events (box_id, order_id, rider_id, event_type, metadata)
  values (
    v_box.id,
    p_order_id,
    p_rider_id,
    'BOX_RELEASED',
    jsonb_build_object('boxCode', v_box.box_code, 'source', 'release_box_from_order')
  );

  return jsonb_build_object(
    'ok', true,
    'boxId', v_box.id,
    'boxCode', v_box.box_code
  );
end;
$$;

-- Remaining active boxes for an order
create or replace function public.count_active_order_boxes(p_order_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.order_boxes
  where order_id = p_order_id
    and released_at is null;
$$;

-- ----------------------------------------------------------
-- RLS
-- ----------------------------------------------------------
alter table public.boxes enable row level security;
alter table public.order_boxes enable row level security;
alter table public.box_events enable row level security;

drop policy if exists "admin full boxes" on public.boxes;
create policy "admin full boxes"
  on public.boxes
  for all
  using (public.current_role() in ('ops_admin', 'super_admin'))
  with check (public.current_role() in ('ops_admin', 'super_admin'));

drop policy if exists "rider reads boxes for communities" on public.boxes;
create policy "rider reads boxes for communities"
  on public.boxes
  for select
  using (
    public.current_role() = 'rider'
    and (
      community_id in (
        select rc.community_id
        from public.rider_communities rc
        where rc.rider_id = auth.uid()
      )
      or current_order_id in (
        select rj.order_id
        from public.rider_jobs rj
        where rj.rider_id = auth.uid()
      )
      or id in (
        select ob.box_id
        from public.order_boxes ob
        join public.rider_jobs rj on rj.order_id = ob.order_id
        where rj.rider_id = auth.uid()
      )
    )
  );

drop policy if exists "customer reads boxes for own orders" on public.boxes;
create policy "customer reads boxes for own orders"
  on public.boxes
  for select
  using (
    current_order_id in (
      select o.id from public.orders o where o.customer_id = auth.uid()
    )
    or id in (
      select ob.box_id
      from public.order_boxes ob
      join public.orders o on o.id = ob.order_id
      where o.customer_id = auth.uid()
    )
  );

drop policy if exists "admin full order_boxes" on public.order_boxes;
create policy "admin full order_boxes"
  on public.order_boxes
  for all
  using (public.current_role() in ('ops_admin', 'super_admin'))
  with check (public.current_role() in ('ops_admin', 'super_admin'));

drop policy if exists "rider reads order_boxes for jobs" on public.order_boxes;
create policy "rider reads order_boxes for jobs"
  on public.order_boxes
  for select
  using (
    order_id in (
      select rj.order_id from public.rider_jobs rj where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "customer reads own order_boxes" on public.order_boxes;
create policy "customer reads own order_boxes"
  on public.order_boxes
  for select
  using (
    order_id in (
      select o.id from public.orders o where o.customer_id = auth.uid()
    )
  );

drop policy if exists "admin reads box_events" on public.box_events;
create policy "admin reads box_events"
  on public.box_events
  for select
  using (public.current_role() in ('ops_admin', 'super_admin'));

drop policy if exists "rider reads own box_events" on public.box_events;
create policy "rider reads own box_events"
  on public.box_events
  for select
  using (rider_id = auth.uid());

-- RPCs callable by authenticated roles (logic enforces rules)
grant execute on function public.normalize_box_code(text) to authenticated;
grant execute on function public.resolve_box_scan(text, uuid, text) to authenticated;
grant execute on function public.attach_box_to_order(uuid, text, uuid) to authenticated;
grant execute on function public.release_box_from_order(uuid, text, uuid) to authenticated;
grant execute on function public.count_active_order_boxes(uuid) to authenticated;
