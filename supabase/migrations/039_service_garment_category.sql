-- Garment groups shown in Settings pricing and the customer rates sheet.
-- Distinct from services.category, which is the service line (ironing, laundry, ...).

alter table public.services
  add column if not exists garment_category text not null default 'Others';

update public.services
set garment_category = 'Others'
where garment_category is null
   or btrim(garment_category) = '';

comment on column public.services.garment_category is
  'Customer-facing group such as Men, Women, Kids, Others, or a custom name.';
