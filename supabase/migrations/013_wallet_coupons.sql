-- Wallet top-up coupon targeting + redemption tracking

alter table public.coupons
  add column if not exists applicable_on text[] not null default '{order}';

alter table public.coupons
  add column if not exists cities text[] null;

alter table public.coupons
  add column if not exists min_amount numeric(10,2) null;

comment on column public.coupons.applicable_on is 'Allowed values: order, wallet_topup';
comment on column public.coupons.cities is 'Nullable/empty = all cities; otherwise match community.city';
comment on column public.coupons.min_amount is 'Minimum top-up or order amount to qualify';

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_id uuid not null references public.profiles(id),
  context text not null,
  wallet_transaction_id uuid null references public.wallet_transactions(id),
  topup_amount numeric(10,2) null,
  bonus_amount numeric(10,2) null,
  created_at timestamptz default now(),
  unique (coupon_id, customer_id, context)
);

alter table public.coupon_redemptions enable row level security;

drop policy if exists "customer reads own coupon redemptions" on public.coupon_redemptions;
create policy "customer reads own coupon redemptions" on public.coupon_redemptions
  for select using (customer_id = auth.uid());

drop policy if exists "admin reads coupon redemptions" on public.coupon_redemptions;
create policy "admin reads coupon redemptions" on public.coupon_redemptions
  for select using (public.current_role() in ('ops_admin', 'super_admin'));

-- Customers can list currently valid wallet_topup coupons (eligibility refined in API).
drop policy if exists "customer reads wallet coupons" on public.coupons;
create policy "customer reads wallet coupons" on public.coupons
  for select using (
    public.current_role() = 'customer'
    and 'wallet_topup' = any (applicable_on)
    and (valid_from is null or valid_from <= now())
    and (valid_to is null or valid_to >= now())
  );
