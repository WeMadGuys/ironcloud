-- Order estimates (customer pre-booking) + payment status after pickup

alter table public.orders
  add column if not exists estimated_amount numeric,
  add column if not exists estimated_garments jsonb,
  add column if not exists payment_status text not null default 'unpaid';

alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'insufficient_funds'));

comment on column public.orders.estimated_amount is
  'Optional customer estimate total before pickup; not charged at booking.';

comment on column public.orders.estimated_garments is
  'Optional JSON array of {service_id, name, quantity, unit_price} from estimate card.';

comment on column public.orders.payment_status is
  'Wallet charge state: unpaid (default), paid after pickup debit, or insufficient_funds.';

-- Customers and riders need catalog prices for estimate + pickup counters
drop policy if exists "authenticated reads active services" on public.services;
create policy "authenticated reads active services" on public.services
  for select to authenticated
  using (is_active = true);

drop policy if exists "authenticated reads pricing rules" on public.pricing_rules;
create policy "authenticated reads pricing rules" on public.pricing_rules
  for select to authenticated
  using (true);
