-- Rider can drop an unconfirmed delivery date at pickup without a web API.
-- auth.uid() must own a pickup job on the order. Seat release stays service-definer.

create or replace function public.clear_order_delivery_slot(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id uuid;
begin
  if p_order_id is null then
    raise exception 'order id required';
  end if;

  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.rider_jobs
    where order_id = p_order_id
      and rider_id = auth.uid()
      and job_type = 'pickup'
  ) then
    raise exception 'Not authorized for this pickup order';
  end if;

  select delivery_slot_id
    into v_slot_id
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_slot_id is null then
    return;
  end if;

  update public.orders
  set delivery_slot_id = null
  where id = p_order_id;

  perform public.release_service_slot_seat(v_slot_id);
end;
$$;

revoke all on function public.clear_order_delivery_slot(uuid) from public;
revoke all on function public.clear_order_delivery_slot(uuid) from anon;
grant execute on function public.clear_order_delivery_slot(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
