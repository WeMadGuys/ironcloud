-- Speed up customer order list lookups (My Orders / home booking).
-- Safe for production; CONCURRENTLY avoids long locks when supported locally/remote.

create index if not exists idx_orders_customer_created
  on public.orders (customer_id, created_at desc);
