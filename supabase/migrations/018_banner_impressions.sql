-- Promo banners: max show count + customer-readable active rows.

alter table public.banners
  add column if not exists max_impressions integer not null default 1;

alter table public.banners
  drop constraint if exists banners_max_impressions_check;
alter table public.banners
  add constraint banners_max_impressions_check
  check (max_impressions >= 1);

comment on column public.banners.max_impressions is
  'How many times a customer may see this banner before it stops (local device count).';

-- Customers need active banners for the home promo overlay.
drop policy if exists "authenticated reads active banners" on public.banners;
create policy "authenticated reads active banners"
  on public.banners
  for select
  to authenticated
  using (
    is_active = true
    and (active_from is null or active_from <= now())
    and (active_to is null or active_to >= now())
  );
