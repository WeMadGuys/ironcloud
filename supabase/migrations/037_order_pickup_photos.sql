-- Private photos riders take of clothes at pickup.
-- Visible only to the rider assigned to that order, and removed when delivery completes.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-pickup-photos',
  'order-pickup-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rider reads pickup photos for assigned orders" on storage.objects;
create policy "rider reads pickup photos for assigned orders"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'order-pickup-photos'
    and (storage.foldername(name))[1] in (
      select rj.order_id::text
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "rider uploads pickup photos for assigned orders" on storage.objects;
create policy "rider uploads pickup photos for assigned orders"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'order-pickup-photos'
    and (storage.foldername(name))[1] in (
      select rj.order_id::text
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );

drop policy if exists "rider deletes pickup photos for assigned orders" on storage.objects;
create policy "rider deletes pickup photos for assigned orders"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'order-pickup-photos'
    and (storage.foldername(name))[1] in (
      select rj.order_id::text
      from public.rider_jobs rj
      where rj.rider_id = auth.uid()
    )
  );
