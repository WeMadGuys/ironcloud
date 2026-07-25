-- Allow customers to read rider↔community mappings for communities they belong to.
-- Booking still prefers the service-role API; this unblocks client-side reads
-- (e.g. mock/dev) without exposing all communities.

drop policy if exists "customer reads rider communities for own addresses" on public.rider_communities;
create policy "customer reads rider communities for own addresses"
  on public.rider_communities
  for select
  using (
    community_id in (
      select a.community_id
      from public.addresses a
      where a.customer_id = auth.uid()
    )
  );

-- Allow customers to read basic profile fields for riders assigned to their communities
-- (name/phone shown on pickup assignment UI).
drop policy if exists "customer reads assigned rider profiles" on public.profiles;
create policy "customer reads assigned rider profiles"
  on public.profiles
  for select
  using (
    role = 'rider'
    and id in (
      select rc.rider_id
      from public.rider_communities rc
      where rc.community_id in (
        select a.community_id
        from public.addresses a
        where a.customer_id = auth.uid()
      )
    )
  );
