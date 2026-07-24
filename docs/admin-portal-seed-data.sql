-- ============================================================
-- Iron Cloud — Admin Portal seed data (Supabase SQL Editor)
-- Real rows in Postgres — no app-side mock data.
--
-- Prerequisites (run once):
--   1. supabase/migrations/20260719000000_initial_schema.sql
--   2. supabase/migrations/003_admin_schema_extensions.sql
--   3. supabase/migrations/004_admin_allowed_emails.sql
--
-- Safe to re-run: uses fixed UUIDs + ON CONFLICT.
--
-- Admin login (apps/web):
--   Use Google OAuth on /admin/login.
--   Only emails in public.admin_allowed_emails can access.
--   Replace the placeholder after running migration 004:
--
--     INSERT INTO public.admin_allowed_emails (email, role)
--     VALUES ('your.real.admin@gmail.com', 'ops_admin')
--     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;
--
--     -- optional: remove placeholder
--     DELETE FROM public.admin_allowed_emails
--     WHERE email = 'your.admin@gmail.com';
-- ============================================================

-- ============================================================
-- 1) Auth users (required for profiles FK)
-- Note: Direct auth.users inserts may be blocked on some Supabase projects.
--       Google OAuth creates auth users automatically for admin web login.
-- ============================================================

INSERT INTO auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919999900001', now(), now(), now()),
  ('c0000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919876543301', now(), now(), now()),
  ('c0000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919876543302', now(), now(), now()),
  ('c0000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919876543303', now(), now(), now()),
  ('c0000000-0000-0000-0000-000000000005'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919876543311', now(), now(), now()),
  ('c0000000-0000-0000-0000-000000000006'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919876543312', now(), now(), now()),
  ('c0000000-0000-0000-0000-000000000007'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', '919876543320', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- Phone identities (required for Supabase phone OTP sign-in)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'phone', u.phone),
  'phone',
  u.phone,
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.id IN (
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'c0000000-0000-0000-0000-000000000002'::uuid,
  'c0000000-0000-0000-0000-000000000003'::uuid,
  'c0000000-0000-0000-0000-000000000004'::uuid,
  'c0000000-0000-0000-0000-000000000005'::uuid,
  'c0000000-0000-0000-0000-000000000006'::uuid,
  'c0000000-0000-0000-0000-000000000007'::uuid
)
AND NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.user_id = u.id AND i.provider = 'phone'
);

-- ============================================================
-- 2) Profiles (roles)
-- ============================================================

INSERT INTO public.profiles (id, role, full_name, phone)
VALUES
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'ops_admin', 'Admin User', '9999900001'),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'customer', 'Ananya Sharma', '9876543301'),
  ('c0000000-0000-0000-0000-000000000003'::uuid, 'customer', 'Rohan Mehta', '9876543302'),
  ('c0000000-0000-0000-0000-000000000004'::uuid, 'customer', 'Priya Nair', '9876543303'),
  ('c0000000-0000-0000-0000-000000000005'::uuid, 'rider', 'Vikram Singh', '9876543311'),
  ('c0000000-0000-0000-0000-000000000006'::uuid, 'rider', 'Suresh Reddy', '9876543312'),
  ('c0000000-0000-0000-0000-000000000007'::uuid, 'support_agent', 'Support Agent', '9876543320')
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone;

-- ============================================================
-- 3) Warehouse, communities, riders
-- ============================================================

