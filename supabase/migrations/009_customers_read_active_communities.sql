-- Customers (and any signed-in user) need to browse active communities
-- when adding/editing address or completing onboarding.
drop policy if exists "authenticated read active communities" on public.communities;
create policy "authenticated read active communities"
  on public.communities
  for select
  using (
    status = 'active'
    and auth.uid() is not null
  );
