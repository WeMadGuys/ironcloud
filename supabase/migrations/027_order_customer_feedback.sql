-- Customer delivery feedback on orders (Home banner → admin Orders columns).

alter table public.orders
  add column if not exists customer_rating smallint,
  add column if not exists customer_feedback text,
  add column if not exists feedback_dismissed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_customer_rating_check'
  ) then
    alter table public.orders
      add constraint orders_customer_rating_check
      check (
        customer_rating is null
        or (customer_rating >= 1 and customer_rating <= 5)
      );
  end if;
end $$;

comment on column public.orders.customer_rating is
  'Customer star rating (1–5) after delivery; null until submitted.';
comment on column public.orders.customer_feedback is
  'Optional customer written feedback after delivery.';
comment on column public.orders.feedback_dismissed_at is
  'Set when customer closes the feedback prompt without submitting.';

-- Submit rating + optional feedback; marks order rated.
create or replace function public.submit_order_feedback(
  p_order_id uuid,
  p_rating smallint,
  p_feedback text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_status text;
  v_existing_rating smallint;
  v_dismissed timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  select customer_id, status, customer_rating, feedback_dismissed_at
    into v_customer_id, v_status, v_existing_rating, v_dismissed
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_customer_id is distinct from auth.uid() then
    raise exception 'You can only rate your own orders';
  end if;

  if v_status is distinct from 'delivered' then
    raise exception 'Feedback is only available for delivered orders';
  end if;

  if v_existing_rating is not null then
    raise exception 'Feedback already submitted';
  end if;

  update public.orders
  set
    customer_rating = p_rating,
    customer_feedback = nullif(trim(coalesce(p_feedback, '')), ''),
    feedback_dismissed_at = null,
    status = 'rated'
  where id = p_order_id;

  insert into public.order_events (order_id, status, actor_id, note, metadata)
  values (
    p_order_id,
    'rated',
    auth.uid(),
    'Customer submitted delivery feedback',
    jsonb_build_object(
      'customer_rating', p_rating,
      'has_feedback', nullif(trim(coalesce(p_feedback, '')), '') is not null
    )
  );
end;
$$;

revoke all on function public.submit_order_feedback(uuid, smallint, text) from public;
grant execute on function public.submit_order_feedback(uuid, smallint, text) to authenticated;

comment on function public.submit_order_feedback(uuid, smallint, text) is
  'Customer submits 1–5 star rating (+ optional feedback) for a delivered order.';

-- Dismiss feedback prompt without submitting.
create or replace function public.dismiss_order_feedback(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_status text;
  v_existing_rating smallint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select customer_id, status, customer_rating
    into v_customer_id, v_status, v_existing_rating
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_customer_id is distinct from auth.uid() then
    raise exception 'You can only dismiss feedback for your own orders';
  end if;

  if v_status is distinct from 'delivered' then
    raise exception 'Feedback prompt is only available for delivered orders';
  end if;

  if v_existing_rating is not null then
    return;
  end if;

  update public.orders
  set feedback_dismissed_at = coalesce(feedback_dismissed_at, now())
  where id = p_order_id;
end;
$$;

revoke all on function public.dismiss_order_feedback(uuid) from public;
grant execute on function public.dismiss_order_feedback(uuid) to authenticated;

comment on function public.dismiss_order_feedback(uuid) is
  'Customer closes the delivery feedback prompt without submitting a rating.';
