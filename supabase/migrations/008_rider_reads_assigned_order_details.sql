-- Rider app needs to read nested order details (address / community / items)
-- for jobs where rider_id = auth.uid(). Admin-only policies from 003 blocked this,
-- so jobs existed but mapped to 0 flats in the rider UI.

drop policy if exists "rider reads addresses for assigned orders" on public.addresses;
create policy "rider reads addresses for assigned orders"
  on public.addresses
  for select
  using (
    id in (
      select o.address_id
      from public.orders o
      join public.rider_jobs rj on rj.order_id = o.id
      where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "rider reads communities for assigned jobs" on public.communities;
create policy "rider reads communities for assigned jobs"
  on public.communities
  for select
  using (
    id in (
      select o.community_id
      from public.orders o
      join public.rider_jobs rj on rj.order_id = o.id
      where rj.rider_id = auth.uid()
    )
    or id in (
      select rc.community_id
      from public.rider_communities rc
      where rc.rider_id = auth.uid()
    )
  );

drop policy if exists "rider reads assigned order items" on public.order_items;
create policy "rider reads assigned order items"
  on public.order_items
  for select
  using (
    order_id in (
      select rj.order_id
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "rider updates own jobs" on public.rider_jobs;
create policy "rider updates own jobs"
  on public.rider_jobs
  for update
  using (rider_id = auth.uid());

drop policy if exists "rider updates assigned orders" on public.orders;
create policy "rider updates assigned orders"
  on public.orders
  for update
  using (
    id in (
      select rj.order_id
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "rider inserts order events" on public.order_events;
create policy "rider inserts order events"
  on public.order_events
  for insert
  with check (
    order_id in (
      select rj.order_id
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "rider reads assigned order events" on public.order_events;
create policy "rider reads assigned order events"
  on public.order_events
  for select
  using (
    order_id in (
      select rj.order_id
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

-- Allow riders to read their own community mappings (jobs list / coverage)
drop policy if exists "rider reads own community mappings" on public.rider_communities;
create policy "rider reads own community mappings"
  on public.rider_communities
  for select
  using (rider_id = auth.uid());
