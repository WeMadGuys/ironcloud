-- Allow customers to cancel their own pre-pickup bookings without the Next.js API.
-- Mirrors apps/web/app/api/booking/cancel (service-role path still valid as fallback).

create or replace function public.cancel_customer_order(
  p_order_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select customer_id, status
    into v_customer_id, v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_customer_id is distinct from auth.uid() then
    raise exception 'You can only cancel your own bookings';
  end if;

  if v_status not in ('booked', 'pickup_assigned', 'pickup_in_progress') then
    raise exception
      'This booking can no longer be cancelled. Pickup may already be underway or complete.';
  end if;

  update public.orders
  set status = 'cancelled'
  where id = p_order_id;

  insert into public.order_events (order_id, status, actor_id, note, metadata)
  values (
    p_order_id,
    'cancelled',
    auth.uid(),
    coalesce(nullif(trim(p_reason), ''), 'Cancelled by customer'),
    '{}'::jsonb
  );

  update public.rider_jobs
  set
    status = 'failed',
    failure_reason = 'Customer cancelled',
    completed_at = now()
  where order_id = p_order_id
    and status in ('assigned', 'in_progress');
end;
$$;

revoke all on function public.cancel_customer_order(uuid, text) from public;
grant execute on function public.cancel_customer_order(uuid, text) to authenticated;

comment on function public.cancel_customer_order(uuid, text) is
  'Customer-initiated cancel for own pre-pickup orders (booked / pickup_assigned / pickup_in_progress).';