INSERT INTO public.warehouses (id, name, city, is_active)
VALUES ('c1000000-0000-0000-0000-000000000001'::uuid, 'Iron Cloud Hub — Whitefield', 'Bengaluru', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO public.communities (id, name, city, status, pricing_tier)
VALUES
  ('c1000000-0000-0000-0000-000000000002'::uuid, 'Prestige Lakeside Habitat', 'Bengaluru', 'active', 'standard'),
  ('c1000000-0000-0000-0000-000000000003'::uuid, 'Sobha Dream Acres', 'Bengaluru', 'active', 'premium'),
  ('c1000000-0000-0000-0000-000000000004'::uuid, 'Brigade Metropolis', 'Bengaluru', 'active', 'standard')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active';

INSERT INTO public.riders (id, vehicle_number, kyc_status, rating_avg, current_lat, current_lng)
VALUES
  ('c0000000-0000-0000-0000-000000000005'::uuid, 'KA01CD5678', 'approved', 4.7, 12.9698, 77.7499),
  ('c0000000-0000-0000-0000-000000000006'::uuid, 'KA03EF9012', 'approved', 4.5, 12.9352, 77.6245)
ON CONFLICT (id) DO UPDATE SET
  kyc_status = EXCLUDED.kyc_status,
  rating_avg = EXCLUDED.rating_avg;

INSERT INTO public.rider_communities (rider_id, community_id)
VALUES
  ('c0000000-0000-0000-0000-000000000005'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid),
  ('c0000000-0000-0000-0000-000000000005'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid),
  ('c0000000-0000-0000-0000-000000000006'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid),
  ('c0000000-0000-0000-0000-000000000006'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4) Catalog, pricing, coupons
-- ============================================================

INSERT INTO public.services (id, category, name, unit, is_active)
VALUES
  ('c2000000-0000-0000-0000-000000000001'::uuid, 'ironing', 'Shirts', 'piece', true),
  ('c2000000-0000-0000-0000-000000000002'::uuid, 'ironing', 'T-Shirts', 'piece', true),
  ('c2000000-0000-0000-0000-000000000003'::uuid, 'ironing', 'Trousers', 'piece', true),
  ('c2000000-0000-0000-0000-000000000004'::uuid, 'laundry', 'Wash & Fold (kg)', 'kg', true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

INSERT INTO public.pricing_rules (id, service_id, community_id, base_price, express_multiplier)
VALUES
  ('c2000000-0000-0000-0000-000000000010'::uuid, 'c2000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 35, 1.5),
  ('c2000000-0000-0000-0000-000000000011'::uuid, 'c2000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 30, 1.5),
  ('c2000000-0000-0000-0000-000000000012'::uuid, 'c2000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 40, 1.6),
  ('c2000000-0000-0000-0000-000000000013'::uuid, 'c2000000-0000-0000-0000-000000000004'::uuid, null, 90, 1.4)
ON CONFLICT (id) DO UPDATE SET base_price = EXCLUDED.base_price;

INSERT INTO public.coupons (id, code, discount_type, discount_value, max_discount, usage_limit, used_count, valid_from, valid_to)
VALUES
  ('c2000000-0000-0000-0000-000000000020'::uuid, 'WELCOME50', 'flat', 50, 50, 1000, 42, now() - interval '30 days', now() + interval '60 days'),
  ('c2000000-0000-0000-0000-000000000021'::uuid, 'IRON10', 'percentage', 10, 150, 500, 18, now() - interval '7 days', now() + interval '30 days')
ON CONFLICT (id) DO UPDATE SET used_count = EXCLUDED.used_count;

-- ============================================================
-- 5) Addresses & service slots (today / tomorrow IST)
-- ============================================================

INSERT INTO public.addresses (id, customer_id, community_id, tower, flat_number, is_default)
VALUES
  ('c3000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Tower A', '1204', true),
  ('c3000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 'Block 7', '304', true),
  ('c3000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, 'Tower C', '902', true)
ON CONFLICT (id) DO UPDATE SET tower = EXCLUDED.tower, flat_number = EXCLUDED.flat_number;

INSERT INTO public.service_slots (id, community_id, slot_type, window_start, window_end, capacity, booked_count)
VALUES
  ('c3000000-0000-0000-0000-000000000010'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'pickup', timezone('Asia/Kolkata', CURRENT_DATE + time '08:00'), timezone('Asia/Kolkata', CURRENT_DATE + time '11:00'), 50, 3),
  ('c3000000-0000-0000-0000-000000000011'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'delivery', timezone('Asia/Kolkata', CURRENT_DATE + interval '1 day' + time '17:00'), timezone('Asia/Kolkata', CURRENT_DATE + interval '1 day' + time '20:00'), 50, 2),
  ('c3000000-0000-0000-0000-000000000012'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 'pickup', timezone('Asia/Kolkata', CURRENT_DATE + time '11:00'), timezone('Asia/Kolkata', CURRENT_DATE + time '14:00'), 50, 2),
  ('c3000000-0000-0000-0000-000000000013'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, 'pickup', timezone('Asia/Kolkata', CURRENT_DATE + time '14:00'), timezone('Asia/Kolkata', CURRENT_DATE + time '17:00'), 50, 2)
ON CONFLICT (id) DO UPDATE SET
  window_start = EXCLUDED.window_start,
  window_end = EXCLUDED.window_end,
  booked_count = EXCLUDED.booked_count;

-- ============================================================
-- 6) Wallets & transactions
--     (wallets are auto-created by profile trigger — update balances)
-- ============================================================

UPDATE public.wallets SET balance = 2480.00, updated_at = now()
WHERE customer_id = 'c0000000-0000-0000-0000-000000000002'::uuid;

UPDATE public.wallets SET balance = 860.00, updated_at = now()
WHERE customer_id = 'c0000000-0000-0000-0000-000000000003'::uuid;

UPDATE public.wallets SET balance = 45.00, updated_at = now()
WHERE customer_id = 'c0000000-0000-0000-0000-000000000004'::uuid;

INSERT INTO public.wallet_transactions (id, wallet_id, type, amount, balance_after, description, created_at)
SELECT 'c4000000-0000-0000-0000-000000000010'::uuid, w.id, 'recharge'::wallet_txn_type, 3000, 3000, 'UPI recharge', now() - interval '10 days'
FROM public.wallets w WHERE w.customer_id = 'c0000000-0000-0000-0000-000000000002'::uuid
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallet_transactions (id, wallet_id, type, amount, balance_after, description, created_at)
SELECT 'c4000000-0000-0000-0000-000000000011'::uuid, w.id, 'debit'::wallet_txn_type, -520, 2480, 'Order payment', now() - interval '2 days'
FROM public.wallets w WHERE w.customer_id = 'c0000000-0000-0000-0000-000000000002'::uuid
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallet_transactions (id, wallet_id, type, amount, balance_after, description, created_at)
SELECT 'c4000000-0000-0000-0000-000000000012'::uuid, w.id, 'recharge'::wallet_txn_type, 1000, 1000, 'Card recharge', now() - interval '5 days'
FROM public.wallets w WHERE w.customer_id = 'c0000000-0000-0000-0000-000000000003'::uuid
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallet_transactions (id, wallet_id, type, amount, balance_after, description, created_at)
SELECT 'c4000000-0000-0000-0000-000000000013'::uuid, w.id, 'debit'::wallet_txn_type, -140, 860, 'Order payment', now() - interval '1 day'
FROM public.wallets w WHERE w.customer_id = 'c0000000-0000-0000-0000-000000000003'::uuid
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallet_transactions (id, wallet_id, type, amount, balance_after, description, created_at)
SELECT 'c4000000-0000-0000-0000-000000000014'::uuid, w.id, 'recharge'::wallet_txn_type, 200, 200, 'Welcome bonus', now() - interval '20 days'
FROM public.wallets w WHERE w.customer_id = 'c0000000-0000-0000-0000-000000000004'::uuid
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.wallet_transactions (id, wallet_id, type, amount, balance_after, description, created_at)
SELECT 'c4000000-0000-0000-0000-000000000015'::uuid, w.id, 'debit'::wallet_txn_type, -155, 45, 'Order payment', now() - interval '3 days'
FROM public.wallets w WHERE w.customer_id = 'c0000000-0000-0000-0000-000000000004'::uuid
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 7) Partners
-- ============================================================

INSERT INTO public.partners (id, name, contact_name, phone, email, city, kyc_status, verification_status, capacity, rating_avg, is_active)
VALUES
  ('c5000000-0000-0000-0000-000000000001'::uuid, 'IronPress Koramangala', 'Karthik Rao', '9876500101', 'koramangala@ironpress.in', 'Bengaluru', 'approved', 'verified', 120, 4.8, true),
  ('c5000000-0000-0000-0000-000000000002'::uuid, 'FreshFold Indiranagar', 'Meena Iyer', '9876500102', 'indiranagar@freshfold.in', 'Bengaluru', 'approved', 'verified', 80, 4.6, true),
  ('c5000000-0000-0000-0000-000000000003'::uuid, 'SteamWorks HSR', 'Arjun Das', '9876500103', 'hsr@steamworks.in', 'Bengaluru', 'pending', 'pending', 60, 4.2, false)
ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active, rating_avg = EXCLUDED.rating_avg;

INSERT INTO public.partner_communities (partner_id, community_id)
VALUES
  ('c5000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid),
  ('c5000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid),
  ('c5000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8) Orders (today = dashboard KPIs; yesterday = trends; 30d = charts)
--     Status spread across all dashboard buckets
-- ============================================================

INSERT INTO public.orders (
  id, order_number, customer_id, address_id, community_id, warehouse_id,
  status, pickup_slot_id, delivery_slot_id, partner_id,
  subtotal, discount, total_amount, payment_method, created_at, updated_at
)
VALUES
  -- TODAY — pending pickups
  ('c6000000-0000-0000-0000-000000000001'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0001',
    'c0000000-0000-0000-0000-000000000002'::uuid, 'c3000000-0000-0000-0000-000000000001'::uuid,
    'c1000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'booked', 'c3000000-0000-0000-0000-000000000010'::uuid, 'c3000000-0000-0000-0000-000000000011'::uuid, null,
    420, 0, 420, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE + time '09:15'), now()),

  ('c6000000-0000-0000-0000-000000000002'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0002',
    'c0000000-0000-0000-0000-000000000003'::uuid, 'c3000000-0000-0000-0000-000000000002'::uuid,
    'c1000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'pickup_assigned', 'c3000000-0000-0000-0000-000000000012'::uuid, null, null,
    280, 20, 260, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE + time '10:00'), now()),

  ('c6000000-0000-0000-0000-000000000003'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0003',
    'c0000000-0000-0000-0000-000000000004'::uuid, 'c3000000-0000-0000-0000-000000000003'::uuid,
    'c1000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'pickup_in_progress', 'c3000000-0000-0000-0000-000000000013'::uuid, null, null,
    190, 0, 190, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE + time '10:45'), now()),

  -- TODAY — in progress (warehouse / ironing)
  ('c6000000-0000-0000-0000-000000000004'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0004',
    'c0000000-0000-0000-0000-000000000002'::uuid, 'c3000000-0000-0000-0000-000000000001'::uuid,
    'c1000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'ironing', 'c3000000-0000-0000-0000-000000000010'::uuid, 'c3000000-0000-0000-0000-000000000011'::uuid,
    'c5000000-0000-0000-0000-000000000001'::uuid, 560, 50, 510, 'wallet',
    timezone('Asia/Kolkata', CURRENT_DATE + time '08:30'), now()),

  ('c6000000-0000-0000-0000-000000000005'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0005',
    'c0000000-0000-0000-0000-000000000003'::uuid, 'c3000000-0000-0000-0000-000000000002'::uuid,
    'c1000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'quality_check', 'c3000000-0000-0000-0000-000000000012'::uuid, null,
    'c5000000-0000-0000-0000-000000000001'::uuid, 340, 0, 340, 'wallet',
    timezone('Asia/Kolkata', CURRENT_DATE + time '07:50'), now()),

  ('c6000000-0000-0000-0000-000000000006'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0006',
    'c0000000-0000-0000-0000-000000000002'::uuid, 'c3000000-0000-0000-0000-000000000001'::uuid,
    'c1000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'ready_for_delivery', 'c3000000-0000-0000-0000-000000000010'::uuid, 'c3000000-0000-0000-0000-000000000011'::uuid,
    'c5000000-0000-0000-0000-000000000002'::uuid, 720, 0, 720, 'wallet',
    timezone('Asia/Kolkata', CURRENT_DATE + time '07:00'), now()),

  -- TODAY — out for delivery
  ('c6000000-0000-0000-0000-000000000007'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0007',
    'c0000000-0000-0000-0000-000000000004'::uuid, 'c3000000-0000-0000-0000-000000000003'::uuid,
    'c1000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'out_for_delivery', null, null, 'c5000000-0000-0000-0000-000000000002'::uuid,
    410, 10, 400, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE + time '06:30'), now()),

  -- TODAY — delivered / completed
  ('c6000000-0000-0000-0000-000000000008'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0008',
    'c0000000-0000-0000-0000-000000000003'::uuid, 'c3000000-0000-0000-0000-000000000002'::uuid,
    'c1000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'delivered', null, null, 'c5000000-0000-0000-0000-000000000001'::uuid,
    295, 0, 295, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE + time '06:00'), now()),

  ('c6000000-0000-0000-0000-000000000009'::uuid, 'IC-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0009',
    'c0000000-0000-0000-0000-000000000002'::uuid, 'c3000000-0000-0000-0000-000000000001'::uuid,
    'c1000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'completed', null, null, 'c5000000-0000-0000-0000-000000000001'::uuid,
    480, 30, 450, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE + time '05:30'), now()),

  -- YESTERDAY (dashboard trend comparison)
  ('c6000000-0000-0000-0000-000000000010'::uuid, 'IC-' || to_char(CURRENT_DATE - 1, 'YYYYMMDD') || '-0010',
    'c0000000-0000-0000-0000-000000000002'::uuid, 'c3000000-0000-0000-0000-000000000001'::uuid,
    'c1000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'completed', null, null, 'c5000000-0000-0000-0000-000000000001'::uuid,
    350, 0, 350, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE - 1 + time '14:00'), now()),

  ('c6000000-0000-0000-0000-000000000011'::uuid, 'IC-' || to_char(CURRENT_DATE - 1, 'YYYYMMDD') || '-0011',
    'c0000000-0000-0000-0000-000000000003'::uuid, 'c3000000-0000-0000-0000-000000000002'::uuid,
    'c1000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'cancelled', null, null, null,
    200, 0, 200, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE - 1 + time '16:00'), now()),

  -- LAST 30 DAYS (analytics charts)
  ('c6000000-0000-0000-0000-000000000012'::uuid, 'IC-' || to_char(CURRENT_DATE - 7, 'YYYYMMDD') || '-0012',
    'c0000000-0000-0000-0000-000000000004'::uuid, 'c3000000-0000-0000-0000-000000000003'::uuid,
    'c1000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'rated', null, null, 'c5000000-0000-0000-0000-000000000002'::uuid,
    520, 20, 500, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE - 7 + time '12:00'), now()),

  ('c6000000-0000-0000-0000-000000000013'::uuid, 'IC-' || to_char(CURRENT_DATE - 14, 'YYYYMMDD') || '-0013',
    'c0000000-0000-0000-0000-000000000002'::uuid, 'c3000000-0000-0000-0000-000000000001'::uuid,
    'c1000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid,
    'refund_completed', null, null, null,
    180, 0, 180, 'wallet', timezone('Asia/Kolkata', CURRENT_DATE - 14 + time '11:00'), now())
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  total_amount = EXCLUDED.total_amount,
  partner_id = EXCLUDED.partner_id,
  updated_at = now();

