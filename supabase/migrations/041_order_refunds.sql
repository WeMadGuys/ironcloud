-- Partial and custom refunds credited to the customer wallet.
-- The original order bill and fulfillment status stay unchanged.

create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  wallet_transaction_id uuid not null unique references public.wallet_transactions(id),
  amount numeric(10,2) not null check (amount > 0),
  kind text not null check (kind in ('items', 'custom')),
  description text not null,
  created_by uuid not null references public.profiles(id),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_refunds_order
  on public.order_refunds (order_id, created_at desc);

create table if not exists public.order_refund_lines (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.order_refunds(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  line_amount numeric(10,2) not null check (line_amount >= 0)
);

create index if not exists idx_order_refund_lines_item
  on public.order_refund_lines (order_item_id);

alter table public.order_refunds enable row level security;
alter table public.order_refund_lines enable row level security;

drop policy if exists "admin reads order items" on public.order_items;
create policy "admin reads order items" on public.order_items
  for select using (public.current_role() in ('ops_admin', 'super_admin'));

drop policy if exists "admin reads order refunds" on public.order_refunds;
create policy "admin reads order refunds" on public.order_refunds
  for select using (public.current_role() in ('ops_admin', 'super_admin'));

drop policy if exists "admin reads order refund lines" on public.order_refund_lines;
create policy "admin reads order refund lines" on public.order_refund_lines
  for select using (public.current_role() in ('ops_admin', 'super_admin'));

revoke insert, update, delete on public.order_refunds from anon, authenticated;
revoke insert, update, delete on public.order_refund_lines from anon, authenticated;
grant select on public.order_refunds to authenticated, service_role;
grant select on public.order_refund_lines to authenticated, service_role;
grant insert, update, delete on public.order_refunds to service_role;
grant insert, update, delete on public.order_refund_lines to service_role;

create or replace function public.order_refund_receipt(p_refund_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund public.order_refunds%rowtype;
  v_customer_id uuid;
  v_payment_status text;
  v_total numeric(10,2);
  v_paid numeric(10,2);
  v_refunded numeric(10,2);
  v_balance numeric(10,2);
begin
  select * into v_refund
  from public.order_refunds
  where id = p_refund_id;

  if not found then
    raise exception 'Refund not found';
  end if;

  select customer_id, payment_status, total_amount
    into v_customer_id, v_payment_status, v_total
  from public.orders
  where id = v_refund.order_id;

  select coalesce(round(sum(abs(amount)), 2), 0)
    into v_paid
  from public.wallet_transactions
  where order_id = v_refund.order_id
    and type = 'debit';

  if v_paid = 0 and v_payment_status = 'paid' then
    v_paid := round(coalesce(v_total, 0), 2);
  end if;

  select coalesce(round(sum(amount), 2), 0)
    into v_refunded
  from public.order_refunds
  where order_id = v_refund.order_id;

  select balance
    into v_balance
  from public.wallets
  where customer_id = v_customer_id;

  return jsonb_build_object(
    'refund_id', v_refund.id,
    'amount', v_refund.amount,
    'balance', coalesce(v_balance, 0),
    'description', v_refund.description,
    'remaining', greatest(round(coalesce(v_paid, 0) - coalesce(v_refunded, 0), 2), 0)
  );
end;
$$;

create or replace function public.refund_order_to_wallet(
  p_order_id uuid,
  p_actor_id uuid,
  p_idempotency_key uuid,
  p_kind text,
  p_custom_amount numeric,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_existing_order uuid;
  v_customer_id uuid;
  v_order_number text;
  v_payment_status text;
  v_total numeric(10,2);
  v_wallet_id uuid;
  v_balance numeric(10,2);
  v_paid numeric(10,2);
  v_refunded numeric(10,2);
  v_remaining numeric(10,2);
  v_amount numeric(10,2) := 0;
  v_description text;
  v_parts text[] := '{}';
  v_line jsonb;
  v_item_id uuid;
  v_qty int;
  v_ordered int;
  v_unit numeric(10,2);
  v_item_order uuid;
  v_service_id uuid;
  v_name text;
  v_already int;
  v_line_amount numeric(10,2);
  v_computed_lines jsonb := '[]'::jsonb;
  v_txn_id uuid;
  v_refund_id uuid;
begin
  if p_actor_id is null then
    raise exception 'Actor required';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required';
  end if;

  if p_kind not in ('items', 'custom') then
    raise exception 'Invalid refund kind';
  end if;

  select id, order_id
    into v_existing_id, v_existing_order
  from public.order_refunds
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing_order is distinct from p_order_id then
      raise exception 'Idempotency key already used';
    end if;
    return public.order_refund_receipt(v_existing_id)
      || jsonb_build_object('idempotent', true);
  end if;

  select customer_id, order_number, payment_status, total_amount
    into v_customer_id, v_order_number, v_payment_status, v_total
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_payment_status is distinct from 'paid' then
    raise exception 'Order is not paid';
  end if;

  select id, balance
    into v_wallet_id, v_balance
  from public.wallets
  where customer_id = v_customer_id
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  select coalesce(round(sum(abs(amount)), 2), 0)
    into v_paid
  from public.wallet_transactions
  where order_id = p_order_id
    and type = 'debit';

  if v_paid = 0 then
    v_paid := round(coalesce(v_total, 0), 2);
  end if;

  select coalesce(round(sum(amount), 2), 0)
    into v_refunded
  from public.order_refunds
  where order_id = p_order_id;

  v_remaining := round(v_paid - v_refunded, 2);

  if p_kind = 'custom' then
    v_amount := round(coalesce(p_custom_amount, 0), 2);
    v_description := 'Refund for order ' || v_order_number;
  else
    if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
      raise exception 'Select at least one item to refund';
    end if;

    if (
      select count(*) from jsonb_array_elements(p_lines)
    ) is distinct from (
      select count(distinct elem->>'order_item_id')
      from jsonb_array_elements(p_lines) as elem
    ) then
      raise exception 'Each garment can only appear once in a refund';
    end if;

    for v_line in select value from jsonb_array_elements(p_lines)
    loop
      if v_line->>'order_item_id' is null or v_line->>'quantity' is null then
        raise exception 'Order item not found';
      end if;

      v_item_id := (v_line->>'order_item_id')::uuid;
      v_qty := (v_line->>'quantity')::int;

      if v_qty is null or v_qty <= 0 then
        raise exception 'Refund quantity must be greater than zero';
      end if;

      select quantity, unit_price, order_id, service_id
        into v_ordered, v_unit, v_item_order, v_service_id
      from public.order_items
      where id = v_item_id
      for update;

      if not found or v_item_order is distinct from p_order_id then
        raise exception 'Order item not found';
      end if;

      select name into v_name
      from public.services
      where id = v_service_id;

      select coalesce(sum(quantity), 0)
        into v_already
      from public.order_refund_lines lines
      join public.order_refunds refunds on refunds.id = lines.refund_id
      where lines.order_item_id = v_item_id;

      if v_qty > coalesce(v_ordered, 0) - coalesce(v_already, 0) then
        raise exception 'Refund quantity exceeds the remaining quantity';
      end if;

      v_line_amount := round(v_qty * coalesce(v_unit, 0), 2);
      v_amount := round(v_amount + v_line_amount, 2);
      v_parts := array_append(
        v_parts,
        coalesce(nullif(trim(v_name), ''), 'Item') || ' × ' || v_qty::text
      );
      v_computed_lines := v_computed_lines || jsonb_build_array(
        jsonb_build_object(
          'order_item_id', v_item_id,
          'quantity', v_qty,
          'unit_price', coalesce(v_unit, 0),
          'line_amount', v_line_amount
        )
      );
    end loop;

    v_description := 'Refund for order ' || v_order_number || ': ' || array_to_string(v_parts, ', ');
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;

  if v_amount > v_remaining then
    raise exception 'Refund exceeds the remaining paid amount';
  end if;

  v_balance := round(v_balance + v_amount, 2);

  insert into public.wallet_transactions (
    wallet_id,
    type,
    amount,
    balance_after,
    order_id,
    description
  ) values (
    v_wallet_id,
    'refund',
    v_amount,
    v_balance,
    p_order_id,
    v_description
  )
  returning id into v_txn_id;

  update public.wallets
  set balance = v_balance,
      updated_at = now()
  where id = v_wallet_id;

  insert into public.order_refunds (
    order_id,
    wallet_transaction_id,
    amount,
    kind,
    description,
    created_by,
    idempotency_key
  ) values (
    p_order_id,
    v_txn_id,
    v_amount,
    p_kind,
    v_description,
    p_actor_id,
    p_idempotency_key
  )
  returning id into v_refund_id;

  if p_kind = 'items' then
    for v_line in select value from jsonb_array_elements(v_computed_lines)
    loop
      insert into public.order_refund_lines (
        refund_id,
        order_item_id,
        quantity,
        unit_price,
        line_amount
      ) values (
        v_refund_id,
        (v_line->>'order_item_id')::uuid,
        (v_line->>'quantity')::int,
        (v_line->>'unit_price')::numeric,
        (v_line->>'line_amount')::numeric
      );
    end loop;
  end if;

  return public.order_refund_receipt(v_refund_id)
    || jsonb_build_object('idempotent', false);
exception
  when unique_violation then
    select id, order_id
      into v_existing_id, v_existing_order
    from public.order_refunds
    where idempotency_key = p_idempotency_key;

    if not found then
      raise;
    end if;

    if v_existing_order is distinct from p_order_id then
      raise exception 'Idempotency key already used';
    end if;

    return public.order_refund_receipt(v_existing_id)
      || jsonb_build_object('idempotent', true);
end;
$$;

revoke all on function public.order_refund_receipt(uuid) from public;
revoke all on function public.order_refund_receipt(uuid) from anon;
revoke all on function public.order_refund_receipt(uuid) from authenticated;
grant execute on function public.order_refund_receipt(uuid) to service_role;

revoke all on function public.refund_order_to_wallet(uuid, uuid, uuid, text, numeric, jsonb) from public;
revoke all on function public.refund_order_to_wallet(uuid, uuid, uuid, text, numeric, jsonb) from anon;
revoke all on function public.refund_order_to_wallet(uuid, uuid, uuid, text, numeric, jsonb) from authenticated;
grant execute on function public.refund_order_to_wallet(uuid, uuid, uuid, text, numeric, jsonb) to service_role;

comment on function public.refund_order_to_wallet(uuid, uuid, uuid, text, numeric, jsonb) is
  'Credits a partial item refund or custom amount to the customer wallet without changing order status.';
