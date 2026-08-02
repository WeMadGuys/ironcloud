-- Allow riders to read name/phone for customers on their assigned jobs (contact on pickup/delivery).

drop policy if exists "rider reads assigned customer profiles" on public.profiles;
create policy "rider reads assigned customer profiles"
  on public.profiles
  for select
  using (
    id in (
      select o.customer_id
      from public.orders o
      join public.rider_jobs rj on rj.order_id = o.id
      where rj.rider_id = auth.uid()
    )
  );
