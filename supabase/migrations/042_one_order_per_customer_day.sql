-- One active order per customer per pickup day.
-- The booking API used to check, then insert in a later request. Two overlapping
-- confirms both saw no order and both inserted. This function holds a
-- transaction lock across the check and the insert, so the second request
-- waits and returns the order the first request saved.

create or replace function public.release_service_slot_seat(p_slot_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.service_slots
  set booked_count = greatest(coalesce(booked_count, 0) - 1, 0)
  where id = p_slot_id;
$$;

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

  -- Serializes bookings for this customer on this pickup day only.
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
      'delivered'
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

revoke all on function public.release_service_slot_seat(uuid) from public;
revoke all on function public.release_service_slot_seat(uuid) from anon, authenticated;
grant execute on function public.release_service_slot_seat(uuid) to service_role;

revoke all on function public.claim_customer_pickup_day(uuid, date, text, uuid, uuid, jsonb) from public;
revoke all on function public.claim_customer_pickup_day(uuid, date, text, uuid, uuid, jsonb) from anon, authenticated;
grant execute on function public.claim_customer_pickup_day(uuid, date, text, uuid, uuid, jsonb) to service_role;

comment on function public.claim_customer_pickup_day(uuid, date, text, uuid, uuid, jsonb) is
  'Locks one customer pickup day, then returns the active order or inserts a new one.';

notify pgrst, 'reload schema';