-- Partner order assignments
INSERT INTO public.partner_orders (partner_id, order_id)
SELECT partner_id, id FROM public.orders
WHERE partner_id IS NOT NULL
  AND id::text LIKE 'c6000000%'
ON CONFLICT DO NOTHING;

-- Order items
INSERT INTO public.order_items (id, order_id, service_id, quantity, unit_price)
VALUES
  ('c6000000-0000-0000-0000-000000000101'::uuid, 'c6000000-0000-0000-0000-000000000001'::uuid, 'c2000000-0000-0000-0000-000000000001'::uuid, 6, 35),
  ('c6000000-0000-0000-0000-000000000102'::uuid, 'c6000000-0000-0000-0000-000000000004'::uuid, 'c2000000-0000-0000-0000-000000000001'::uuid, 8, 35),
  ('c6000000-0000-0000-0000-000000000103'::uuid, 'c6000000-0000-0000-0000-000000000004'::uuid, 'c2000000-0000-0000-0000-000000000003'::uuid, 4, 40),
  ('c6000000-0000-0000-0000-000000000104'::uuid, 'c6000000-0000-0000-0000-000000000008'::uuid, 'c2000000-0000-0000-0000-000000000002'::uuid, 5, 30)
ON CONFLICT (id) DO NOTHING;

