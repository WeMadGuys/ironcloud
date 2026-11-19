-- Doorstep collection: wallet, Razorpay UPI QR, or both.
-- 'split' is added to payment_method and is intentionally not used in this
-- file. Postgres cannot use a new enum value in the same transaction that adds it.

alter type public.payment_method add value if not exists 'split';

create table if not exists public.delivery_collections (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  rider_id uuid not null references public.riders(id),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  wallet_amount numeric(10,2) not null default 0 check (wallet_amount >= 0),
  qr_amount numeric(10,2) not null default 0 check (qr_amount >= 0),
  status text not null default 'pending_qr'
    check (status in ('pending_qr', 'paid', 'cancelled', 'expired')),
  razorpay_qr_id text,
  razorpay_payment_id text,
  wallet_transaction_id uuid references public.wallet_transactions(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  closed_at timestamptz
);

create unique index if not exists delivery_collections_one_open
  on public.delivery_collections (order_id)
  where status = 'pending_qr';

create unique index if not exists delivery_collections_razorpay_qr_uidx
  on public.delivery_collections (razorpay_qr_id)
  where razorpay_qr_id is not null;

create index if not exists delivery_collections_order_idx
  on public.delivery_collections (order_id, created_at desc);

alter table public.delivery_collections enable row level security;

-- Riders have no policy. Money moves through the service-role API.
drop policy if exists "staff reads delivery collections" on public.delivery_collections;
create policy "staff reads delivery collections" on public.delivery_collections
  for select using (
    public.current_role() in ('warehouse_staff', 'support_agent', 'ops_admin', 'super_admin')
  );

comment on table public.delivery_collections is
  'One doorstep payment attempt. At most one pending_qr row per order.';

-- Locks the wallet row so two delivery debits cannot overdraw it.
create or replace function public.apply_customer_wallet_delta(
  p_customer_id uuid,
  p_amount numeric,
  p_direction text,
  p_order_id uuid,
  p_description text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.wallets%rowtype;
  v_amount numeric(10,2);
  v_new numeric(10,2);
  v_txn uuid;
  v_signed numeric(10,2);
  v_type public.wallet_txn_type;
begin
  v_amount := round(p_amount, 2);
  if v_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_direction = 'debit' then
    v_type := 'debit';
    v_signed := -v_amount;
  elsif p_direction = 'refund' then
    v_type := 'refund';
    v_signed := v_amount;
  else
    raise exception 'invalid direction';
  end if;

  select * into v_wallet
  from public.wallets
  where customer_id = p_customer_id
  for update;

  if not found then
    raise exception 'wallet_not_found';
  end if;

  if p_direction = 'debit' and v_wallet.balance < v_amount then
    raise exception 'insufficient_balance';
  end if;

  v_new := round(v_wallet.balance + v_signed, 2);

  update public.wallets
  set balance = v_new,
      updated_at = now()
  where id = v_wallet.id;

  insert into public.wallet_transactions (
    wallet_id, type, amount, balance_after, order_id, description
  ) values (
    v_wallet.id, v_type, v_signed, v_new, p_order_id, p_description
  )
  returning id into v_txn;

  return jsonb_build_object(
    'wallet_id', v_wallet.id,
    'transaction_id', v_txn,
    'balance_after', v_new
  );
end;
$$;

-- Moves a pending collection to a terminal status.
-- Refunds the wallet portion only when leaving pending_qr after a debit was stored.
create or replace function public.close_delivery_collection(
  p_collection_id uuid,
  p_status text,
  p_razorpay_payment_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.delivery_collections%rowtype;
  v_customer uuid;
begin
  if p_status not in ('paid', 'cancelled', 'expired') then
    raise exception 'invalid status';
  end if;

  select * into v_row
  from public.delivery_collections
  where id = p_collection_id
  for update;

  if not found then
    raise exception 'collection_not_found';
  end if;

  if v_row.status <> 'pending_qr' then
    return jsonb_build_object(
      'changed', false,
      'status', v_row.status
    );
  end if;

  update public.delivery_collections
  set status = p_status,
      razorpay_payment_id = coalesce(p_razorpay_payment_id, razorpay_payment_id),
      paid_at = case when p_status = 'paid' then now() else paid_at end,
      closed_at = now()
  where id = p_collection_id
  returning * into v_row;

  if p_status = 'paid' then
    update public.orders
    set payment_status = 'paid',
        updated_at = now()
    where id = v_row.order_id;
  elsif v_row.wallet_amount > 0 and v_row.wallet_transaction_id is not null then
    select customer_id into v_customer
    from public.orders
    where id = v_row.order_id;

    if v_customer is null then
      raise exception 'order_not_found';
    end if;

    perform public.apply_customer_wallet_delta(
      v_customer,
      v_row.wallet_amount,
      'refund',
      v_row.order_id,
      'Delivery payment cancelled (' || v_row.wallet_transaction_id::text || ')'
    );
  end if;

  return jsonb_build_object(
    'changed', true,
    'status', v_row.status
  );
end;
$$;

revoke all on function public.apply_customer_wallet_delta(uuid, numeric, text, uuid, text) from public;
revoke all on function public.apply_customer_wallet_delta(uuid, numeric, text, uuid, text) from anon;
revoke all on function public.apply_customer_wallet_delta(uuid, numeric, text, uuid, text) from authenticated;
grant execute on function public.apply_customer_wallet_delta(uuid, numeric, text, uuid, text) to service_role;

revoke all on function public.close_delivery_collection(uuid, text, text) from public;
revoke all on function public.close_delivery_collection(uuid, text, text) from anon;
revoke all on function public.close_delivery_collection(uuid, text, text) from authenticated;
grant execute on function public.close_delivery_collection(uuid, text, text) to service_role;
