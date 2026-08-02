-- Auto-advance orders to out_for_delivery when their delivery slot day has arrived.
-- Delivery rider_job is already created at pickup; this only flips order status.
-- Invoke via: select public.advance_orders_for_delivery_day();
-- Schedule with pg_cron (if enabled) or apps/web cron route /api/cron/advance-delivery-day.

create or replace function public.advance_orders_for_delivery_day()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
  v_today date := (timezone('Asia/Kolkata', now()))::date;
begin
  for r in
    select
      o.id as order_id,
      rj.rider_id
    from public.orders o
    inner join public.service_slots ds
      on ds.id = o.delivery_slot_id
    inner join public.rider_jobs rj
      on rj.order_id = o.id
     and rj.job_type = 'delivery'
     and rj.status in ('assigned', 'in_progress')
    where o.status in (
      'picked_up',
      'warehouse_received',
      'sorting',
      'ironing',
      'quality_check',
      'packed',
      'ready_for_delivery',
      'delivery_assigned'
    )
      and (timezone('Asia/Kolkata', ds.window_start))::date <= v_today
  loop
    update public.orders
    set status = 'out_for_delivery'
    where id = r.order_id
      and status is distinct from 'out_for_delivery';

    if found then
      insert into public.order_events (order_id, status, actor_id, note, metadata)
      values (
        r.order_id,
        'out_for_delivery',
        r.rider_id,
        'Delivery day started — out for delivery',
        jsonb_build_object(
          'source', 'advance_orders_for_delivery_day',
          'rider_id', r.rider_id
        )
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.advance_orders_for_delivery_day() from public;
grant execute on function public.advance_orders_for_delivery_day() to service_role;

comment on function public.advance_orders_for_delivery_day() is
  'Promotes picked-up (and later stage) orders to out_for_delivery when the delivery slot day is today or earlier (Asia/Kolkata). Requires an assigned delivery rider_job.';

-- Optional schedule when pg_cron is available (Supabase Pro / self-hosted).
do $cron$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'advance-orders-for-delivery-day';

    perform cron.schedule(
      'advance-orders-for-delivery-day',
      -- Once daily at 00:30 IST (pg_cron uses UTC → 19:00 UTC previous calendar day)
      '0 19 * * *',
      $job$select public.advance_orders_for_delivery_day();$job$
    );
  end if;
exception
  when others then
    raise notice 'Skipping pg_cron schedule for advance_orders_for_delivery_day: %', sqlerrm;
end;
$cron$;