-- Order timeline events
INSERT INTO public.order_events (id, order_id, status, actor_id, note, created_at)
VALUES
  ('c6000000-0000-0000-0000-000000000201'::uuid, 'c6000000-0000-0000-0000-000000000002'::uuid, 'booked'::order_status, 'c0000000-0000-0000-0000-000000000003'::uuid, 'Order placed', now() - interval '2 hours'),
  ('c6000000-0000-0000-0000-000000000202'::uuid, 'c6000000-0000-0000-0000-000000000002'::uuid, 'pickup_assigned'::order_status, 'c0000000-0000-0000-0000-000000000001'::uuid, 'Rider Vikram assigned', now() - interval '90 minutes'),
  ('c6000000-0000-0000-0000-000000000203'::uuid, 'c6000000-0000-0000-0000-000000000004'::uuid, 'picked_up'::order_status, 'c0000000-0000-0000-0000-000000000005'::uuid, 'Garments collected', now() - interval '3 hours'),
  ('c6000000-0000-0000-0000-000000000204'::uuid, 'c6000000-0000-0000-0000-000000000004'::uuid, 'ironing'::order_status, 'c0000000-0000-0000-0000-000000000001'::uuid, 'At partner facility', now() - interval '1 hour'),
  ('c6000000-0000-0000-0000-000000000205'::uuid, 'c6000000-0000-0000-0000-000000000007'::uuid, 'out_for_delivery'::order_status, 'c0000000-0000-0000-0000-000000000006'::uuid, 'En route to customer', now() - interval '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- Rider jobs
INSERT INTO public.rider_jobs (id, order_id, rider_id, job_type, status, scheduled_start, scheduled_end, created_at)
VALUES
  ('c6000000-0000-0000-0000-000000000301'::uuid, 'c6000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 'pickup'::job_type, 'assigned'::job_status,
    timezone('Asia/Kolkata', CURRENT_DATE + time '11:00'), timezone('Asia/Kolkata', CURRENT_DATE + time '14:00'), now()),
  ('c6000000-0000-0000-0000-000000000302'::uuid, 'c6000000-0000-0000-0000-000000000003'::uuid, 'c0000000-0000-0000-0000-000000000006'::uuid, 'pickup'::job_type, 'in_progress'::job_status,
    timezone('Asia/Kolkata', CURRENT_DATE + time '14:00'), timezone('Asia/Kolkata', CURRENT_DATE + time '17:00'), now()),
  ('c6000000-0000-0000-0000-000000000303'::uuid, 'c6000000-0000-0000-0000-000000000007'::uuid, 'c0000000-0000-0000-0000-000000000006'::uuid, 'delivery'::job_type, 'in_progress'::job_status,
    timezone('Asia/Kolkata', CURRENT_DATE + time '16:00'), timezone('Asia/Kolkata', CURRENT_DATE + time '19:00'), now()),
  ('c6000000-0000-0000-0000-000000000304'::uuid, 'c6000000-0000-0000-0000-000000000008'::uuid, 'c0000000-0000-0000-0000-000000000005'::uuid, 'delivery'::job_type, 'completed'::job_status,
    timezone('Asia/Kolkata', CURRENT_DATE + time '05:00'), timezone('Asia/Kolkata', CURRENT_DATE + time '08:00'), now() - interval '2 hours')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- ============================================================
-- 9) Finance — settlements & invoices
-- ============================================================

