-- Public banner images for admin upload from Promotions → Banners.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banners',
  'banners',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Banner images are publicly accessible" on storage.objects;
create policy "Banner images are publicly accessible"
  on storage.objects
  for select
  using (bucket_id = 'banners');

drop policy if exists "Admins can upload banner images" on storage.objects;
create policy "Admins can upload banner images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'banners'
    and public.current_role() in ('ops_admin', 'super_admin')
  );

drop policy if exists "Admins can update banner images" on storage.objects;
create policy "Admins can update banner images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'banners'
    and public.current_role() in ('ops_admin', 'super_admin')
  )
  with check (
    bucket_id = 'banners'
    and public.current_role() in ('ops_admin', 'super_admin')
  );

drop policy if exists "Admins can delete banner images" on storage.objects;
create policy "Admins can delete banner images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'banners'
    and public.current_role() in ('ops_admin', 'super_admin')
  );
