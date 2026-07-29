-- Admin list / dashboard filters at ~1k customers (safe, additive).
-- Prefer CONCURRENTLY in production if you can run outside a transaction.

create index if not exists idx_orders_created_at
  on public.orders (created_at desc);

create index if not exists idx_orders_community_created
  on public.orders (community_id, created_at desc);

create index if not exists idx_orders_pickup_slot
  on public.orders (pickup_slot_id);

create index if not exists idx_orders_status
  on public.orders (status);

create index if not exists idx_profiles_role_created
  on public.profiles (role, created_at desc);

create index if not exists idx_service_slots_window_start
  on public.service_slots (window_start);
