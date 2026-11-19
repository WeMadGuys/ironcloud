-- One catalog row per garment name + target people + service type.
-- Saree / Women / Iron and Saree / Women / Steam iron are both allowed.

create unique index if not exists services_active_name_people_line_uidx
on public.services (lower(btrim(name)), garment_category, category)
where coalesce(is_active, true);
