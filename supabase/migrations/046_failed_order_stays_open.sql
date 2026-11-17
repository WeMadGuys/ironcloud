-- A failed stop still occupies the customer's pickup day.
-- Runs after 045 so the new order_status value is committed.

create or replace function public.claim_customer_pickup_day(
  p_customer_id uuid,
  p_pickup_day date,
  p_time_zone text,
  p_reserved_pickup_slot_id uuid,
  p_reserved_delivery_slot_id uuid,
  p_order jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_order_number text;
  v_status public.order_status;
  v_new_id uuid;
  v_new_number text;
begin
  if p_customer_id is null or p_pickup_day is null or p_time_zone is null or p_order is null then
    raise exception 'Missing booking claim arguments';
  end if;

  begin
    perform now() at time zone p_time_zone;
  exception
    when invalid_parameter_value then
      raise exception 'Invalid time zone';
  end;

  perform pg_advisory_xact_lock(
    hashtext(p_customer_id::text),
    hashtext(p_pickup_day::text)
  );

  select o.id, o.order_number, o.status
    into v_id, v_order_number, v_status
  from public.orders o
  join public.service_slots s on s.id = o.pickup_slot_id
  where o.customer_id = p_customer_id
    and o.status = any (array[
      'booked',
      'pickup_assigned',
      'pickup_in_progress',
      'picked_up',
      'warehouse_received',
      'sorting',
      'ironing',
      'quality_check',
      'packed',
      'ready_for_delivery',
      'delivery_assigned',
      'out_for_delivery',
      'delivered',
      'failed'
    ]::public.order_status[])
    and (s.window_start at time zone p_time_zone)::date = p_pickup_day
  order by
    case when o.status = 'delivered' then 1 else 0 end,
    o.created_at desc
  limit 1
  for update of o;

  if v_id is not null and v_status is distinct from 'delivered' then
    perform public.release_service_slot_seat(p_reserved_pickup_slot_id);
    perform public.release_service_slot_seat(p_reserved_delivery_slot_id);
    return jsonb_build_object(
      'already_existed', true,
      'order_id', v_id,
      'order_number', v_order_number
    );
  end if;

  if v_id is not null and v_status = 'delivered' then
    update public.orders
    set status = 'completed'
    where id = v_id;

    insert into public.order_events (order_id, status, note, metadata)
    values (
      v_id,
      'completed',
      'Order closed — customer ready to book again',
      '{}'::jsonb
    );
  end if;

  insert into public.orders (
    order_number,
    customer_id,
    address_id,
    community_id,
    status,
    pickup_slot_id,
    delivery_slot_id,
    special_instructions,
    subtotal,
    total_amount,
    payment_status,
    estimated_amount,
    estimated_garments
  )
  values (
    p_order->>'order_number',
    p_customer_id,
    (p_order->>'address_id')::uuid,
    (p_order->>'community_id')::uuid,
    'pickup_assigned',
    (p_order->>'pickup_slot_id')::uuid,
    (p_order->>'delivery_slot_id')::uuid,
    nullif(btrim(p_order->>'special_instructions'), ''),
    0,
    0,
    coalesce(nullif(p_order->>'payment_status', ''), 'unpaid'),
    nullif(p_order->>'estimated_amount', '')::numeric,
    case
      when p_order->'estimated_garments' is null
        or jsonb_typeof(p_order->'estimated_garments') = 'null'
      then null
      else p_order->'estimated_garments'
    end
  )
  returning id, order_number
  into v_new_id, v_new_number;

  return jsonb_build_object(
    'already_existed', false,
    'order_id', v_new_id,
    'order_number', v_new_number
  );
end;
$$;

-- Orders a rider already marked failed, while the order status was left unchanged.
update public.orders o
set status = 'failed'
where o.status in (
  'booked',
  'pickup_assigned',
  'pickup_in_progress',
  'picked_up',
  'warehouse_received',
  'sorting',
  'ironing',
  'quality_check',
  'packed',
  'ready_for_delivery',
  'delivery_assigned',
  'out_for_delivery'
)
and exists (
  select 1
  from public.rider_jobs rj
  where rj.order_id = o.id
    and rj.status = 'failed'
    and coalesce(rj.failure_reason, '') not in (
      'Customer cancelled',
      'Customer deleted account',
      'Rider deleted account',
      'Order cancelled'
    )
    and not exists (
      select 1
      from public.rider_jobs newer
      where newer.order_id = rj.order_id
        and newer.job_type = rj.job_type
        and newer.status in ('assigned', 'in_progress', 'completed')
        and newer.created_at > coalesce(rj.created_at, rj.completed_at, now())
    )
);

notify pgrst, 'reload schema';