INSERT INTO public.settlements (id, partner_id, rider_id, period_start, period_end, amount, status, paid_at)
VALUES
  ('c7000000-0000-0000-0000-000000000001'::uuid, 'c5000000-0000-0000-0000-000000000001'::uuid, null,
    date_trunc('week', CURRENT_DATE - interval '7 days'), date_trunc('week', CURRENT_DATE) - interval '1 second',
    12450.00, 'paid', now() - interval '2 days'),
  ('c7000000-0000-0000-0000-000000000002'::uuid, 'c5000000-0000-0000-0000-000000000002'::uuid, null,
    date_trunc('week', CURRENT_DATE - interval '7 days'), date_trunc('week', CURRENT_DATE) - interval '1 second',
    8320.00, 'pending', null),
  ('c7000000-0000-0000-0000-000000000003'::uuid, null, 'c0000000-0000-0000-0000-000000000005'::uuid,
    date_trunc('week', CURRENT_DATE - interval '7 days'), date_trunc('week', CURRENT_DATE) - interval '1 second',
    4200.00, 'paid', now() - interval '1 day')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO public.invoices (id, order_id, invoice_number, subtotal, gst_amount, total, issued_at)
VALUES
  ('c7000000-0000-0000-0000-000000000010'::uuid, 'c6000000-0000-0000-0000-000000000009'::uuid, 'INV-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0001', 450, 81, 531, now() - interval '4 hours'),
  ('c7000000-0000-0000-0000-000000000011'::uuid, 'c6000000-0000-0000-0000-000000000008'::uuid, 'INV-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-0002', 295, 53.1, 348.1, now() - interval '5 hours'),
  ('c7000000-0000-0000-0000-000000000012'::uuid, 'c6000000-0000-0000-0000-000000000012'::uuid, 'INV-' || to_char(CURRENT_DATE - 7, 'YYYYMMDD') || '-0003', 500, 90, 590, now() - interval '7 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 10) Promotions — campaigns, banners, referrals
-- ============================================================

INSERT INTO public.campaigns (id, name, type, channel, status, scheduled_at, target, payload)
VALUES
  ('c8000000-0000-0000-0000-000000000001'::uuid, 'Monsoon Refresh', 'promotional', 'push'::notification_channel, 'scheduled', now() + interval '2 days', '{"communities":["c1000000-0000-0000-0000-000000000002"]}'::jsonb, '{"title":"20% off ironing"}'::jsonb),
  ('c8000000-0000-0000-0000-000000000002'::uuid, 'Wallet Recharge Bonus', 'retention', 'sms'::notification_channel, 'sent', now() - interval '3 days', '{}'::jsonb, '{"bonus_pct":10}'::jsonb)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO public.banners (id, title, image_url, link, community_ids, position, active_from, active_to, is_active)
VALUES
  ('c8000000-0000-0000-0000-000000000010'::uuid, 'Express Ironing — Same Day', 'https://cdn.ironcloud.in/banners/express.jpg', '/offers/express',
    ARRAY['c1000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid], 'home',
    now() - interval '5 days', now() + interval '25 days', true),
  ('c8000000-0000-0000-0000-000000000011'::uuid, 'Refer & Earn ₹100', null, '/referrals',
    ARRAY['c1000000-0000-0000-0000-000000000004'::uuid], 'home',
    now() - interval '10 days', now() + interval '20 days', true)
ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active;

INSERT INTO public.referrals (id, referrer_id, referee_id, code, reward_amount, status)
VALUES
  ('c8000000-0000-0000-0000-000000000020'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'ANANYA100', 100, 'completed'),
  ('c8000000-0000-0000-0000-000000000021'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, null, 'ANANYA101', 100, 'pending')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

-- ============================================================
-- 11) Subscriptions, support, ratings
-- ============================================================

INSERT INTO public.subscriptions (id, customer_id, plan_name, amount, billing_cycle, status, next_billing_at)
VALUES
  ('c9000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'Monthly Ironing Pass', 999, 'monthly', 'active', now() + interval '18 days'),
  ('c9000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'Weekly Lite', 499, 'weekly', 'paused', null)
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO public.support_tickets (id, customer_id, order_id, category, status, assigned_agent_id, sla_due_at, created_at)
VALUES
  ('c9000000-0000-0000-0000-000000000010'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 'c6000000-0000-0000-0000-000000000007'::uuid, 'delivery_delay', 'in_progress'::ticket_status, 'c0000000-0000-0000-0000-000000000007'::uuid, now() + interval '4 hours', now() - interval '2 hours'),
  ('c9000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'c6000000-0000-0000-0000-000000000011'::uuid, 'cancellation', 'resolved'::ticket_status, 'c0000000-0000-0000-0000-000000000007'::uuid, now() - interval '1 day', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO public.ticket_messages (id, ticket_id, sender_id, message, created_at)
VALUES
  ('c9000000-0000-0000-0000-000000000020'::uuid, 'c9000000-0000-0000-0000-000000000010'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 'Delivery is delayed by 2 hours.', now() - interval '2 hours'),
  ('c9000000-0000-0000-0000-000000000021'::uuid, 'c9000000-0000-0000-0000-000000000010'::uuid, 'c0000000-0000-0000-0000-000000000007'::uuid, 'Rider has been rerouted. ETA 30 mins.', now() - interval '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ratings (id, order_id, customer_id, rider_rating, quality_rating, feedback)
VALUES
  ('c9000000-0000-0000-0000-000000000030'::uuid, 'c6000000-0000-0000-0000-000000000012'::uuid, 'c0000000-0000-0000-0000-000000000004'::uuid, 5, 4, 'Great ironing quality!')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 12) Settings, permissions, audit logs, admin notifications
-- ============================================================

INSERT INTO public.system_settings (key, value, updated_by)
VALUES
  ('platform', '{"name":"Iron Cloud","support_phone":"1800-123-4567","gstin":"29ABCDE1234F1Z5"}'::jsonb, 'c0000000-0000-0000-0000-000000000001'::uuid),
  ('operations', '{"default_sla_hours":4,"max_pickup_radius_km":15,"express_multiplier":1.5}'::jsonb, 'c0000000-0000-0000-0000-000000000001'::uuid),
  ('notifications', '{"order_updates":true,"low_wallet_alert":true,"sla_breach_alert":true}'::jsonb, 'c0000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

INSERT INTO public.role_permissions (id, role, resource, action)
VALUES
  ('ca000000-0000-0000-0000-000000000001'::uuid, 'ops_admin', 'orders', 'read'),
  ('ca000000-0000-0000-0000-000000000002'::uuid, 'ops_admin', 'orders', 'write'),
  ('ca000000-0000-0000-0000-000000000003'::uuid, 'ops_admin', 'partners', 'read'),
  ('ca000000-0000-0000-0000-000000000004'::uuid, 'super_admin', 'settings', 'write'),
  ('ca000000-0000-0000-0000-000000000005'::uuid, 'super_admin', 'permissions', 'write')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, after, created_at)
VALUES
  ('ca000000-0000-0000-0000-000000000010'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'order.status_update', 'order', 'c6000000-0000-0000-0000-000000000004'::uuid, '{"status":"ironing"}'::jsonb, now() - interval '1 hour'),
  ('ca000000-0000-0000-0000-000000000011'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'partner.assigned', 'order', 'c6000000-0000-0000-0000-000000000005'::uuid, '{"partner_id":"c5000000-0000-0000-0000-000000000001"}'::jsonb, now() - interval '3 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_notifications (id, recipient_id, type, title, body, entity_type, entity_id, created_at)
VALUES
  ('ca000000-0000-0000-0000-000000000020'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'sla_warning', 'SLA breach risk', 'Ticket #delivery_delay approaching SLA', 'support_ticket', 'c9000000-0000-0000-0000-000000000010'::uuid, now() - interval '30 minutes'),
  ('ca000000-0000-0000-0000-000000000021'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'order', 'New order booked', 'IC order received from Prestige Lakeside', 'order', 'c6000000-0000-0000-0000-000000000001'::uuid, now() - interval '2 hours'),
  ('ca000000-0000-0000-0000-000000000022'::uuid, 'c0000000-0000-0000-0000-000000000001'::uuid, 'wallet', 'Low wallet balance', 'Priya Nair balance below ₹100', 'wallet',
    (SELECT id FROM public.wallets WHERE customer_id = 'c0000000-0000-0000-0000-000000000004'::uuid LIMIT 1),
    now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.notifications (id, recipient_id, channel, template_key, status, sent_at, created_at)
VALUES
  ('ca000000-0000-0000-0000-000000000030'::uuid, 'c0000000-0000-0000-0000-000000000002'::uuid, 'push'::notification_channel, 'order_pickup_assigned', 'sent', now() - interval '90 minutes', now() - interval '2 hours'),
  ('ca000000-0000-0000-0000-000000000031'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'sms'::notification_channel, 'order_delivered', 'sent', now() - interval '5 hours', now() - interval '6 hours')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Verify — quick counts for admin dashboard
-- ============================================================
-- SELECT status, count(*) FROM public.orders WHERE created_at::date = CURRENT_DATE GROUP BY status;
-- SELECT count(*) FROM public.partners WHERE is_active;
-- SELECT count(*) FROM public.riders;
-- SELECT sum(balance) FROM public.wallets;
