-- Iron Cloud — Rider App dev seed + RLS
-- Run in Supabase SQL Editor after initial schema.

-- Mock rider profile (id must exist in auth.users for production; dev may use permissive FK)
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
VALUES (
  '00000000-0000-0000-0000-000000000002'::uuid,
  'KA01AB1234',
  'approved',
  4.8
)
ON CONFLICT (id) DO UPDATE SET
  kyc_status = EXCLUDED.kyc_status,
  rating_avg = EXCLUDED.rating_avg;

-- Map rider to all communities that have active orders
INSERT INTO public.rider_communities (rider_id, community_id)
SELECT DISTINCT '00000000-0000-0000-0000-000000000002'::uuid, o.community_id
FROM public.orders o
WHERE o.status NOT IN ('completed', 'rated', 'cancelled')
ON CONFLICT DO NOTHING;

-- Backfill pickup jobs for active orders without a pickup job
INSERT INTO public.rider_jobs (order_id, rider_id, job_type, status, scheduled_start, scheduled_end)
SELECT
  o.id,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'pickup'::job_type,
  (CASE
    WHEN o.status IN ('picked_up', 'delivered', 'completed') THEN 'completed'
    ELSE 'assigned'
  END)::job_status,
  ps.window_start,
  ps.window_end
FROM public.orders o
JOIN public.service_slots ps ON ps.id = o.pickup_slot_id
WHERE o.status IN (
  'booked', 'pickup_assigned', 'pickup_in_progress', 'picked_up',
  'warehouse_received', 'sorting', 'ironing', 'quality_check', 'packed',
  'ready_for_delivery', 'delivery_assigned', 'out_for_delivery', 'delivered'
)
AND NOT EXISTS (
  SELECT 1 FROM public.rider_jobs rj
  WHERE rj.order_id = o.id AND rj.job_type = 'pickup'::job_type
);

-- Backfill delivery jobs
INSERT INTO public.rider_jobs (order_id, rider_id, job_type, status, scheduled_start, scheduled_end)
SELECT
  o.id,
  '00000000-0000-0000-0000-000000000002'::uuid,
  'delivery'::job_type,
  (CASE
    WHEN o.status IN ('delivered', 'completed', 'rated') THEN 'completed'
    ELSE 'assigned'
  END)::job_status,
  ds.window_start,
  ds.window_end
FROM public.orders o
JOIN public.service_slots ds ON ds.id = o.delivery_slot_id
WHERE o.status IN (
  'picked_up', 'warehouse_received', 'sorting', 'ironing', 'quality_check',
  'packed', 'ready_for_delivery', 'delivery_assigned', 'out_for_delivery', 'delivered'
)
AND NOT EXISTS (
  SELECT 1 FROM public.rider_jobs rj
  WHERE rj.order_id = o.id AND rj.job_type = 'delivery'::job_type
);

-- ========== Dev RLS (permissive for mock rider app) ==========

-- Rider reads order items for assigned orders
DROP POLICY IF EXISTS "rider reads assigned order items" ON public.order_items;
CREATE POLICY "rider reads assigned order items" ON public.order_items
  FOR SELECT USING (
    order_id IN (
      SELECT order_id FROM public.rider_jobs
      WHERE rider_id = '00000000-0000-0000-0000-000000000002'::uuid
    )
  );

DROP POLICY IF EXISTS "rider writes assigned order items" ON public.order_items;
CREATE POLICY "rider writes assigned order items" ON public.order_items
  FOR ALL USING (
    order_id IN (
      SELECT order_id FROM public.rider_jobs
      WHERE rider_id = '00000000-0000-0000-0000-000000000002'::uuid
    )
  );

DROP POLICY IF EXISTS "rider reads assigned order events" ON public.order_events;
CREATE POLICY "rider reads assigned order events" ON public.order_events
  FOR SELECT USING (
    order_id IN (
      SELECT order_id FROM public.rider_jobs
      WHERE rider_id = '00000000-0000-0000-0000-000000000002'::uuid
    )
  );

DROP POLICY IF EXISTS "rider inserts order events" ON public.order_events;
CREATE POLICY "rider inserts order events" ON public.order_events
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT order_id FROM public.rider_jobs
      WHERE rider_id = '00000000-0000-0000-0000-000000000002'::uuid
    )
  );

DROP POLICY IF EXISTS "rider updates assigned orders" ON public.orders;
CREATE POLICY "rider updates assigned orders" ON public.orders
  FOR UPDATE USING (
    id IN (
      SELECT order_id FROM public.rider_jobs
      WHERE rider_id = '00000000-0000-0000-0000-000000000002'::uuid
    )
  );

DROP POLICY IF EXISTS "rider updates own jobs" ON public.rider_jobs;
CREATE POLICY "rider updates own jobs" ON public.rider_jobs
  FOR UPDATE USING (rider_id = '00000000-0000-0000-0000-000000000002'::uuid);

DROP POLICY IF EXISTS "rider inserts delivery jobs" ON public.rider_jobs;
CREATE POLICY "rider inserts delivery jobs" ON public.rider_jobs
  FOR INSERT WITH CHECK (rider_id = '00000000-0000-0000-0000-000000000002'::uuid);

-- Dev SELECT policies (mock auth has no Supabase session / auth.uid())
DROP POLICY IF EXISTS "dev mock rider reads jobs" ON public.rider_jobs;
CREATE POLICY "dev mock rider reads jobs" ON public.rider_jobs
  FOR SELECT USING (rider_id = '00000000-0000-0000-0000-000000000002'::uuid);

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
  FOR SELECT USING (id = '00000000-0000-0000-0000-000000000002'::uuid);

-- Public read for catalog
-- services, pricing_rules, communities, addresses typically need read access
DROP POLICY IF EXISTS "dev read services" ON public.services;
-- services table has no RLS in schema — OK

DROP POLICY IF EXISTS "dev read communities" ON public.communities;
-- communities has no RLS — OK
