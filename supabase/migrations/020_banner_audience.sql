-- Banner audience targeting: cities + specific customers.

alter table public.banners
  add column if not exists cities text[] null;

alter table public.banners
  add column if not exists user_ids uuid[] null;

comment on column public.banners.cities is
  'Optional city allow-list (community.city). Null/empty = no city restriction.';

comment on column public.banners.user_ids is
  'Optional customer profile allow-list. When non-empty, only these users see the banner.';
