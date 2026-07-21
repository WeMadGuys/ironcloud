-- Iron Cloud — Rider app demo data (run in Supabase SQL Editor)
-- Fixes empty home dashboard: seeds a pickup job for TODAY (IST) + dev read policies.
--
-- Prerequisites: base schema from docs/iron-cloud-database-schema.sql
-- Also run docs/rider-app-dev-setup.sql (rider profile + write policies)

-- ============================================================
-- 1) Dev RLS — allow anon app to READ mock rider data
--    (mock auth has no Supabase session, so auth.uid() is null)
-- ============================================================

DROP POLICY IF EXISTS "dev mock rider reads jobs" ON public.rider_jobs;
CREATE POLICY "dev mock rider reads jobs" ON public.rider_jobs
  FOR SELECT USING (
    rider_id = '00000000-0000-0000-0000-000000000002'::uuid
  );

DROP POLICY IF EXISTS "dev mock rider reads assigned orders" ON public.orders;
CREATE POLICY "dev mock rider reads assigned orders" ON public.orders
  FOR SELECT USING (
    id IN (
      SELECT order_id FROM public.rider_jobs
      WHERE rider_id = '00000000-0000-0000-0000-000000000002'::uuid
    )
  );

DROP POLICY IF EXISTS "dev mock rider reads profile" ON public.profiles;
CREATE POLICY "dev mock rider reads profile" ON public.profiles
  FOR SELECT USING (
    id = '00000000-0000-0000-0000-000000000002'::uuid
  );

-- ============================================================
-- 2) Auth users (required for profiles FK)
-- ============================================================

INSERT INTO auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919876543210', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919876543211', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3) Profiles + rider
--    (customer may already exist with phone 9876543210 — do not reuse that number)
-- ============================================================

INSERT INTO public.profiles (id, role, full_name, phone, email)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'customer',
  'Demo Customer',
  '9876543220',
  'customer@ironcloud.dev'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, role, full_name, phone, email)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'rider',
  'Rahul Kumar',
  '9876543211',
  'rider@ironcloud.dev'
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name;

INSERT INTO public.riders (id, vehicle_number, kyc_status, rating_avg)
VALUES ('00000000-0000-0000-0000-000000000002'::uuid, 'KA01AB1234', 'approved', 4.8)
ON CONFLICT (id) DO UPDATE SET kyc_status = EXCLUDED.kyc_status;

-- ============================================================
-- 4) Community, address, slots (TODAY pickup / TOMORROW delivery IST)
-- ============================================================

INSERT INTO public.communities (id, name, city, status, pricing_tier)
VALUES (
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'Prestige Lakeside Habitat',
  'Bengaluru',
  'active',
  'standard'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active';

INSERT INTO public.addresses (id, customer_id, community_id, tower, flat_number, is_default)
VALUES (
  'a1000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'Tower A',
  '1204',
  true
)
ON CONFLICT (id) DO UPDATE SET
  tower = EXCLUDED.tower,
  flat_number = EXCLUDED.flat_number;

INSERT INTO public.rider_communities (rider_id, community_id)
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid
)
ON CONFLICT DO NOTHING;

-- Pickup slot: today 8–11 AM IST
INSERT INTO public.service_slots (id, community_id, slot_type, window_start, window_end, capacity, booked_count)
VALUES (
  'a1000000-0000-0000-0000-000000000003'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'pickup'::slot_type,
  timezone('Asia/Kolkata', CURRENT_DATE + time '08:00'),
  timezone('Asia/Kolkata', CURRENT_DATE + time '11:00'),
  50,
  1
)
ON CONFLICT (id) DO UPDATE SET
  window_start = EXCLUDED.window_start,
  window_end = EXCLUDED.window_end;

-- Delivery slot: tomorrow 8–11 AM IST
INSERT INTO public.service_slots (id, community_id, slot_type, window_start, window_end, capacity, booked_count)
VALUES (
  'a1000000-0000-0000-0000-000000000004'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'delivery'::slot_type,
  timezone('Asia/Kolkata', CURRENT_DATE + interval '1 day' + time '08:00'),
  timezone('Asia/Kolkata', CURRENT_DATE + interval '1 day' + time '11:00'),
  50,
  1
)
ON CONFLICT (id) DO UPDATE SET
  window_start = EXCLUDED.window_start,
  window_end = EXCLUDED.window_end;

-- ============================================================
-- 5) Order + pickup rider job
-- ============================================================

INSERT INTO public.orders (
  id,
  order_number,
  customer_id,
  address_id,
  community_id,
  status,
  pickup_slot_id,
  delivery_slot_id,
  special_instructions,
  subtotal,
  total_amount
)
VALUES (
  'a1000000-0000-0000-0000-000000000005'::uuid,
  'IC-DEMO-' || to_char(CURRENT_DATE, 'YYYYMMDD'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'a1000000-0000-0000-0000-000000000002'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'pickup_assigned'::order_status,
  'a1000000-0000-0000-0000-000000000003'::uuid,
  'a1000000-0000-0000-0000-000000000004'::uuid,
  'Handle with care — office shirts',
  0,
  0
)
ON CONFLICT (id) DO UPDATE SET
  status = 'pickup_assigned'::order_status,
  pickup_slot_id = EXCLUDED.pickup_slot_id,
  delivery_slot_id = EXCLUDED.delivery_slot_id,
  special_instructions = EXCLUDED.special_instructions;

INSERT INTO public.order_events (order_id, status, note, metadata)
SELECT
  'a1000000-0000-0000-0000-000000000005'::uuid,
  'pickup_assigned',
  'Pickup partner assigned (demo seed)',
  '{"rider_id":"00000000-0000-0000-0000-000000000002"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.order_events
  WHERE order_id = 'a1000000-0000-0000-0000-000000000005'::uuid
    AND status = 'pickup_assigned'
);

