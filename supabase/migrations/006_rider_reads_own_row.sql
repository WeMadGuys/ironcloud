-- Allow riders to read their own row (needed for is_active gate in the rider app).
-- Admins already have "admin reads riders"; updates still go through the service-role API.

drop policy if exists "rider reads own row" on public.riders;
create policy "rider reads own row" on public.riders
  for select using (id = auth.uid());
