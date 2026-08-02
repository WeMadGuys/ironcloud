-- Allow assigned riders to write order_items at pickup (and correct counts after).
-- Previously riders only had SELECT; confirmPickup delete+insert failed under RLS.

drop policy if exists "rider inserts assigned order items" on public.order_items;
create policy "rider inserts assigned order items"
  on public.order_items
  for insert
  with check (
    order_id in (
      select rj.order_id
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "rider updates assigned order items" on public.order_items;
create policy "rider updates assigned order items"
  on public.order_items
  for update
  using (
    order_id in (
      select rj.order_id
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "rider deletes assigned order items" on public.order_items;
create policy "rider deletes assigned order items"
  on public.order_items
  for delete
  using (
    order_id in (
      select rj.order_id
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

-- Delivery job row created by rider after pickup confirm
drop policy if exists "rider inserts own jobs" on public.rider_jobs;
create policy "rider inserts own jobs"
  on public.rider_jobs
  for insert
  with check (rider_id = auth.uid());