INSERT INTO public.rider_jobs (order_id, rider_id, job_type, status, scheduled_start, scheduled_end)
SELECT
  'a1000000-0000-0000-0000-000000000005'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'pickup'::job_type,
  'assigned'::job_status,
  timezone('Asia/Kolkata', CURRENT_DATE + time '08:00'),
  timezone('Asia/Kolkata', CURRENT_DATE + time '11:00')
WHERE NOT EXISTS (
  SELECT 1 FROM public.rider_jobs
  WHERE order_id = 'a1000000-0000-0000-0000-000000000005'::uuid
    AND job_type = 'pickup'::job_type
);

-- Optional: second flat in same community (Tower B) for richer UI
INSERT INTO public.addresses (id, customer_id, community_id, tower, flat_number, is_default)
VALUES (
  'a1000000-0000-0000-0000-000000000006'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'Tower B',
  '502',
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_slots (id, community_id, slot_type, window_start, window_end, capacity, booked_count)
VALUES (
  'a1000000-0000-0000-0000-000000000007'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'pickup'::slot_type,
  timezone('Asia/Kolkata', CURRENT_DATE + time '11:00'),
  timezone('Asia/Kolkata', CURRENT_DATE + time '15:00'),
  50,
  1
)
ON CONFLICT (id) DO UPDATE SET
  window_start = EXCLUDED.window_start,
  window_end = EXCLUDED.window_end;

INSERT INTO public.orders (
  id,
  order_number,
  customer_id,
  address_id,
  community_id,
  status,
  pickup_slot_id,
  delivery_slot_id,
  special_instructions,
  subtotal,
  total_amount
)
VALUES (
  'a1000000-0000-0000-0000-000000000008'::uuid,
  'IC-DEMO2-' || to_char(CURRENT_DATE, 'YYYYMMDD'),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'a1000000-0000-0000-0000-000000000006'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  'pickup_assigned'::order_status,
  'a1000000-0000-0000-0000-000000000007'::uuid,
  'a1000000-0000-0000-0000-000000000004'::uuid,
  'Ring doorbell twice',
  0,
  0
)
ON CONFLICT (id) DO UPDATE SET status = 'pickup_assigned'::order_status;

INSERT INTO public.rider_jobs (order_id, rider_id, job_type, status, scheduled_start, scheduled_end)
SELECT
  'a1000000-0000-0000-0000-000000000008'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'pickup'::job_type,
  'assigned'::job_status,
  timezone('Asia/Kolkata', CURRENT_DATE + time '11:00'),
  timezone('Asia/Kolkata', CURRENT_DATE + time '15:00')
WHERE NOT EXISTS (
  SELECT 1 FROM public.rider_jobs
  WHERE order_id = 'a1000000-0000-0000-0000-000000000008'::uuid
    AND job_type = 'pickup'::job_type
);

-- ============================================================
-- 6) Garment catalog (for pickup screen +/- counters)
-- ============================================================

INSERT INTO public.services (id, category, name, unit, is_active)
VALUES
  ('b1000000-0000-0000-0000-000000000001'::uuid, 'ironing', 'Shirts', 'piece', true),
  ('b1000000-0000-0000-0000-000000000002'::uuid, 'ironing', 'T-Shirts', 'piece', true),
  ('b1000000-0000-0000-0000-000000000003'::uuid, 'ironing', 'Pants', 'piece', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

INSERT INTO public.pricing_rules (service_id, community_id, base_price)
SELECT 'b1000000-0000-0000-0000-000000000001'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid, 35
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules
  WHERE service_id = 'b1000000-0000-0000-0000-000000000001'::uuid
    AND community_id = 'a1000000-0000-0000-0000-000000000001'::uuid
);
INSERT INTO public.pricing_rules (service_id, community_id, base_price)
SELECT 'b1000000-0000-0000-0000-000000000002'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid, 30
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules
  WHERE service_id = 'b1000000-0000-0000-0000-000000000002'::uuid
    AND community_id = 'a1000000-0000-0000-0000-000000000001'::uuid
);
INSERT INTO public.pricing_rules (service_id, community_id, base_price)
SELECT 'b1000000-0000-0000-0000-000000000003'::uuid, 'a1000000-0000-0000-0000-000000000001'::uuid, 40
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules
  WHERE service_id = 'b1000000-0000-0000-0000-000000000003'::uuid
    AND community_id = 'a1000000-0000-0000-0000-000000000001'::uuid
);

-- ============================================================
-- Verify (should return 2 rows for today)
-- ============================================================
-- SELECT rj.id, rj.job_type, rj.status, o.order_number, ps.window_start
-- FROM public.rider_jobs rj
-- JOIN public.orders o ON o.id = rj.order_id
-- JOIN public.service_slots ps ON ps.id = o.pickup_slot_id
-- WHERE rj.rider_id = '00000000-0000-0000-0000-000000000002'::uuid;
